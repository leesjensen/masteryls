import React from 'react';

// A row of coloured swatches labelling the wellness-question sentiments. Shared by the
// learner and course attendance charts so both read the same way. `items` is an ordered
// list of { value, color }; renders nothing when empty.
export default function SentimentLegend({ items, className = '' }) {
  if (!items || items.length === 0) return null;
  return (
    <span className={`flex flex-wrap items-center gap-3 text-xs text-gray-500 ${className}`.trim()}>
      {items.map((item) => (
        <span key={item.value} className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: item.color }} /> {item.value}
        </span>
      ))}
    </span>
  );
}
