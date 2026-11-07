import React from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyToClipboard({ text, surface = 'light', position = 'overlay' }) {
  const [copied, setCopied] = React.useState(false);

  const containerClass = position === 'inline' ? 'inline-flex items-center gap-2' : 'absolute top-2 right-2 flex items-center gap-2 z-10';
  const buttonClass = surface === 'dark' ? 'p-2 text-xs cursor-pointer text-gray-100 bg-gray-900/80 border border-gray-700 hover:bg-gray-800 rounded-sm' : 'p-2 text-xs cursor-pointer hover:bg-gray-200 rounded-sm';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={containerClass}>
      <button
        type="button"
        onClick={copy}
        title={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
        aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
        className={buttonClass}
      >
        {copied ? <Check size={14} color="green" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}
