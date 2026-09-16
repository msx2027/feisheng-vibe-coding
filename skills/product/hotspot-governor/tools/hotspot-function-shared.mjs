export const countMatches = (text, pattern) => text.match(pattern)?.length || 0;

export function splitLines(text) {
  if (text.length === 0) return [];
  const lines = text.split(/\r\n|\n|\r/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

export function findBlockEnd(lines, startIndex, signatureEndIndex, startColumn = 0) {
  const signatureLines = lines.slice(startIndex, signatureEndIndex + 1);
  signatureLines[0] = signatureLines[0].slice(startColumn);
  const signature = signatureLines.join("\n");
  let balance = countMatches(signature, /\{/g) - countMatches(signature, /\}/g);
  let end = signatureEndIndex;
  while (balance > 0 && end + 1 < lines.length) {
    end += 1;
    balance += countMatches(lines[end], /\{/g) - countMatches(lines[end], /\}/g);
  }
  return end;
}
