import React from 'react';

export default function Spinner({ className = 'border-white/40 border-t-white' }) {
  return <span className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 ${className}`} />;
}
