import React from 'react';
import Markdown from '../Markdown';

export default function ChatPanel({
  messages = [],
  onSend,
  learningSession,
  sending = false,
  readOnly = false,
  placeholder = 'Type a message…',
  emptyText = 'No messages yet.',
  banner = null,
  onInputChange,
}) {
  const [input, setInput] = React.useState('');
  const inputRef = React.useRef(null);
  const messageListRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const container = messageListRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length, sending]);

  React.useEffect(() => {
    if (!readOnly && !sending) inputRef.current?.focus();
  }, [messages.length, readOnly, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || readOnly) return;
    setInput('');
    onInputChange?.('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    await onSend(text);
    inputRef.current?.focus();
  }

  function handleChange(e) {
    setInput(e.target.value);
    onInputChange?.(e.target.value);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 border border-gray-200 rounded-lg overflow-hidden">
      <div ref={messageListRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !sending && (
          <p className="text-sm text-gray-400 text-center py-8">{emptyText}</p>
        )}
        {messages.map((m, i) => (
          <div key={m.id || i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-lg px-3 py-2 max-w-[80%] break-words ${m.role === 'user' ? 'border-2 border-blue-500 text-gray-800' : 'border-2 border-gray-400'}`}>
              {m.role === 'model' && (m.speakerName || m.speakerRole) && (
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {m.speakerName}{m.speakerRole ? ` · ${m.speakerRole}` : ''}
                </div>
              )}
              <div className="markdown-body text-sm">
                <Markdown learningSession={learningSession} content={m.text} />
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 border-2 border-gray-300 bg-gray-50">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-3">
          {banner}
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={1}
              style={{ minHeight: '2.5rem', maxHeight: '7.5rem' }}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
