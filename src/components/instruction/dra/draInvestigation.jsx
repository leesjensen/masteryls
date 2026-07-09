import React from 'react';
import { Blocks, Briefcase, Check, Database, FileText, Map, Server, UserRound, Users } from 'lucide-react';
import Markdown from '../../Markdown';
import DraMobilePicker from './DraMobilePicker';

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

function tokenizeStakeholderIdentifier(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function detectDraftPrimary(text, candidates = []) {
  const openingWords = tokenizeStakeholderIdentifier(text).slice(0, 6);
  if (openingWords.length === 0) return null;

  const candidateDescriptors = candidates
    .filter((candidate) => candidate?.key)
    .map((candidate) => ({
      key: candidate.key,
      words: [...new Set([...tokenizeStakeholderIdentifier(candidate.name), ...tokenizeStakeholderIdentifier(candidate.role)])],
      fullIdentifier: `${String(candidate.name || '').toLowerCase()} ${String(candidate.role || '').toLowerCase()}`.trim(),
    }));

  for (const word of openingWords) {
    const exactMatches = candidateDescriptors.filter((candidate) => candidate.words.includes(word));
    if (exactMatches.length === 1) return exactMatches[0].key;
    if (exactMatches.length > 1) continue;

    if (word.length < 2) continue;
    const prefixMatches = candidateDescriptors.filter((candidate) => candidate.words.some((candidateWord) => candidateWord.startsWith(word)));
    if (prefixMatches.length === 1) return prefixMatches[0].key;
  }

  const openingPhrase = openingWords.join(' ');
  if (!openingPhrase) return null;
  const phraseMatches = candidateDescriptors.filter((candidate) => candidate.fullIdentifier.includes(openingPhrase));
  return phraseMatches.length === 1 ? phraseMatches[0].key : null;
}

export default function DraInvestigation({
  targets,
  stakeholderTargets: providedStakeholderTargets = [],
  selectedKey,
  selectedListenerKeys = [],
  onSelectTarget,
  onSelectListenerKeys,
  conversation,
  onSendMessage,
  readOnly,
  learningSession,
}) {
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [mobilePickerOpen, setMobilePickerOpen] = React.useState(false);
  const [mobileListenerPickerOpen, setMobileListenerPickerOpen] = React.useState(false);
  const inputRef = React.useRef(null);
  const messageListRef = React.useRef(null);

  const sortedTargets = React.useMemo(
    () =>
      targets
        .map((target, index) => ({ ...target, originalIndex: index }))
        .sort((a, b) => {
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
        }),
    [targets],
  );

  const stakeholderTargets = providedStakeholderTargets.length > 0 ? providedStakeholderTargets : sortedTargets.filter((target) => getTargetCategory(target) === 'stakeholder');
  const resourceTargets = sortedTargets.filter((target) => getTargetCategory(target) === 'resource');

  React.useEffect(() => {
    if ((!selectedKey || !sortedTargets.some((t) => t.key === selectedKey)) && sortedTargets[0]) {
      onSelectTarget?.(sortedTargets[0].key);
    }
  }, [sortedTargets, selectedKey, onSelectTarget]);

  const selectedTarget = sortedTargets.find((t) => t.key === selectedKey) || null;
  const listenerOptions = stakeholderTargets.filter((target) => target.key !== selectedKey);
  const selectedListeners = listenerOptions.filter((target) => selectedListenerKeys.includes(target.key));
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const participantTargets = React.useMemo(
    () => (selectedTarget?.type === 'stakeholder' ? [selectedTarget, ...selectedListeners] : selectedTarget ? [selectedTarget] : []),
    [selectedTarget, selectedListeners],
  );
  const draftPrimaryKey = React.useMemo(
    () => (selectedTarget?.type === 'stakeholder' ? detectDraftPrimary(input, participantTargets) || selectedKey : selectedKey),
    [input, participantTargets, selectedKey, selectedTarget],
  );
  const draftPrimaryTarget = participantTargets.find((target) => target.key === draftPrimaryKey) || selectedTarget;

  function toggleListener(targetKey) {
    const next = selectedListenerKeys.includes(targetKey) ? selectedListenerKeys.filter((key) => key !== targetKey) : [...selectedListenerKeys, targetKey].slice(0, 2);
    onSelectListenerKeys?.(next);
  }

  function renderTargetButton(target) {
    const isSelected = target.key === selectedKey;
    const isDraftPrimary = draftPrimaryKey === target.key && target.type === 'stakeholder';
    const showPendingPrimary = isDraftPrimary && target.key !== selectedKey;

    return (
      <button
        key={target.key}
        onClick={() => onSelectTarget?.(target.key)}
        className={`w-full text-left px-3 py-2 rounded border text-sm ${
          showPendingPrimary
            ? 'border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-300'
            : isSelected
              ? 'border-blue-400 bg-blue-50 text-blue-800'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 shrink-0">{getTargetIcon(target)}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-semibold truncate">{target.name}</div>
              {showPendingPrimary && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Next primary</span>}
            </div>
            <div className="text-xs text-gray-500 truncate">{getResourceTypeLabel(target)}</div>
          </div>
        </div>
      </button>
    );
  }

  function renderListenerButton(target) {
    const selected = selectedListenerKeys.includes(target.key);
    const isDraftPrimary = draftPrimaryKey === target.key;

    return (
      <button
        key={target.key}
        type="button"
        onClick={() => toggleListener(target.key)}
        className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${
          isDraftPrimary
            ? 'border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-300'
            : selected
              ? 'border-blue-400 bg-blue-50 text-blue-800'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className="shrink-0">{selected ? <Check size={15} className="text-blue-600" /> : getTargetIcon(target)}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className="block truncate font-medium">{target.name}</span>
            {isDraftPrimary && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Next primary</span>}
          </span>
          <span className="block truncate text-xs text-gray-500">{target.role || 'Stakeholder'}</span>
        </span>
      </button>
    );
  }

  function renderListenerSummary() {
    if (selectedListeners.length === 0) return 'No additional stakeholders';
    return selectedListeners.map((target) => target.name).join(', ');
  }

  React.useLayoutEffect(() => {
    const container = messageListRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [selectedKey, messages.length]);

  React.useEffect(() => {
    if (!readOnly && !sending) {
      inputRef.current?.focus();
    }
  }, [selectedKey, messages.length, readOnly, sending]);

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
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex h-full flex-1 min-h-0 gap-4 overflow-hidden p-4">
      <div className="hidden md:block w-48 shrink-0 space-y-1 overflow-y-auto">
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
            {listenerOptions.length > 0 && (
              <>
                <div className="px-1 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Participants</div>
                <div className="space-y-1">
                  {listenerOptions.map(renderListenerButton)}
                </div>
                <p className="px-1 pt-1 text-[11px] text-gray-500">Add up to 2 more stakeholders to the discussion.</p>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex-1 flex min-h-0 flex-col gap-3 overflow-hidden">
        <div className="md:hidden shrink-0 overflow-visible px-1 pt-1">
          {sortedTargets.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No stakeholders or resources are revealed yet. Work through the scenario to uncover them.</p>
          ) : (
            <DraMobilePicker
              id="dra-mobile-target-select"
              value={selectedKey}
              valueLabel={selectedTarget ? `${selectedTarget.name} - ${getResourceTypeLabel(selectedTarget)}` : 'Select a target'}
              valueIcon={selectedTarget ? getTargetIcon(selectedTarget) : <UserRound size={16} className="text-gray-400" />}
              isOpen={mobilePickerOpen}
              onToggle={() => setMobilePickerOpen((open) => !open)}
              onClose={() => setMobilePickerOpen(false)}
              onSelect={(value) => onSelectTarget?.(value)}
              className="w-[calc(100%-3.5rem)]"
              groups={[
                ...(stakeholderTargets.length > 0
                  ? [
                      {
                        label: 'Stakeholders',
                        items: stakeholderTargets.map((target) => ({
                          value: target.key,
                          label: target.name,
                          description: getResourceTypeLabel(target),
                          icon: getTargetIcon(target),
                          selected: target.key === selectedKey,
                        })),
                      },
                    ]
                  : []),
                ...(resourceTargets.length > 0
                  ? [
                      {
                        label: 'Resources',
                        items: resourceTargets.map((target) => ({
                          value: target.key,
                          label: target.name,
                          description: getResourceTypeLabel(target),
                          icon: getTargetIcon(target),
                          selected: target.key === selectedKey,
                        })),
                      },
                    ]
                  : []),
              ]}
            />
          )}
          {listenerOptions.length > 0 && (
            <div className="mt-2">
              <DraMobilePicker
                id="dra-mobile-listener-select"
                value={selectedListenerKeys.join(',')}
                valueLabel={renderListenerSummary()}
                valueIcon={<Users size={16} className="text-blue-600" />}
                isOpen={mobileListenerPickerOpen}
                onToggle={() => setMobileListenerPickerOpen((open) => !open)}
                onClose={() => setMobileListenerPickerOpen(false)}
                onSelect={toggleListener}
                className="w-[calc(100%-3.5rem)]"
                menuClassName="space-y-2"
                groups={[
                  {
                    label: 'Additional stakeholders',
                    items: listenerOptions.map((target) => ({
                      value: target.key,
                      label: target.name,
                      description: `${target.role || 'Stakeholder'}${selectedListenerKeys.includes(target.key) ? ' · selected' : ''}`,
                      icon: selectedListenerKeys.includes(target.key) ? <Check size={16} className="text-blue-600" /> : getTargetIcon(target),
                      selected: selectedListenerKeys.includes(target.key),
                    })),
                  },
                ]}
              />
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0 border border-gray-200 rounded-lg overflow-hidden">
          <div ref={messageListRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Ask {selectedTarget?.name} a question to begin.</p>}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg px-3 py-2 max-w-[80%] break-words ${m.role === 'user' ? 'border-2 border-blue-500 text-gray-800' : 'border-2 border-gray-400'}`}>
                  {m.role === 'model' && (m.speakerName || m.speakerRole) && (
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {m.speakerName || 'Scenario'}{m.speakerRole ? ` · ${m.speakerRole}` : ''}
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
              {draftPrimaryTarget?.type === 'stakeholder' && (
                <div className={`mb-2 rounded-md border px-3 py-2 text-xs ${
                  draftPrimaryTarget.key === selectedKey
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}>
                  <span className="font-semibold">{draftPrimaryTarget.name}</span> will respond first
                </div>
              )}
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
    </div>
  );
}
