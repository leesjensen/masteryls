import React from 'react';

// Horizontal categorical bar chart. Each item's bar is scaled by its primary value; an optional
// detail is printed beside that value (useful for related measures with different units). The full
// label is on hover; items should be pre-sorted by the caller. Height grows with item count.
// An item with an `href` renders its label as a real anchor (so right-click → open-in-new-tab works);
// `onLabelClick(item, event)` handles the plain left-click (typically in-app SPA navigation).
//
//   items:  [{ label, href?, value: number, detail?: string }]
export default function CategoryBarChartSvg({
  items = [],
  color = '#3b82f6',
  ariaLabel = 'Chart',
  onLabelClick,
}) {
  const rows = (Array.isArray(items) ? items : []).filter((it) => it && Number.isFinite(Number(it.value)));
  if (rows.length === 0) return null;

  const maxValue = Math.max(1, ...rows.map((row) => Number(row.value) || 0));

  const W = 800;
  const BAR_H = 14;
  const ROW_GAP = 12; // between topic groups
  const PAD = { top: 8, right: 110, bottom: 8, left: 190 };
  const cw = W - PAD.left - PAD.right;
  const H = PAD.top + PAD.bottom + rows.length * BAR_H + Math.max(0, rows.length - 1) * ROW_GAP;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: `${H}px` }} role="img" aria-label={ariaLabel}>
      {/* y axis */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth={1} />
      {rows.map((row, i) => {
        const y = PAD.top + i * (BAR_H + ROW_GAP);
        const label = String(row.label ?? '');
        const short = label.length > 32 ? `${label.slice(0, 31)}…` : label;
        const labelText = (
          <text x={PAD.left - 8} y={y + BAR_H / 2 + 4} textAnchor="end" fontSize={12} fill={row.href ? '#2563eb' : '#374151'}>
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
            {(() => {
              const value = Number(row.value) || 0;
              const barW = Math.max(value > 0 ? 2 : 0, (value / maxValue) * cw);
              const detail = String(row.detail || '').trim();
              const shown = `${value}${detail ? ` (${detail})` : ''}`;
              return (
                <g>
                  <rect x={PAD.left} y={y} width={barW} height={BAR_H} fill={color} rx={2} opacity={0.85}>
                    <title>{`${label}: ${shown}`}</title>
                  </rect>
                  <text x={PAD.left + barW + 5} y={y + BAR_H / 2 + 4} textAnchor="start" fontSize={10} fill="#6b7280">
                    {shown}
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}
