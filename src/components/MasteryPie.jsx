import React from 'react';

// A small pie showing course mastery (0-100). Used in the classroom toolbar as the MasteryView
// affordance: it renders the learner's stored enrollment mastery and, when clicked, opens the
// full MasteryView. It is drawn in `currentColor` and wrapped in the same button classes as
// ToolBarButton so its size and default/hover colors match the other toolbar icons exactly: the
// filled wedge is the icon color, the remaining track is a faded version of it.
export default function MasteryPie({ percent, size = 24, title, onClick }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const r = size / 2;
  const cx = r;
  const cy = r;

  let wedge = null;
  if (pct >= 100) {
    wedge = <circle cx={cx} cy={cy} r={r} fill="currentColor" />;
  } else if (pct > 0) {
    const angle = (pct / 100) * 2 * Math.PI;
    // Sweep clockwise from 12 o'clock.
    const endX = cx + r * Math.sin(angle);
    const endY = cy - r * Math.cos(angle);
    const largeArc = pct > 50 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
    wedge = <path d={d} fill="currentColor" />;
  }

  return (
    <button title={title} aria-label={title} onClick={onClick} className="text-gray-400 hover:text-amber-600 transition-all duration-200 ease-in-out  filter grayscale hover:grayscale-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity="0.2" />
        {wedge}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      </svg>
    </button>
  );
}
