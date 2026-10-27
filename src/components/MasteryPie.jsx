import React from 'react';
import { handleInAppLinkClick } from '../utils/linkNavigation.js';

// A small pie showing course mastery (0-100). Used in the classroom toolbar as the MasteryView
// affordance: it renders the learner's stored enrollment mastery and, when clicked, opens the
// full MasteryView. Given an `href` it renders as a real anchor (like the other toolbar icons)
// so the browser offers "Open in new tab/window" on a right/modifier-click, while a plain click
// navigates in-app through `onClick`. It is drawn in `currentColor` and wrapped in the same
// classes as ToolBarButton so its size and default/hover colors match the other toolbar icons
// exactly: the filled wedge is the icon color, the remaining track is a faded version of it.
// Just the pie graphic (drawn in `currentColor`), with no wrapping anchor/button - so it can be used
// as an icon inside another link (e.g. the sidebar Mastery affordance) as well as inside MasteryPie.
export function MasteryPieIcon({ percent, size = 24, showNumber = true }) {
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

  // Shrink the label for 3 digits (100) so it still fits the center well.
  const fontSize = size * (pct >= 100 ? 0.34 : 0.42);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity="0.2" />
      {wedge}
      {showNumber && <circle cx={cx} cy={cy} r={r * 0.62} fill="white" />}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      {showNumber && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight="600" fill="currentColor">
          {pct}
        </text>
      )}
    </svg>
  );
}

export default function MasteryPie({ percent, size = 24, title, onClick, href, showNumber = true }) {
  const className = 'text-gray-400 hover:text-blue-600 transition-all duration-200 ease-in-out filter grayscale hover:grayscale-0';
  const svg = <MasteryPieIcon percent={percent} size={size} showNumber={showNumber} />;

  if (href) {
    return (
      <a href={href} title={title} aria-label={title} onClick={(e) => handleInAppLinkClick(e, () => onClick?.())} className={className}>
        {svg}
      </a>
    );
  }

  return (
    <button title={title} aria-label={title} onClick={onClick} className={className}>
      {svg}
    </button>
  );
}
