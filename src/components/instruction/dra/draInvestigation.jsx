import React from 'react';
import { Blocks, Briefcase, Check, Database, FileText, Map, Server, UserRound } from 'lucide-react';
import DraMobilePicker from './DraMobilePicker';
import ChatPanel from '../../shared/ChatPanel';

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
  onUpdateStakeholderGroup,
  conversation,
  onSendMessage,
  readOnly,
  learningSession,
}) {
  const [draftInput, setDraftInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [mobilePickerOpen, setMobilePickerOpen] = React.useState(false);

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
  const selectedListeners = stakeholderTargets.filter((target) => selectedListenerKeys.includes(target.key));
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const participantTargets = React.useMemo(
    () => (selectedTarget?.type === 'stakeholder' ? [selectedTarget, ...selectedListeners] : selectedTarget ? [selectedTarget] : []),
    [selectedTarget, selectedListeners],
  );
  const draftPrimaryKey = React.useMemo(
    () => (selectedTarget?.type === 'stakeholder' ? detectDraftPrimary(draftInput, participantTargets) || selectedKey : selectedKey),
    [draftInput, participantTargets, selectedKey, selectedTarget],
  );
  const draftPrimaryTarget = participantTargets.find((target) => target.key === draftPrimaryKey) || selectedTarget;

  function toggleListener(targetKey) {
    const next = selectedListenerKeys.includes(targetKey)
      ? selectedListenerKeys.filter((key) => key !== targetKey)
      : [...selectedListenerKeys, targetKey];
    onSelectListenerKeys?.(next);
  }

  function handleStakeholderAffordance(target) {
    if (readOnly) return;

    if (selectedTarget?.type !== 'stakeholder') {
      onSelectTarget?.(target.key);
      return;
    }

    const isCurrent = target.key === selectedKey;
    const isInGroup = selectedListenerKeys.includes(target.key);

    if (!isCurrent && !isInGroup) {
      onSelectTarget?.(target.key);
      return;
    }

    if (!isCurrent && isInGroup) {
      toggleListener(target.key);
      return;
    }

    if (selectedListeners.length === 0) {
      return;
    }

    const nextDirectedTargetKey = selectedListenerKeys[selectedListenerKeys.length - 1];
    const nextListenerKeys = selectedListenerKeys.filter((key) => key !== nextDirectedTargetKey);
    onUpdateStakeholderGroup?.(nextDirectedTargetKey, nextListenerKeys);
  }

  function renderTargetButton(target) {
    const isSelected = target.key === selectedKey;
    const isStakeholder = target.type === 'stakeholder';
    const isInGroup = isStakeholder && (target.key === selectedKey || selectedListenerKeys.includes(target.key));
    const isDirected = draftPrimaryKey === target.key && target.type === 'stakeholder';

    return (
      <button
        key={target.key}
        onClick={() => (isStakeholder ? handleStakeholderAffordance(target) : onSelectTarget?.(target.key))}
        className={`w-full text-left px-3 py-2 rounded border text-sm ${
          isDirected
            ? 'border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-300'
            : isInGroup
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : isSelected
                ? 'border-blue-400 bg-blue-50 text-blue-800'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 shrink-0">{getTargetIcon(target)}</div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-tight break-words">{target.name}</div>
            <div className="text-xs text-gray-500 leading-tight break-words">{getResourceTypeLabel(target)}</div>
          </div>
          {isStakeholder && (
            <div className={`mt-0.5 shrink-0 rounded-full p-1 ${
              isDirected
                ? 'bg-amber-100 text-amber-700'
                : isInGroup
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-400'
            }`}>
              <Check size={14} />
            </div>
          )}
        </div>
      </button>
    );
  }

  function renderListenerSummary() {
    if (selectedTarget?.type !== 'stakeholder') return 'No stakeholders selected';
    const groupNames = [selectedTarget.name, ...selectedListeners.map((target) => target.name)];
    return groupNames.join(', ');
  }

  async function handleSend(text) {
    if (!selectedTarget) return;
    setSending(true);
    try {
      await onSendMessage(selectedTarget, text);
    } finally {
      setSending(false);
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
                <p className="px-1 pt-1 text-[11px] text-gray-500">Tap stakeholders to include them in the group. Mention a name first in chat to shift the primary response.</p>
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
              onSelect={(value) => {
                const target = sortedTargets.find((item) => item.key === value);
                if (!target) return;
                if (target.type === 'stakeholder') {
                  handleStakeholderAffordance(target);
                } else {
                  onSelectTarget?.(value);
                }
              }}
              className="w-[calc(100%-3.5rem)]"
              groups={[
                ...(stakeholderTargets.length > 0
                  ? [
                      {
                        label: 'Stakeholders',
                        items: stakeholderTargets.map((target) => ({
                          value: target.key,
                          label: target.name,
                          description: `${getResourceTypeLabel(target)}${draftPrimaryKey === target.key ? ' · addressing' : target.key === selectedKey || selectedListenerKeys.includes(target.key) ? ' · in group' : ''}`,
                          descriptionClassName: draftPrimaryKey === target.key ? 'text-amber-700' : target.key === selectedKey || selectedListenerKeys.includes(target.key) ? 'text-emerald-700' : 'text-gray-500',
                          icon: getTargetIcon(target),
                          selected: target.key === selectedKey || selectedListenerKeys.includes(target.key),
                          className: draftPrimaryKey === target.key
                            ? 'border border-amber-300 bg-amber-50 text-amber-900'
                            : target.key === selectedKey || selectedListenerKeys.includes(target.key)
                              ? 'border border-emerald-300 bg-emerald-50 text-emerald-900'
                              : 'text-gray-700 hover:bg-gray-50',
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
          {selectedTarget?.type === 'stakeholder' && <p className="mt-2 px-1 text-xs text-gray-500">Group: {renderListenerSummary()}. Re-open the stakeholder list to add or remove people.</p>}
        </div>

        <ChatPanel
          messages={messages}
          onSend={handleSend}
          learningSession={learningSession}
          sending={sending}
          readOnly={readOnly}
          placeholder={`Ask ${selectedTarget?.name || ''}…`}
          emptyText={`Ask ${selectedTarget?.name || 'a stakeholder'} a question to begin.`}
          onInputChange={setDraftInput}
          banner={draftPrimaryTarget?.type === 'stakeholder' ? (
            <div className={`mb-2 rounded-md border px-3 py-2 text-xs ${draftPrimaryTarget.key === selectedKey ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              Addressing <span className="font-semibold">{draftPrimaryTarget.name}</span>
            </div>
          ) : null}
        />
      </div>
    </div>
  );
}
