import { LIMITS, functionLineLimit, ratchetSeverity } from "./hotspot-policy.mjs";
import { countMatches, findBlockEnd, splitLines } from "./hotspot-function-shared.mjs";
import { scanRustFunctions } from "./hotspot-rust-function-scan.mjs";

const regexPrefixes = new Set(["await", "case", "delete", "else", "in", "instanceof", "new", "of", "return", "throw", "typeof", "void", "yield"]);

function canStartRegex(output) {
  let index = output.length - 1;
  while (index >= 0 && /\s/.test(output[index])) index -= 1;
  if (index < 0 || /[(\[{,:;=!?&|+\-*%^~<>]/.test(output[index])) return true;
  let wordStart = index;
  while (wordStart >= 0 && /[A-Za-z0-9_$]/.test(output[wordStart])) wordStart -= 1;
  return regexPrefixes.has(output.slice(wordStart + 1, index + 1));
}

function maskNonCode(text) {
  let output = "", state = "code", escaped = false, regexClass = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1] || "", newline = char === "\n" || char === "\r";
    if (state === "line-comment") { output += newline ? char : " "; if (newline) state = "code"; continue; }
    if (state === "block-comment") { if (char === "*" && next === "/") { output += "  "; index += 1; state = "code"; } else output += newline ? char : " "; continue; }
    if (["single", "double", "template"].includes(state)) {
      const closing = state === "single" ? "'" : state === "double" ? '"' : "`";
      output += newline ? char : " ";
      if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === closing) state = "code";
      continue;
    }
    if (state === "regex") {
      output += newline ? char : " ";
      if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === "[") regexClass = true; else if (char === "]") regexClass = false; else if (char === "/" && !regexClass) state = "code";
      continue;
    }
    if (char === "/" && next === "/") { output += "  "; index += 1; state = "line-comment"; }
    else if (char === "/" && next === "*") { output += "  "; index += 1; state = "block-comment"; }
    else if (char === "/" && canStartRegex(output)) { output += " "; state = "regex"; escaped = false; regexClass = false; }
    else if (char === "'") { output += " "; state = "single"; escaped = false; }
    else if (char === '"') { output += " "; state = "double"; escaped = false; }
    else if (char === "`") { output += " "; state = "template"; escaped = false; }
    else output += char;
  }
  return output;
}

function findExpressionEnd(lines, startIndex, signatureEndIndex) {
  let parens = 0, brackets = 0, end = signatureEndIndex;
  for (let index = startIndex; index < lines.length; index += 1) {
    const clean = lines[index]; parens += countMatches(clean, /\(/g) - countMatches(clean, /\)/g); brackets += countMatches(clean, /\[/g) - countMatches(clean, /\]/g);
    if (index >= signatureEndIndex && parens <= 0 && brackets <= 0 && /;\s*$/.test(clean)) return index;
    if (index > signatureEndIndex && clean.trim() === "" && parens <= 0 && brackets <= 0) return Math.max(startIndex, index - 1);
    end = index;
  }
  return end;
}

function classMemberLines(lines) {
  const members = new Array(lines.length).fill(false), classes = []; let depth = 0, pendingClass = false;
  for (let index = 0; index < lines.length; index += 1) {
    while (classes.length > 0 && depth < classes.at(-1).bodyDepth) classes.pop();
    members[index] = classes.length > 0 && depth === classes.at(-1).bodyDepth;
    const line = lines[index]; if (/\bclass\s+[A-Za-z_$][\w$]*/.test(line)) pendingClass = true;
    const opens = countMatches(line, /\{/g), closes = countMatches(line, /\}/g);
    if (pendingClass && opens > 0) { classes.push({ bodyDepth: depth + 1 }); pendingClass = false; } depth += opens - closes;
  }
  return members;
}

