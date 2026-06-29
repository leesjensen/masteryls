import React from 'react';
import { Blocks, Briefcase, Database, FileText, Map, Server, UserRound } from 'lucide-react';
import Markdown from '../../Markdown';

const resourceTypeOrder = {
  person: 0,
  artifact: 1,
  system: 2,
  data: 3,
  environment: 4,
};

function getTargetCategory(target) {
  return target.type === 'stakeholder' ? 'stakeholder' : 'resource';
}

function getResourceTypeLabel(target) {
  if (target.type === 'stakeholder') return target.role || 'Stakeholder';
  if (!target.type) return 'Resource';
  return target.type.charAt(0).toUpperCase() + target.type.slice(1);
}

function getTargetIcon(target) {
  if (getTargetCategory(target) === 'stakeholder') {
    return <UserRound size={16} className="text-blue-600" />;
  }

  switch ((target.type || '').toLowerCase()) {
    case 'person':
      return <Briefcase size={16} className="text-amber-600" />;
    case 'artifact':
      return <FileText size={16} className="text-violet-600" />;
    case 'system':
      return <Server size={16} className="text-emerald-600" />;
    case 'data':
      return <Database size={16} className="text-cyan-700" />;
    case 'environment':
      return <Map size={16} className="text-rose-600" />;
    default:
      return <Blocks size={16} className="text-gray-500" />;
  }
}

export default function DraInvestigation({ targets, conversations, onSendMessage, readOnly, learningSession }) {
  const [selectedKey, setSelectedKey] = React.useState('');
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const lastMessageRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const sortedTargets = React.useMemo(() => (
    targets.map((target, index) => ({ ...target, originalIndex: index })).sort((a, b) => {
      const aCategory = getTargetCategory(a);
      const bCategory = getTargetCategory(b);

      if (aCategory !== bCategory) {
        return aCategory === 'stakeholder' ? -1 : 1;
      }

      if (aCategory === 'stakeholder') {
        return a.originalIndex - b.originalIndex;
      }

      if (aCategory === 'resource') {
        const aResourceRank = resourceTypeOrder[(a.type || '').toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
        const bResourceRank = resourceTypeOrder[(b.type || '').toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
        if (aResourceRank !== bResourceRank) return aResourceRank - bResourceRank;

        const typeCompare = (a.type || '').localeCompare(b.type || '');
        if (typeCompare !== 0) return typeCompare;
      }

      return (a.name || '').localeCompare(b.name || '');
    })
  ), [targets]);

  const stakeholderTargets = sortedTargets.filter((target) => getTargetCategory(target) === 'stakeholder');
  const resourceTargets = sortedTargets.filter((target) => getTargetCategory(target) === 'resource');

  React.useEffect(() => {
    if ((!selectedKey || !sortedTargets.some((t) => t.key === selectedKey)) && sortedTargets[0]) {
      setSelectedKey(sortedTargets[0].key);
    }
  }, [sortedTargets, selectedKey]);

  const selectedTarget = sortedTargets.find((t) => t.key === selectedKey) || null;
  const messages = conversations[selectedKey] || [];

  function renderTargetButton(target) {
    const isSelected = target.key === selectedKey;

    return (
      <button key={target.key} onClick={() => setSelectedKey(target.key)} className={`w-full text-left px-3 py-2 rounded border text-sm ${isSelected ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 shrink-0">{getTargetIcon(target)}</div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{target.name}</div>
            <div className="text-xs text-gray-500 truncate">{getResourceTypeLabel(target)}</div>
          </div>
        </div>
      </button>
    );
  }

  React.useEffect(() => {
    lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [messages.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || readOnly || !selectedTarget) return;
    setSending(true);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    try {
      await onSendMessage(selectedTarget, text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 min-h-0 gap-4 p-4">
      <div className="w-48 shrink-0 space-y-1 overflow-y-auto">
        {sortedTargets.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No stakeholders or resources are revealed yet. Work through the scenario to uncover them.</p>
        ) : (
          <>
            {stakeholderTargets.length > 0 && (
              <>
                <div className="px-1 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Stakeholders</div>
                {stakeholderTargets.map(renderTargetButton)}
              </>
            )}
            {resourceTargets.length > 0 && (
              <>
                <div className="px-1 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Resources</div>
                {resourceTargets.map(renderTargetButton)}
              </>
            )}
          </>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0 border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Ask {selectedTarget?.name} a question to begin.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} ref={i === messages.length - 1 ? lastMessageRef : null} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-lg px-3 py-2 max-w-[80%] break-words ${m.role === 'user' ? 'border-2 border-blue-500 text-gray-800' : 'border-2 border-gray-400'}`}>
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
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
                placeholder={`Ask ${selectedTarget?.name || ''}…`}
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
    </div>
  );
}
