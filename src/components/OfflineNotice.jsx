import React from 'react';
import { WifiOff } from 'lucide-react';

const variantClasses = {
  chip: 'h-7 shrink-0 gap-1 rounded-full px-2 text-xs font-medium',
  notice: 'gap-2 rounded-lg px-4 py-3 text-sm',
};

export default function OfflineNotice({ message, variant = 'notice', tooltip, className = '' }) {
  const classes = `inline-flex items-center border border-amber-300 bg-amber-50 text-amber-900 ${variantClasses[variant] || variantClasses.notice} ${className}`.trim();
  return (
    <span role="status" aria-live="polite" aria-label={tooltip || message} title={tooltip} className={classes}>
      <WifiOff size={14} aria-hidden="true" className="shrink-0" />
      <span>{message}</span>
    </span>
  );
}
