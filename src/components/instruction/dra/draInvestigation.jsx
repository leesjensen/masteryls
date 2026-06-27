import React from 'react';
import Markdown from '../../Markdown';

// The reasoning record fields the learner maintains throughout the investigation
// (see the design doc's Reasoning Record section).
const REASONING_FIELDS = [
  ['understanding', 'Current understanding'],
  ['assumptions', 'Assumptions'],
  ['unknowns', 'Unknowns'],
  ['hypotheses', 'Hypotheses'],
  ['decisions', 'Decisions'],
  ['evidence', 'Evidence'],
  ['confidence', 'Confidence'],
];

// Core interactive experience: the learner interviews stakeholders / consults resources
// through an in-character AI agent, and records their reasoning. All state is owned by
// the parent (persisted to the progress record); this component is presentational plus
// local chat-input/selection state.
export default function DraInvestigation({ scenario, targets, stages = [], activeStage = '', onSelectStage, conversations, reasoningRecord, onSendMessage, onReasoningChange, onReasoningBlur, readOnly, learningSession }) {
  const [selectedKey, setSelectedKey] = React.useState('');
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const messagesEndRef = React.useRef(null);

  React.useEffect(() => {
    if ((!selectedKey || !targets.some((t) => t.key === selectedKey)) && targets[0]) {
      setSelectedKey(targets[0].key);
    }
  }, [targets, selectedKey]);

  const selectedTarget = targets.find((t) => t.key === selectedKey) || null;
  const messages = conversations[selectedKey] || [];
  const activeStageInterpretation = stages.find((s) => s.stage === activeStage)?.interpretation || '';

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || readOnly || !selectedTarget) {
      return;
    }
    setSending(true);
    setInput('');
    try {
      await onSendMessage(selectedTarget, text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4">
      {stages.length > 0 && (
        <div className="not-prose mb-4">
          <div className="flex flex-wrap gap-1">
            {stages.map((s) => (
              <button key={s.stage} onClick={() => onSelectStage(s.stage)} disabled={readOnly} className={`px-3 py-1 rounded-full border text-sm disabled:opacity-60 ${s.stage === activeStage ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
                {s.stage}
              </button>
            ))}
          </div>
          {activeStageInterpretation && <p className="mt-2 text-sm text-gray-600">{activeStageInterpretation}</p>}
        </div>
      )}

      {targets.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No stakeholders or resources are revealed yet. Work through the scenario to uncover them.</p>
      ) : (
        <div className="not-prose flex flex-col sm:flex-row gap-4">
          <div className="sm:w-56 shrink-0 space-y-1">
            {targets.map((t) => (
              <button key={t.key} onClick={() => setSelectedKey(t.key)} className={`w-full text-left px-3 py-2 rounded border text-sm ${t.key === selectedKey ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                <div className="font-semibold truncate">{t.name}</div>
                <div className="text-xs text-gray-500 truncate">{t.type === 'stakeholder' ? t.role || 'Stakeholder' : t.type || 'Resource'}</div>
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0 border border-gray-200 rounded flex flex-col">
            <div className="flex-1 min-h-[160px] max-h-80 overflow-auto p-3 space-y-3">
              {messages.length === 0 && <p className="text-sm text-gray-400">Ask {selectedTarget?.name} a question to begin.</p>}
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <div className={`inline-block rounded px-3 py-2 text-sm max-w-[85%] text-left ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {m.role === 'user' ? m.text : <div className="markdown-body"><Markdown learningSession={learningSession} content={m.text} /></div>}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="text-left">
                  <div className="inline-block rounded px-3 py-2 text-sm bg-gray-100 text-gray-500">…</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {!readOnly && (
              <div className="border-t border-gray-200 p-2 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Ask ${selectedTarget?.name || ''}...`}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                  disabled={sending}
                />
                <button onClick={handleSend} disabled={sending || !input.trim()} className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-60">
                  Send
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="not-prose mt-6 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reasoning Record</div>
      <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REASONING_FIELDS.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">{label}</label>
            <textarea aria-label={label} value={reasoningRecord[key] || ''} onChange={(e) => onReasoningChange(key, e.target.value)} onBlur={onReasoningBlur} readOnly={readOnly} rows={3} className="w-full border border-gray-300 rounded px-2 py-1 text-sm read-only:bg-gray-50" />
          </div>
        ))}
      </div>
    </div>
  );
}
