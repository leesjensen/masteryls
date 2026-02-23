import React from 'react';
import { StickyNote, MessageCircle } from 'lucide-react';
import Markdown from '../Markdown';

export default function MessageBox({ message, handleSaveAsNote, setDiscussionContext }) {
  const { type, content } = message;

  let msgTitle, color, Icon, justify, styles, formatAsMarkdown;
  switch (type) {
    case 'user':
      justify = 'justify-end';
      styles = 'max-w-[80%] border-2 border-blue-500 text-gray-800';
      formatAsMarkdown = true;
      break;
    case 'note':
      msgTitle = 'Note';
      color = 'amber';
      Icon = StickyNote;
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
      msgTitle = 'Response';
      color = 'blue';
      Icon = MessageCircle;
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

  const heading = message.section ? (
    <div className={`text-xs text-${color}-400 italic font-medium cursor-pointer hover:text-${color}-500 transition-colors`} onClick={() => setDiscussionContext?.((prev) => ({ ...prev, section: message.section }))} title="Click to set as active heading">
      - {message.section}
    </div>
  ) : null;

  return (
    <div className={`flex ${justify}`}>
      <div className={`rounded-lg px-3 py-2 ${styles} overflow-auto break-words`}>
        <div className={formatAsMarkdown ? 'markdown-body' : ''}>
          {msgTitle && (
            <div className={`text-xs text-${color}-600 font-medium mb-1 flex items-center gap-1`}>
              <Icon size={12} /> {msgTitle} {heading}
            </div>
          )}

          {formatAsMarkdown ? <Markdown content={content} /> : <div>{content}</div>}
        </div>
        {saveAIResponse}
      </div>
    </div>
  );
}
