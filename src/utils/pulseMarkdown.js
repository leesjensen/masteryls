const MERMAID_DECLARATION = /^(?:flowchart\b|graph\b|sequenceDiagram\b|classDiagram\b|stateDiagram(?:-v2)?\b|erDiagram\b|journey\b|gantt\b|pie\b|quadrantChart\b|requirementDiagram\b|gitGraph\b|mindmap\b|timeline\b|xychart-beta\b|sankey-beta\b|block-beta\b|packet-beta\b|architecture-beta\b)/i;
const MERMAID_DIRECTIVE = /^\s*%%\{init\s*:/;

function isFence(line) {
  return /^\s*(```|~~~)/.test(line);
}

/** Repair common model output that emits Mermaid source as raw Markdown. */
export function fenceUnmarkedMermaid(content) {
  const lines = String(content || '').split('\n');
  const output = [];
  let insideFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isFence(line)) {
      insideFence = !insideFence;
      output.push(line);
      continue;
    }
    if (insideFence) {
      output.push(line);
      continue;
    }

    let start = i;
    let declarationIndex = i;
    if (MERMAID_DIRECTIVE.test(line)) {
      declarationIndex = i + 1;
      while (declarationIndex < lines.length && !lines[declarationIndex].trim()) declarationIndex += 1;
      if (!MERMAID_DECLARATION.test(lines[declarationIndex] || '')) {
        output.push(line);
        continue;
      }
    } else if (!MERMAID_DECLARATION.test(line.trim())) {
      output.push(line);
      continue;
    }

    if (declarationIndex !== i) start = i;
    output.push('```mermaid');
    for (let j = start; j < lines.length && lines[j].trim(); j += 1) output.push(lines[j]);
    output.push('```');
    i = start;
    while (i + 1 < lines.length && lines[i + 1].trim()) i += 1;
  }
  return output.join('\n');
}

export function normalizePulseMarkdown(content) {
  const normalized = String(content || '').replace(/^> .*?\|\s*Snapshot date:\s*(\d{4}-\d{2}-\d{2})\s*$/m, '**Snapshot date:** $1');
  return fenceUnmarkedMermaid(normalized);
}
