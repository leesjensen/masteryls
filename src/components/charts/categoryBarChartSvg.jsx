import React from 'react';

// Horizontal categorical bar chart. One group per item (e.g. a topic); within a group each configured
// series draws its own bar (its own scale + colour) with the value printed at the bar's end, so two
// different-unit metrics (views, time) read side by side. The full label is on hover; items should be
// pre-sorted by the caller. Height grows with the item count — wrap in a scroll container if tall.
// An item with an `href` renders its label as a real anchor (so right-click → open-in-new-tab works);
// `onLabelClick(item, event)` handles the plain left-click (typically in-app SPA navigation).
//
//   items:  [{ label, href?, values: { [seriesKey]: number } }]
//   series: [{ key, label, color, format? }]   (one bar per series within each group)
export default function CategoryBarChartSvg({
  items = [],
  series = [{ key: 'value', label: '', color: '#3b82f6' }],
  ariaLabel = 'Chart',
  onLabelClick,
}) {
  const rows = (Array.isArray(items) ? items : []).filter((it) => it && it.values);
  if (rows.length === 0 || series.length === 0) return null;

  const valueOf = (row, s) => Number(row.values?.[s.key]) || 0;
  const fmtOf = (s) => (typeof s.format === 'function' ? s.format : (v) => String(v));
  const maxOf = series.map((s) => Math.max(1, ...rows.map((row) => valueOf(row, s))));

  const W = 800;
  const SUB_H = 13; // one series bar
  const SUB_GAP = 3; // between series bars in a group
  const ROW_GAP = 12; // between topic groups
  const groupH = series.length * SUB_H + (series.length - 1) * SUB_GAP;
  const PAD = { top: series.length > 1 ? 26 : 8, right: 52, bottom: 8, left: 190 };
  const cw = W - PAD.left - PAD.right;
  const H = PAD.top + PAD.bottom + rows.length * groupH + Math.max(0, rows.length - 1) * ROW_GAP;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: `${H}px` }} role="img" aria-label={ariaLabel}>
      {/* legend (only when more than one series) */}
      {series.length > 1 &&
        series.map((s, si) => {
          const x = PAD.left + si * 110;
          return (
            <g key={`legend-${s.key}`}>
              <rect x={x} y={6} width={10} height={10} fill={s.color} rx={2} />
              <text x={x + 15} y={15} fontSize={11} fill="#6b7280">
                {s.label}
              </text>
            </g>
          );
        })}
      {/* y axis */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth={1} />
      {rows.map((row, i) => {
        const groupTop = PAD.top + i * (groupH + ROW_GAP);
        const label = String(row.label ?? '');
        const short = label.length > 32 ? `${label.slice(0, 31)}…` : label;
        const labelText = (
          <text x={PAD.left - 8} y={groupTop + groupH / 2 + 4} textAnchor="end" fontSize={12} fill={row.href ? '#2563eb' : '#374151'}>
            {short}
            <title>{label}</title>
          </text>
        );
        return (
          <g key={`${label}-${i}`}>
            {row.href ? (
              <a href={row.href} onClick={(e) => onLabelClick?.(row, e)} className="hover:underline" style={{ cursor: 'pointer' }}>
                {labelText}
              </a>
            ) : (
              labelText
            )}
            {series.map((s, si) => {
              const y = groupTop + si * (SUB_H + SUB_GAP);
              const value = valueOf(row, s);
              const barW = Math.max(value > 0 ? 2 : 0, (value / maxOf[si]) * cw);
              const shown = fmtOf(s)(value);
              return (
                <g key={s.key}>
                  <rect x={PAD.left} y={y} width={barW} height={SUB_H} fill={s.color} rx={2} opacity={0.85}>
                    <title>{`${label} — ${s.label || s.key}: ${shown}`}</title>
                  </rect>
                  <text x={PAD.left + barW + 5} y={y + SUB_H / 2 + 4} textAnchor="start" fontSize={10} fill="#6b7280">
                    {shown}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
