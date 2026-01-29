import React from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyToClipboard({ text }) {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
      {!copied && (
        <button onClick={copy} className="p-2 text-xs cursor-pointer hover:bg-gray-200 rounded-sm">
          <Copy size={14} />
        </button>
      )}
      {copied && (
        <>
          <span className="px-2 py-1.5 text-xs bg-gray-800 text-gray-50 rounded-sm">Copied!</span>{' '}
          <button className="p-2 text-xs cursor-pointer hover:bg-gray-200 rounded-sm">
            <Check size={14} color="green" />
          </button>
        </>
      )}
    </div>
  );
}
