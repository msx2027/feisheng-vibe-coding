import {
  DEFAULT_DOCUMENT_INDEX,
  estimateTokens,
  hashContent,
} from "./target-doc-manifest-core.mjs";

export function normalizeDocumentText(content) {
  return String(content).replace(/^\uFEFF/u, "");
}

export function parseMarkdownSections(content) {
  const lines = normalizeDocumentText(content).replace(/\r\n?/gu, "\n").split("\n");
  const markers = [];
  const markerPattern = /^\s*<!--\s*vibe-section:([A-Za-z0-9][A-Za-z0-9._:-]*)\s*-->\s*$/u;
  const headingPattern = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(markerPattern);
    if (match) markers.push({ id: match[1], markerIndex: index });
  }
  const seen = new Set();
  return markers.map((marker, markerIndex) => {
    if (seen.has(marker.id)) throw new Error(`duplicate vibe section id: ${marker.id}`);
    seen.add(marker.id);
    const nextMarkerIndex = markers[markerIndex + 1]?.markerIndex ?? lines.length;
    let heading = "";
    for (let lineIndex = marker.markerIndex + 1; lineIndex < nextMarkerIndex; lineIndex += 1) {
      const headingMatch = lines[lineIndex].match(headingPattern);
      if (headingMatch) {
        heading = headingMatch[1].trim();
        break;
      }
    }
    const sectionContent = lines.slice(marker.markerIndex, nextMarkerIndex).join("\n");
    return {
      id: marker.id,
      heading,
      startLine: marker.markerIndex + 1,
      endLine: Math.max(marker.markerIndex + 1, nextMarkerIndex),
      hash: hashContent(sectionContent),
      tokens: estimateTokens(sectionContent),
    };
  });
}

export function metadataForDocument(file, content) {
  const text = normalizeDocumentText(content);
  return {
    contentHash: hashContent(text),
    estimatedTokens: estimateTokens(text),
    sections: /\.md$/iu.test(file) ? parseMarkdownSections(text) : [],
  };
}

export function refreshDocumentEntries(entries, readContent) {
  return entries.map((entry) => {
    if (entry.role === "documentIndex") return entry;
    const content = readContent(entry);
    return typeof content === "string" ? { ...entry, ...metadataForDocument(entry.path, content) } : entry;
  });
}

function describeEntry(entry) {
  const sections = entry.sections.length === 0
    ? "无"
    : entry.sections.map((section) => `${section.id}（${section.startLine}-${section.endLine}，~${section.tokens}）`).join("、");
  return `| ${entry.role} | ${entry.path} | ${entry.authority} | ~${entry.estimatedTokens} | ${entry.contentHash} | ${sections} |`;
}

export function renderTargetDocIndex(entries) {
  const rows = entries.filter((entry) => entry.role !== "documentIndex").map(describeEntry);
  return [
    "# 文档索引",
    "",
    "<!-- 此文件由 build-target-doc-index.mjs 生成；仅保存导航与完整性信息。 -->",
    "",
    "| 角色 | 路径 | 权威类型 | 预估 Tokens | 内容哈希 | 片段 |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

export function finalizeDocumentIndex(entries, indexPath = DEFAULT_DOCUMENT_INDEX) {
  const indexEntry = entries.find((entry) => entry.role === "documentIndex");
  if (!indexEntry) throw new Error("documents[] must register documentIndex");
  const indexContent = renderTargetDocIndex(entries);
  const documents = entries.map((entry) => entry.role === "documentIndex"
    ? { ...entry, path: indexPath, ...metadataForDocument(indexPath, indexContent) }
    : entry);
  return { documents, indexContent, indexPath };
}
