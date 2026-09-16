import { functionLineLimit, ratchetSeverity } from "./hotspot-policy.mjs";
import { findBlockEnd, splitLines } from "./hotspot-function-shared.mjs";

// 标识符按 Rust 规范（UAX #31）取，中文等非 ASCII 函数名同样必须被门禁看见。
// 名字结尾用 XID_Continue 反向断言而不是 \b：\b 只认 ASCII 词字符，中文名后面不构成词边界。
const RUST_FUNCTION_PATTERN = /^(\s*(?:(?:#\[[^\]]*\]|[)\]]+)\s*)*(?:default\s+)?(?:pub(?:\s*\([^)]*\))?\s+)?(?:default\s+)?(?:(?:async|const|unsafe|gen)\s+)*(?:extern(?:\s*(?:"[^"]*"|'[^']*'))?\s+)?(?:(?:async|const|unsafe|gen)\s+)*)fn\s+(?:r#)?([\p{XID_Start}_][\p{XID_Continue}]*)(?![\p{XID_Continue}])/u;
const INLINE_OWNER_PATTERN = /^\s*(?:(?:#\[[^\]]*\]|[)\]]+)\s*)*((?:(?:unsafe\s+)?impl\b|(?:pub(?:\s*\([^)]*\))?\s+)?(?:mod|trait)\b)[^{};]*)\{\s*/;

function rustScopeLabel(header) {
  const clean = header.replace(/\s+/g, " ").trim();
  const named = clean.match(/(?:^|\s)(mod|trait)\s+(?:r#)?([\p{XID_Start}_][\p{XID_Continue}]*)(?![\p{XID_Continue}])/u);
  if (named) return `${named[1]}:${named[2]}`;
  const implAt = clean.search(/(?:^|\s)(?:unsafe\s+)?impl\b/);
  return implAt >= 0 ? `impl:${clean.slice(implAt).trim()}` : "";
}

function rustFunctionStartAt(line) {
  const owner = line.match(INLINE_OWNER_PATTERN);
  const offset = owner?.[0].length || 0;
  const match = line.slice(offset).match(RUST_FUNCTION_PATTERN);
  return match ? { name: match[2], column: offset + match[1].length, inlineScope: owner ? rustScopeLabel(owner[1]) : "" } : null;
}

/**
 * 逐个取出一行里的所有 fn 声明。
 * 同一行写多个函数（`trait Cap { fn x(); fn y(); }`）是合法 Rust，
 * 报「看不懂」属于误杀——误报比漏报更难用，人会以为门禁坏了。
 */
function rustFunctionStartsIn(line) {
  const first = rustFunctionStartAt(line);
  if (!first) return [];
  const starts = [first];
  // 首个之后再逐个找：把已量过的部分连同函数名一起跳过，
  // 剩下的片段补上 impl 头的等长空白，让锚定 ^ 的正则仍能匹配到修饰符前缀。
  let cursor = first.column;
  while (cursor < line.length) {
    const nameEnd = line.slice(cursor).search(/\(/);
    if (nameEnd < 0) break;
    cursor += nameEnd + 1;
    const rest = line.slice(cursor);
    const next = rest.match(/(?:^|[^\p{XID_Continue}])fn(?![\p{XID_Continue}])/u);
    if (!next) break;
    const at = cursor + next.index + next[0].indexOf("fn");
    const start = rustFunctionStartAt(" ".repeat(at) + line.slice(at));
    if (!start) break;
    starts.push(start);
    cursor = start.column;
  }
  return starts;
}

// 带名字的 fn 声明候选：fn 后面跟的第一个非空字符不像函数指针类型（fn(u32)、fn() -> u32 没有名字）。
const RUST_NAMED_FN_AT = /(?:^|[^\p{XID_Continue}])fn(?![\p{XID_Continue}])\s*[^\s(<,)>;=\]}]/gu;
const RUST_FN_NAME_HEAD = /^fn\s+(?:r#)?[\p{XID_Start}_][\p{XID_Continue}]*(?![\p{XID_Continue}])/u;

/**
 * 认不出就明确报告，绝不静默跳过。
 * 静默跳过等于「失败即开放」：任何正则疏漏都会变成无声的漏洞，中文函数名失明就是这么来的。
 * 报告成 blocker finding 而不是抛错，是为了让其余文件的体检结论照常产出——
 * 一处看不懂就把整份报告作废，会连带丢掉真正的超长函数等问题。
 */
function unrecognizedFunctionFinding(line, starts, relPath, lineNumber) {
  const candidates = [...line.matchAll(RUST_NAMED_FN_AT)];
  if (candidates.length === 0) return null;
  const unnamed = candidates.filter((item) => !RUST_FN_NAME_HEAD.test(line.slice(item.index + item[0].indexOf("fn"))));
  // 名字真的不符合标识符规范才算看不懂；数量对得上就说明每处都已逐个量到。
  if (unnamed.length > 0) {
    return unrecognizedFinding(relPath, lineNumber, "函数名不符合 Rust 标识符规范（UAX #31）", line);
  }
  if (starts.length >= candidates.length) return null;
  // fn 前面已经开了块（`let v = { fn 里() ... }` 这类表达式块内定义）属合法但极罕见的写法，
  // 它嵌在别的函数体内、已被外层函数的行数覆盖，不构成门禁盲区，不按看不懂报。
  const firstAt = candidates[0].index + candidates[0][0].indexOf("fn");
  if (line.slice(0, firstAt).includes("{")) return null;
  return unrecognizedFinding(relPath, lineNumber, "声明前缀不在已支持的修饰符组合内", line);
}

function unrecognizedFinding(relPath, lineNumber, reason, line) {
  return {
    kind: "unrecognized-function", severity: "blocker", file: relPath, line: lineNumber,
    message: `结构门禁无法识别 fn 声明（${reason}）→ ${line.trim()}`,
  };
}

function rustCharLiteralStart(text, index) {
  const char = text[index];
  if (char !== "'" && !(char === "b" && text[index + 1] === "'")) return null;
  const quoteAt = char === "b" ? index + 1 : index;
  let cursor = quoteAt + 1;
  if (cursor >= text.length) return null;
  if (text[cursor] === "\\") {
    cursor += 1;
    if (cursor >= text.length) return null;
    if (text[cursor] === "u" && text[cursor + 1] === "{") {
      cursor += 2;
      while (cursor < text.length && text[cursor] !== "}") cursor += 1;
      if (cursor >= text.length) return null;
      cursor += 1;
    } else cursor += 1;
  } else if (text[cursor] === "'") return null;
  else cursor += 1;
  return text[cursor] === "'" ? { end: cursor } : null;
}

function maskRustNonCode(text) {
  let output = "", state = "code", escaped = false, rawHashes = 0, blockDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1] || "", newline = char === "\n" || char === "\r";
    if (state === "line-comment") { output += newline ? char : " "; if (newline) state = "code"; continue; }
    if (state === "block-comment") {
      if (char === "/" && next === "*") { output += "  "; index += 1; blockDepth += 1; }
      else if (char === "*" && next === "/") { output += "  "; index += 1; blockDepth -= 1; if (blockDepth <= 0) { blockDepth = 0; state = "code"; } }
      else output += newline ? char : " ";
      continue;
    }
    if (state === "double") {
      output += newline ? char : " ";
      if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') state = "code";
      continue;
    }
    if (state === "raw-string") {
      if (char === '"') {
        let hashes = 0;
        while (text[index + 1 + hashes] === "#") hashes += 1;
        if (hashes === rawHashes) { output += ` ${"#".repeat(hashes)}`; index += hashes; state = "code"; continue; }
      }
      output += newline ? char : " ";
      continue;
    }
    if (char === "/" && next === "/") { output += "  "; index += 1; state = "line-comment"; }
    else if (char === "/" && next === "*") { output += "  "; index += 1; blockDepth = 1; state = "block-comment"; }
    else if (char === "r" && (next === "#" || next === '"')) {
      let cursor = index + 1, hashes = 0;
      while (text[cursor] === "#") { hashes += 1; cursor += 1; }
      if (text[cursor] === '"') { output += " ".repeat(cursor - index + 1); index = cursor; rawHashes = hashes; state = "raw-string"; }
      else output += char;
    } else if (char === '"') { output += " "; state = "double"; escaped = false; }
    else {
      const literal = rustCharLiteralStart(text, index);
      if (!literal) output += char;
      else {
        for (let cursor = index; cursor <= literal.end; cursor += 1) output += /[\r\n]/.test(text[cursor]) ? text[cursor] : " ";
        index = literal.end;
      }
    }
  }
  return output;
}

function collectRustSignature(lines, startIndex, startColumn) {
  let parens = 0, brackets = 0, angles = 0, nestedBraces = 0, lastSignificant = "", beforeLast = "", beforeBefore = "";
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = index === startIndex ? lines[index].slice(startColumn) : lines[index];
    for (const char of line) {
      if (char === "(") parens += 1; else if (char === ")") parens = Math.max(0, parens - 1);
      else if (char === "[") brackets += 1; else if (char === "]") brackets = Math.max(0, brackets - 1);
      else if (char === "<" && parens === 0 && brackets === 0 && nestedBraces === 0) angles += 1;
      else if (char === ">" && parens === 0 && brackets === 0 && nestedBraces === 0) angles = Math.max(0, angles - 1);
      else if (char === "{" && (parens > 0 || brackets > 0 || angles > 0 || nestedBraces > 0 || (lastSignificant === "!" && !(beforeLast === ">" && beforeBefore === "-")))) nestedBraces += 1;
      else if (char === "{" && nestedBraces === 0) return { valid: true, end: index };
      else if (char === "}" && nestedBraces > 0) nestedBraces -= 1;
      // 分号收尾是合法的无体声明（trait 签名、extern 块声明），没有函数体可量，本就该跳过。
      else if (char === ";" && parens === 0 && brackets === 0 && angles === 0 && nestedBraces === 0) return { valid: false, declarationOnly: true, end: index };
      if (!/\s/.test(char)) { beforeBefore = beforeLast; beforeLast = lastSignificant; lastSignificant = char; }
    }
  }
  // 扫到文件尾既没找到函数体也没找到分号，是真解析不出，不能与无体声明混为一谈。
  return { valid: false, declarationOnly: false, end: startIndex };
}

function rustScopeKeys(lines) {
  const keys = new Array(lines.length), stack = []; let depth = 0, header = "";
  for (let index = 0; index < lines.length; index += 1) {
    while (stack.length > 0 && depth < stack.at(-1).depth) stack.pop();
    keys[index] = stack.map((item) => item.label).join("::");
    for (const char of lines[index]) {
      if (char === "{") {
        const clean = header.replace(/\s+/g, " ").trim();
        const label = rustScopeLabel(clean);
        depth += 1;
        if (label) stack.push({ depth, label });
        header = "";
      } else if (char === "}") { depth = Math.max(0, depth - 1); header = ""; }
      else if (char === ";") header = ""; else header += char;
    }
    header += " ";
  }
  return keys;
}

function rustAttributeKey(lines, index, startColumn) {
  const attributes = lines[index].slice(0, startColumn).match(/#\[[^\]]*\]/g) || [];
  let cursor = index - 1;
  while (cursor >= 0) {
    while (cursor >= 0 && lines[cursor].trim() === "") cursor -= 1;
    if (cursor < 0) break;
    const end = cursor;
    let bracketDepth = 0, start = -1;
    for (; cursor >= 0; cursor -= 1) {
      const line = lines[cursor];
      for (let column = line.length - 1; column >= 0; column -= 1) {
        if (line[column] === "]") bracketDepth += 1;
        else if (line[column] === "[") bracketDepth -= 1;
      }
      if (/^\s*#\[/.test(line) && bracketDepth === 0) {
        start = cursor;
        break;
      }
      if (bracketDepth <= 0) break;
    }
    if (start < 0) break;
    attributes.unshift(lines.slice(start, end + 1).join(" "));
    cursor = start - 1;
  }
  return attributes
    .map((attribute) => attribute.replace(/\s+/g, " ").trim())
    .filter((attribute) => (
      /^#\[\s*cfg\s*\(/.test(attribute)
      || (/^#\[\s*cfg_attr\s*\(/.test(attribute) && /,\s*cfg\s*\(/.test(attribute))
    ))
    .join("|");
}

const recordKey = (item) => `${item.scope}\0${item.attributes}\0${item.name}\0${item.isComponent}`;

export function scanRustFunctions(text, relPath, options = {}) {
  const lines = splitLines(text), cleanLines = splitLines(maskRustNonCode(text)), scopes = rustScopeKeys(cleanLines);
  const issues = [], names = [], records = [], occurrences = new Map();
  const current = options.collectOnly ? [] : scanRustFunctions(text, relPath, { collectOnly: true }).records;
  const baselineRecords = options.baselineText ? scanRustFunctions(options.baselineText, relPath, { collectOnly: true }).records : [];
  const groups = (items) => items.reduce((counts, item) => counts.set(recordKey(item), (counts.get(recordKey(item)) || 0) + 1), new Map());
  const currentGroups = groups(current), baselineGroups = groups(baselineRecords);
  const limit = functionLineLimit(relPath);
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanLines[index] || "";
    const starts = rustFunctionStartsIn(line);
    const unrecognized = unrecognizedFunctionFinding(line, starts, relPath, index + 1);
    if (unrecognized) { if (!options.collectOnly) issues.push(unrecognized); continue; }
    // 同一行可能写了多个函数（合法 Rust），逐个量，不许只量第一个就放过后面的。
    for (const start of starts) {
      const signature = collectRustSignature(cleanLines, index, start.column);
      if (!signature.valid) {
        // 合法无体声明照旧跳过；真解析不出必须留痕，否则「下一次新语法」又是无声盲区。
        if (!signature.declarationOnly && !options.collectOnly) {
          issues.push(unrecognizedFinding(relPath, index + 1, "签名解析失败，未找到函数体或声明收尾", line));
        }
        continue;
      }
      const end = findBlockEnd(cleanLines, index, signature.end, start.column), fnLines = end - index + 1;
      const scope = [scopes[index], start.inlineScope].filter(Boolean).join("::");
      const attributes = rustAttributeKey(cleanLines, index, start.column);
      const identity = `${scope}\0${attributes}\0${start.name}\0false`, occurrence = occurrences.get(identity) || 0;
      occurrences.set(identity, occurrence + 1);
      names.push({ name: start.name, line: index + 1 });
      records.push({ name: start.name, line: index + 1, lines: fnLines, isComponent: false, occurrence, scope, attributes });
      if (options.collectOnly || fnLines <= limit) continue;
      const baseline = currentGroups.get(identity) === 1 && baselineGroups.get(identity) === 1
        ? baselineRecords.find((item) => recordKey(item) === identity && item.occurrence === occurrence)
        : undefined;
      const severity = ratchetSeverity({
        currentLines: fnLines,
        baselineLines: baseline?.lines ?? null,
        limit,
        staged: options.staged,
        fallback: options.staged ? "warn" : "blocker",
      });
      issues.push({
        kind: "long-function", severity, file: relPath, line: index + 1, name: start.name,
        lines: fnLines, limit,
        message: `函数 ${start.name} 超过 ${limit} 行（实际 ${fnLines}）`,
      });
    }
  }
  return { issues, names, records };
}
