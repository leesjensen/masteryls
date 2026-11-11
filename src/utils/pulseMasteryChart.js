// Build the mastery-trend Mermaid xychart and insert it into a pulse WITHOUT the model's help, so it
// always plots every available snapshot. The model tends to emit only two points; building it here
// from the full pulse history guarantees the chart grows over time. The pulse prompt leaves a
// `{{MASTERY_TREND_CHART}}` placeholder that `insertMasteryTrendChart` fills (or removes).

export const MASTERY_TREND_PLACEHOLDER = '{{MASTERY_TREND_CHART}}';

const MERMAID_INIT = `%%{init: { 'theme': 'neutral', 'themeVariables': {
    'xyChart': {
      'plotColorPalette':  '#4a95e0ff, #96d21dff, #eea717ff'},
'mainBkg': '#ffffff', 'lineColor': '#000000', 'primaryTextColor': '#000000', 'actorBorder': '#000000', 'participantBorder': '#000000', 'noteBorderColor': '#000000' } }}%%`;

/**
 * Build a Mermaid xychart (bar) of mastery percent over time. `points` is
 * `[{ date: 'YYYY-MM-DD', mastery }]`; same-date points keep the LAST (so the current value overrides a
 * prior pulse on the same day). The y-axis is fixed to 0–100 since mastery is a percent. Returns ''
 * when fewer than two plottable points exist (a one-point trend is not a trend).
 */
export function buildMasteryTrendChart(points = [], { title = 'Average Cumulative Mastery (%)' } = {}) {
  const byDate = new Map();
  for (const p of Array.isArray(points) ? points : []) {
    if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.date)) || !Number.isFinite(Number(p.mastery))) continue;
    byDate.set(p.date, Math.round(Number(p.mastery) * 10) / 10);
  }
  const ordered = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (ordered.length < 2) return '';
  const values = ordered.map(([, v]) => v);
  return [
    '```mermaid',
    MERMAID_INIT,
    'xychart-beta',
    `    title "${title}"`,
    `    x-axis [${ordered.map(([d]) => `"${d}"`).join(', ')}]`,
    '    y-axis "Mastery (%)" 0 --> 100',
    '    %% blue bar',
    `    bar [${values.join(', ')}]`,
    '```',
  ].join('\n');
}

/**
 * Replace the `{{MASTERY_TREND_CHART}}` placeholder with `chart` (removing the placeholder when the
 * chart is empty). If the model omitted the placeholder, fall back to inserting the chart right after
 * the Status indicators section, then after any content.
 */
export function insertMasteryTrendChart(markdown, chart) {
  const md = String(markdown || '');
  const tidy = (text) => text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trimEnd() + '\n';

  if (md.includes(MASTERY_TREND_PLACEHOLDER)) {
    return tidy(md.split(MASTERY_TREND_PLACEHOLDER).join(chart || ''));
  }
  if (!chart) return md;

  const statusStart = md.search(/^##\s+Status indicators\s*$/im);
  if (statusStart >= 0) {
    const rest = md.slice(statusStart);
    const bodyStart = rest.indexOf('\n') + 1;
    const nextRel = rest.slice(bodyStart).search(/^##\s+/m);
    const insertAt = nextRel < 0 ? md.length : statusStart + bodyStart + nextRel;
    return tidy(`${md.slice(0, insertAt).trimEnd()}\n\n${chart}\n\n${md.slice(insertAt).trimStart()}`);
  }
  return tidy(`${md.trimEnd()}\n\n${chart}`);
}
