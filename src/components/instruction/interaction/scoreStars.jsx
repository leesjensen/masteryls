import React from 'react';
import { Star } from 'lucide-react';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function ScoreStars({ percent = 0, sizeClass = 'h-3.5 w-3.5', className = '' }) {
  const clampedPercent = clamp(Number(percent) || 0, 0, 100);
  const starsOutOfFive = clampedPercent / 20;

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${clampedPercent}% score (${starsOutOfFive.toFixed(2)} out of 5 stars)`} title={`${clampedPercent}%`}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fillRatio = clamp(starsOutOfFive - index, 0, 1);
        const clippedRight = 100 - fillRatio * 100;

        return (
          <span key={index} className="relative inline-block">
            <Star className={`${sizeClass} text-slate-300`} strokeWidth={1.8} />
            <Star className={`absolute inset-0 ${sizeClass} text-blue-600`} strokeWidth={1.8} fill="currentColor" stroke="currentColor" style={{ clipPath: `inset(0 ${clippedRight}% 0 0)` }} />
          </span>
        );
      })}
    </div>
  );
}
