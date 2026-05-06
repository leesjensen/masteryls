import React from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyToClipboard({ text, surface = 'light' }) {
  const [copied, setCopied] = React.useState(false);

  const containerClass = 'absolute top-2 right-2 flex items-center gap-2 z-10';
  const buttonClass = surface === 'dark' ? 'p-2 text-xs cursor-pointer text-gray-100 bg-gray-900/80 border border-gray-700 hover:bg-gray-800 rounded-sm' : 'p-2 text-xs cursor-pointer hover:bg-gray-200 rounded-sm';
  const copiedBadgeClass = surface === 'dark' ? 'px-2 py-1.5 text-xs bg-black/80 border border-gray-700 text-gray-50 rounded-sm' : 'px-2 py-1.5 text-xs bg-gray-800 text-gray-50 rounded-sm';

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={containerClass}>
      {!copied && (
        <button onClick={copy} title="Copy to clipboard" className={buttonClass}>
          <Copy size={14} />
        </button>
      )}
      {copied && (
        <>
          <span className={copiedBadgeClass}>Copied!</span>{' '}
          <button className={buttonClass}>
            <Check size={14} color="green" />
          </button>
        </>
      )}
    </div>
  );
}