// 标识符按 ECMAScript 规范（同样基于 UAX #31）取，中文等非 ASCII 名字不得对门禁隐身。
// 结尾用 ID_Continue 反向断言而不是 \b：\b 只认 ASCII 词字符，中文名后面不构成词边界。
const JS_ID = String.raw`[\p{ID_Start}_$][\p{ID_Continue}$]*`;
const JS_DECLARATION = new RegExp(String.raw`^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(${JS_ID})(?:\s*<[^>{}]*>)?\s*\(`, "u");
const JS_VARIABLE = new RegExp(String.raw`^\s*(?:export\s+)?(?:const|let|var)\s+(${JS_ID})(?![\p{ID_Continue}$])[^=]*=`, "u");
const JS_METHOD = new RegExp(String.raw`^\s*(?:(?:public|private|protected|static|abstract|override|async|readonly|get|set)\s+)*\*?\s*(#?${JS_ID}|constructor)\s*(?:<[^>{}]*>)?\s*\(`, "u");

function functionStartAt(line, isClassMember) {
  const declaration = line.match(JS_DECLARATION);
  if (declaration) return { name: declaration[1], kind: "declaration" };
  const variable = line.match(JS_VARIABLE);
  if (variable) return { name: variable[1], kind: "variable" };
  const method = isClassMember && line.match(JS_METHOD);
  return method ? { name: method[1], kind: "method" } : null;
}

function collectSignature(lines, startIndex, kind) {
  let sawCallable = kind === "declaration" || kind === "method";
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 30); index += 1) {
    const clean = lines[index]; if (/\bfunction\b|=>/.test(clean)) sawCallable = true;
    if (sawCallable && clean.includes("{")) return { valid: true, end: index, hasBlock: true };
    if (sawCallable && /=>/.test(clean)) return { valid: true, end: index, hasBlock: false };
    if (/;\s*$/.test(clean)) return { valid: sawCallable, end: index, hasBlock: false };
  }
  return { valid: false, end: startIndex, hasBlock: false };
}

export function scanFunctions(text, relPath, options = {}) {
  if (/\.rs$/i.test(relPath)) return scanRustFunctions(text, relPath, options);
  const lines = splitLines(text), cleanLines = splitLines(maskNonCode(text)), memberLines = classMemberLines(cleanLines), issues = [], names = [], records = [], occurrences = new Map();
  const current = options.collectOnly ? [] : scanFunctions(text, relPath, { collectOnly: true }).records;
  const baselineRecords = options.baselineText ? scanFunctions(options.baselineText, relPath, { collectOnly: true }).records : [];
  const groups = (items) => items.reduce((counts, item) => counts.set(`${item.name}\0${item.isComponent}`, (counts.get(`${item.name}\0${item.isComponent}`) || 0) + 1), new Map());
  const currentGroups = groups(current), baselineGroups = groups(baselineRecords);
  for (let index = 0; index < lines.length; index += 1) {
    const start = functionStartAt(cleanLines[index] || "", memberLines[index]); if (!start) continue;
    const signature = collectSignature(cleanLines, index, start.kind); if (!signature.valid) continue;
    const end = signature.hasBlock ? findBlockEnd(cleanLines, index, signature.end) : findExpressionEnd(cleanLines, index, signature.end), fnLines = end - index + 1;
    const isComponent = /\.(tsx|jsx)$/.test(relPath) && /^[A-Z]/.test(start.name), key = `${start.name}\0${isComponent}`, occurrence = occurrences.get(key) || 0;
    occurrences.set(key, occurrence + 1); names.push({ name: start.name, line: index + 1 }); records.push({ name: start.name, line: index + 1, lines: fnLines, isComponent, occurrence });
    if (options.collectOnly) continue;
    const baseline = currentGroups.get(key) === baselineGroups.get(key) ? baselineRecords.find((item) => item.name === start.name && item.isComponent === isComponent && item.occurrence === occurrence) : undefined;
    const limit = isComponent ? LIMITS.componentLines : functionLineLimit(relPath);
    if (fnLines > limit) {
      const severity = ratchetSeverity({ currentLines: fnLines, baselineLines: baseline?.lines ?? null, limit, staged: options.staged });
      issues.push({ kind: isComponent ? "long-component" : "long-function", severity, file: relPath, line: index + 1, name: start.name, lines: fnLines, limit, message: `${isComponent ? "组件" : "函数"} ${start.name} 超过 ${limit} 行（实际 ${fnLines}）` });
    }
  }
  return { issues, names, records };
}
