import React from 'react';
import { StickyNote } from 'lucide-react';
import Markdown from '../Markdown';

export default function MessageBox({ message, handleSaveAsNote }) {
  const { type, content } = message;

  let justify;
  let styles;
  let formatAsMarkdown;
  switch (type) {
    case 'user':
      justify = 'justify-end';
      styles = 'max-w-[80%] border-2 border-blue-500 bg-blue-600 text-white';
      formatAsMarkdown = false;
      break;
    case 'note':
      justify = 'justify-end';
      styles = 'max-w-[100%] border-2 border-amber-400 text-gray-800';
      formatAsMarkdown = true;
      break;
    case 'error':
      justify = 'justify-start';
      styles = 'max-w-[80%] border-2 border-red-700 bg-red-100 text-red-800';
      formatAsMarkdown = false;
      break;
    default:
      justify = 'justify-start';
      styles = 'max-w-[80%] border-2 border-gray-400';
      formatAsMarkdown = true;
      break;
  }

  let saveAIResponse = null;
  if (type === 'model') {
    const messageSaved = message.state === 'saved';
    saveAIResponse = (
      <button disabled={messageSaved} className="mt-2 px-2 py-1 disabled:bg-gray-300 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors" onClick={handleSaveAsNote}>
        {messageSaved ? 'Saved' : 'Save as Note'}
      </button>
    );
  }

  const heading = message.section ? <div className="text-xs text-amber-400 italic font-medium">- {message.section}</div> : null;

  return (
    <div className={`flex ${justify}`}>
      <div className={`rounded-lg px-3 py-2 ${styles} overflow-auto break-words`}>
        <div className={formatAsMarkdown ? 'markdown-body' : ''}>
          {type === 'note' && (
            <div className="text-xs text-amber-600 font-medium mb-1 flex items-center gap-1">
              <StickyNote size={12} /> Note {heading}
            </div>
          )}

          {formatAsMarkdown ? <Markdown content={content} /> : <div>{content}</div>}
        </div>
        {saveAIResponse}
      </div>
    </div>
  );
}
