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

// Strip fenced code/diagram blocks and snapshot-date metadata (neither is readable summary prose).
function stripPulseNoise(markdown) {
  return String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/^\s*>?\s*\*\*Snapshot date:\*\*.*$/gim, ' ')
    .replace(/^\s*>.*\|\s*Snapshot date:.*$/gim, ' ');
}

// Reduce a Markdown segment to a single line of plain prose (drops tables, images, headings, lists,
// and inline emphasis/code/link syntax).
function pulseSegmentToProse(segment) {
  return String(segment || '')
    .replace(/^\s*\|.*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}[^\n]*$/gm, ' ')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampProse(text, maxLength) {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? truncated.slice(0, lastSpace) : truncated).trimEnd()}…`;
}

// The body of a `## <name>` section, up to the next `##` heading.
function pulseSectionBody(cleaned, name) {
  const heading = new RegExp(`^##\\s+${name}\\s*$`, 'im');
  const start = cleaned.search(heading);
  if (start < 0) return '';
  const after = cleaned.slice(start).replace(heading, '');
  const next = after.search(/^##\s+/m);
  return next < 0 ? after : after.slice(0, next);
}

/**
 * A short plain-text excerpt of a pulse for compact surfaces (e.g. the dashboard card). Prefers the
 * lead summary paragraph (prose before the first heading); falls back to the Overview section, then
 * to any body prose. Truncated to `maxLength` on a word boundary.
 */
export function pulseSummaryText(markdown, maxLength = 240) {
  const cleaned = stripPulseNoise(markdown);
  const firstHeading = cleaned.search(/^\s{0,3}#{1,6}\s/m);
  const lead = pulseSegmentToProse(firstHeading < 0 ? cleaned : cleaned.slice(0, firstHeading));
  if (lead) return clampProse(lead, maxLength);
  const overview = pulseSegmentToProse(pulseSectionBody(cleaned, 'Overview'));
  if (overview) return clampProse(overview, maxLength);
  return clampProse(pulseSegmentToProse(cleaned), maxLength);
}
