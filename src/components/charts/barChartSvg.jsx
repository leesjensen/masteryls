import React from 'react';

function defaultTitle(group, label, unit) {
  return `${label}: ${group.count} ${unit}${group.count !== 1 ? 's' : ''}`;
}

// A group's total height: the sum of its stacked segments, or its plain count.
function groupTotal(group) {
  return group.segments ? group.segments.reduce((sum, segment) => sum + segment.count, 0) : group.count;
}

// Simple date-ordered SVG bar chart.
//   dateGroups: [{ day, ts, count, color?, title?, segments? }] sorted by ts. `day` is the
//               unique key. A `segments: [{ key, count, color, label? }]` array renders a
//               stacked bar (bottom -> top) instead of a single `count` bar.
//   maxValue:   value at the top of the chart (defaults to the largest total).
//   yTicks:     tick values for the y axis (defaults to a few integer ticks).
//   formatTick: formats y tick labels.
//   yLabel/unit: axis label and the noun used in the default bar tooltip.
//   showTime:   show the time of day underneath each date label.
export default function BarChartSvg({ dateGroups, maxValue, yTicks, formatTick = (tick) => tick, yLabel = 'Topics', unit = 'topic', color = '#3b82f6', ariaLabel = 'Activity chart', showTime = false }) {
  const W = 800;
  const H = 220;
  const PAD = { top: 16, right: 24, bottom: 44, left: 44 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const n = dateGroups.length;

  const maxCount = maxValue || Math.max(1, ...dateGroups.map((g) => groupTotal(g)));
  const slotW = cw / n;
  const barW = Math.max(4, Math.min(slotW * 0.6, 60));

  const xOf = (i) => PAD.left + i * slotW + slotW / 2;
  const yOf = (count) => PAD.top + ch - (count / maxCount) * ch;

  const ticks = yTicks || (maxCount <= 5 ? Array.from({ length: maxCount }, (_, i) => i + 1) : [1, Math.round(maxCount / 2), maxCount]);

  const labelStep = Math.max(1, Math.ceil(n / 12));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '180px' }} aria-label={ariaLabel}>
      {ticks.map((tick) => (
        <line key={tick} x1={PAD.left} y1={yOf(tick)} x2={PAD.left + cw} y2={yOf(tick)} stroke="#f3f4f6" strokeWidth={1} />
      ))}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ch} stroke="#e5e7eb" strokeWidth={1} />
      <line x1={PAD.left} y1={PAD.top + ch} x2={PAD.left + cw} y2={PAD.top + ch} stroke="#e5e7eb" strokeWidth={1} />
      {ticks.map((tick) => (
        <text key={tick} x={PAD.left - 6} y={yOf(tick) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
          {formatTick(tick)}
        </text>
      ))}
      {yLabel && (
        <text x={12} y={PAD.top + ch / 2} textAnchor="middle" fontSize={10} fill="#9ca3af" transform={`rotate(-90 12 ${PAD.top + ch / 2})`}>
          {yLabel}
        </text>
      )}
      {dateGroups.map((group, i) => {
        const x = xOf(i);
        const label = new Date(group.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const timeLabel = showTime ? new Date(group.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;
        const showLabel = i % labelStep === 0 || i === n - 1;
        // Segments stack from the baseline up; a plain bar is a single full-height segment.
        const segments = group.segments || [{ key: group.day, count: group.count, color: group.color || color, label: null }];
        let cursorY = PAD.top + ch;
        return (
          <g key={group.day}>
            {segments.map((segment) => {
              const sh = Math.max(segment.count > 0 ? 1 : 0, (segment.count / maxCount) * ch);
              cursorY -= sh;
              return (
                <rect key={segment.key} x={x - barW / 2} y={cursorY} width={barW} height={sh} fill={segment.color} rx={2} opacity={0.85}>
                  <title>{group.segments ? `${label}${segment.label ? ` — ${segment.label}` : ''}: ${segment.count}` : group.title || defaultTitle(group, label, unit)}</title>
                </rect>
              );
            })}
            {showLabel && (
              <text x={x} y={PAD.top + ch + 14} textAnchor="middle" fontSize={10} fill="#9ca3af">
                {label}
              </text>
            )}
            {showLabel && timeLabel && (
              <text x={x} y={PAD.top + ch + 27} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {timeLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
