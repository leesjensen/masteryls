import React from 'react';
import Markdown from '../../Markdown';
import { parseDraMarkdown } from '../../../utils/draMarkdown';
import { summarizeDraRun } from './draScore';
import DraInvestigation from './draInvestigation';
import DraEvaluation from './draEvaluation';
import CoachPanel from '../../shared/CoachPanel';
import TabBar from '../../shared/TabBar';
import Splitter from '../../Splitter';
import useSplitPaneState from '../../../hooks/useSplitPaneState';
import DraAssessment from './DraAssessment';
import Spinner from '../../Spinner';
import { FileText, MessageSquare, Search, Network, Play, CheckCircle2, RefreshCcw, Lightbulb, BadgeCheck, CircleDashed } from 'lucide-react';
import DraMobilePicker from './DraMobilePicker';
import { DRA_FIXED_STAGES, createDraStageNotes, getDraStageDefinition, getFirstDraStage, getDraStageNames, normalizeDraProcessAttributeName, normalizeDraStageName } from '../../../utils/draStages';

// Difficulty (1 easiest .. 5 hardest) gates how much of the scenario is revealed up
// front. Withheld stakeholders and resources are still generated and saved — they
// become things the learner discovers during the investigation.
export function scenarioDisclosure(difficulty) {
  const d = Number(difficulty);
  const level = Number.isFinite(d) ? Math.min(5, Math.max(1, Math.round(d))) : 3;
  return {
    detail: level <= 3 ? 'full' : 'summary',
    showConstraints: level <= 3,
    showStakeholders: level <= 2,
    showResources: level <= 1,
  };
}

function ScenarioView({ details, difficulty, learningSession }) {
  const disclosure = scenarioDisclosure(difficulty);
  const body = disclosure.detail === 'full' ? details.scenario?.description : details.scenario?.summary;
  const constraints = disclosure.showConstraints ? details.constraints || [] : [];
  const stakeholders = disclosure.showStakeholders ? details.stakeholders || [] : [];
  const resources = disclosure.showResources ? details.resources || [] : [];
  const somethingWithheld = disclosure.detail !== 'full' || !disclosure.showConstraints || !disclosure.showStakeholders || !disclosure.showResources;

  return (
    <>
      {details.scenario?.title && <h3>{details.scenario.title}</h3>}
      <Markdown learningSession={learningSession} content={body || ''} />

      {constraints.length > 0 && (
        <>
          <h3>Constraints</h3>
          <ul>
            {constraints.map((c, i) => (
              <li key={i}>
                <strong>{c.name}</strong>
                {c.description ? ` — ${c.description}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}

      {stakeholders.length > 0 && (
        <>
          <h3>Stakeholders</h3>
          <ul>
            {stakeholders.map((s, i) => (
              <li key={i}>
                <strong>{s.name}</strong>
                {s.role ? ` — ${s.role}` : ''}
                {s.objectives ? `. ${s.objectives}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}

      {resources.length > 0 && (
        <>
          <h3>Resources</h3>
          <ul>
            {resources.map((r, i) => (
              <li key={i}>
                <strong>{r.name}</strong>
                {r.type ? ` (${r.type})` : ''}
                {r.description ? ` — ${r.description}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}

      {somethingWithheld && <p className="not-prose mt-3 text-sm text-gray-500 italic">Additional details, stakeholders, and resources are revealed through your work in the Workspace tab.</p>}
    </>
  );
}

function createEmptyDraState() {
  return {
    practiceScenarios: [],
    selectedPracticeScenarioId: null,
    finalScenario: null,
  };
}

function makeConversationKey(primaryTargetKey, listenerTargetKeys = []) {
  const allTargetKeys = [...new Set([primaryTargetKey, ...(listenerTargetKeys || [])].filter(Boolean))].sort();
  return `participants:${allTargetKeys.join(',')}`;
}

function parseConversationKey(conversationKey) {
  const text = String(conversationKey || '');
  if (text.startsWith('participants:')) {
    const participantKeys = text.slice('participants:'.length).split(',').filter(Boolean);
    return {
      primaryTargetKey: participantKeys[0] || '',
      listenerTargetKeys: participantKeys.slice(1),
      participantTargetKeys: participantKeys,
    };
  }

  const [primaryPart = '', listenersPart = ''] = text.split('|');
  const primaryTargetKey = primaryPart.startsWith('primary:') ? primaryPart.slice('primary:'.length) : '';
  const listenerTargetKeys = listenersPart.startsWith('listeners:') ? listenersPart.slice('listeners:'.length).split(',').filter(Boolean) : [];
  const participantTargetKeys = [...new Set([primaryTargetKey, ...listenerTargetKeys].filter(Boolean))];
  return { primaryTargetKey, listenerTargetKeys, participantTargetKeys };
}

function tokenizeStakeholderIdentifier(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function detectMentionedStakeholderPrimary(text, candidates = []) {
  const openingWords = tokenizeStakeholderIdentifier(text).slice(0, 6);
  if (openingWords.length === 0) return null;

  const candidateDescriptors = candidates
    .filter((candidate) => candidate?.key)
    .map((candidate) => ({
      key: candidate.key,
      words: [...new Set([...tokenizeStakeholderIdentifier(candidate.name), ...tokenizeStakeholderIdentifier(candidate.role)])],
      fullName: String(candidate.name || '').toLowerCase(),
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

  let bestMatch = null;
  candidateDescriptors.forEach((candidate) => {
    const fullMatchIndex = candidate.fullIdentifier.indexOf(openingPhrase);
    if (fullMatchIndex === -1) return;
    if (!bestMatch || fullMatchIndex < bestMatch.index || candidate.fullIdentifier.length > bestMatch.identifier.length) {
      bestMatch = {
        key: candidate.key,
        index: fullMatchIndex,
        identifier: candidate.fullIdentifier,
      };
    }
  });

  return bestMatch?.key || null;
}

function normalizeConversationMessage(message, fallbackTarget = null) {
  if (!message || typeof message !== 'object') return null;
  const role = message.role === 'model' ? 'model' : 'user';
  const text = typeof message.text === 'string' ? message.text : '';
  if (!text.trim()) return null;
  if (role === 'user') {
    return {
      role,
      text,
      stage: message.stage || '',
      turnId: message.turnId || '',
    };
  }

  return {
    role,
    text,
    stage: message.stage || '',
    turnId: message.turnId || '',
    speakerKey: message.speakerKey || fallbackTarget?.key || '',
    speakerName: message.speakerName || fallbackTarget?.name || '',
    speakerRole: message.speakerRole || fallbackTarget?.role || fallbackTarget?.type || '',
  };
}

function buildScenarioTargetMap(scenario) {
  const map = new Map();

  (scenario?.stakeholders || []).forEach((stakeholder, index) => {
    map.set(`stakeholder:${index}`, { key: `stakeholder:${index}`, type: 'stakeholder', ...stakeholder });
  });

  (scenario?.resources || []).forEach((resource, index) => {
    map.set(`resource:${index}`, { key: `resource:${index}`, type: 'resource', ...resource });
  });

  (scenario?.identified || []).forEach((target, index) => {
    map.set(`identified:${index}`, { key: `identified:${index}`, type: target.kind || 'stakeholder', ...target });
  });

  return map;
}

function normalizeScenarioDetails(scenario) {
  if (!scenario || typeof scenario !== 'object') return scenario;

  const targetMap = buildScenarioTargetMap(scenario);
  const rawConversations = scenario.conversations && typeof scenario.conversations === 'object' ? scenario.conversations : {};
  const normalizedConversations = {};

  Object.entries(rawConversations).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const fallbackTarget = targetMap.get(key) || null;
      const messages = value.map((message) => normalizeConversationMessage(message, fallbackTarget)).filter(Boolean);
      normalizedConversations[makeConversationKey(key, [])] = {
        primaryTargetKey: key,
        listenerTargetKeys: [],
        messages,
      };
      return;
    }

    if (value && typeof value === 'object') {
      const primaryTargetKey = typeof value.primaryTargetKey === 'string' && value.primaryTargetKey ? value.primaryTargetKey : parseConversationKey(key).primaryTargetKey;
      const listenerTargetKeys = Array.isArray(value.listenerTargetKeys) ? value.listenerTargetKeys.filter((item) => typeof item === 'string' && item) : parseConversationKey(key).listenerTargetKeys;
      const fallbackTarget = targetMap.get(primaryTargetKey) || null;
      const messages = Array.isArray(value.messages) ? value.messages.map((message) => normalizeConversationMessage(message, fallbackTarget)).filter(Boolean) : [];
      normalizedConversations[makeConversationKey(primaryTargetKey, listenerTargetKeys)] = {
        primaryTargetKey,
        listenerTargetKeys: [...new Set(listenerTargetKeys)].sort(),
        messages,
      };
    }
  });

  const normalizedEvaluation =
    scenario.evaluation && typeof scenario.evaluation === 'object'
      ? {
          ...scenario.evaluation,
          process:
            scenario.evaluation.process && typeof scenario.evaluation.process === 'object'
              ? {
                  ...scenario.evaluation.process,
                  attributes: Array.isArray(scenario.evaluation.process.attributes)
                    ? scenario.evaluation.process.attributes.map((attribute) => ({
                        ...attribute,
                        name: normalizeDraProcessAttributeName(attribute?.name),
                      }))
                    : scenario.evaluation.process.attributes,
                }
              : scenario.evaluation.process,
        }
      : scenario.evaluation;

  const { stages: _ignoredStages, ...rest } = scenario;
  return {
    ...rest,
    stageNotes: createDraStageNotes(scenario.stageNotes),
    evaluation: normalizedEvaluation,
    conversations: normalizedConversations,
  };
}

function normalizeDraState(state) {
  if (!state || typeof state !== 'object') return createEmptyDraState();

  const practiceScenarios = Array.isArray(state.practiceScenarios) ? state.practiceScenarios.filter((item) => item && typeof item === 'object' && item.scenarioRunId).map(normalizeScenarioDetails) : [];
  const selectedPracticeScenarioId = typeof state.selectedPracticeScenarioId === 'string' && practiceScenarios.some((item) => item.scenarioRunId === state.selectedPracticeScenarioId) ? state.selectedPracticeScenarioId : null;
  const finalScenario = state.finalScenario && typeof state.finalScenario === 'object' && state.finalScenario.scenarioRunId ? normalizeScenarioDetails(state.finalScenario) : null;

  return { practiceScenarios, selectedPracticeScenarioId, finalScenario };
}

function formatScenarioLabel(details, index) {
  const title = details?.scenario?.title || `Practice scenario ${index + 1}`;
  const status = details?.state === 'completed' ? 'Completed' : details?.state === 'inProgress' ? 'In progress' : 'Draft';
  return `${title} (${status})`;
}

function formatScenarioDate(value, fallback) {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function findInProgressPracticeScenario(practiceScenarios) {
  return (practiceScenarios || []).find((scenario) => scenario?.mode === 'practice' && scenario?.state === 'inProgress') || null;
}

function getStageIcon(stage) {
  switch (normalizeDraStageName(stage).toLowerCase()) {
    case 'understand':
      return <Lightbulb size={16} className="text-amber-600" />;
    case 'investigate':
      return <Search size={16} className="text-cyan-700" />;
    case 'plan':
      return <Network size={16} className="text-violet-600" />;
    case 'propose':
      return <Play size={16} className="text-blue-600" />;
    case 'evaluate':
      return <CheckCircle2 size={16} className="text-emerald-600" />;
    case 'reflect':
      return <RefreshCcw size={16} className="text-rose-600" />;
    default:
      return <FileText size={16} className="text-gray-500" />;
  }
}

export default function DraInstruction({ courseOps, learningSession, user, content = null, instructionState = 'learning' }) {
  const [markdown, setMarkdown] = React.useState(content || '');
  const [draState, setDraState] = React.useState(createEmptyDraState());
  const [loading, setLoading] = React.useState(true);
  const [busyAction, setBusyAction] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [evaluating, setEvaluating] = React.useState(false);
  const [coaching, setCoaching] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [activeStage, setActiveStage] = React.useState('');
  const [selectedTargetKey, setSelectedTargetKey] = React.useState('');
  const [selectedListenerTargetKeys, setSelectedListenerTargetKeys] = React.useState([]);
  const [mobileInvestigationView, setMobileInvestigationView] = React.useState('chat');
  const [isMobileInvestigationLayout, setIsMobileInvestigationLayout] = React.useState(false);
  const [mobileStagePickerOpen, setMobileStagePickerOpen] = React.useState(false);
  const courseId = learningSession?.course?.id;
  const topicId = learningSession?.topic?.id;
  const { panePercent: investigationPanePercent, splitContainerRef: investigationSplitRef, onPaneMoved: onInvestigationPaneMoved, onPaneResized: onInvestigationPaneResized } = useSplitPaneState(55);
  const isObserveReadOnly = Boolean(learningSession?.observeMode);
  const isPreview = instructionState === 'preview';

  React.useEffect(() => {
    if (content != null) {
      setMarkdown(content);
      return;
    }
    const topic = learningSession?.topic;
    if (!topic || topic.type !== 'dra') return;
    courseOps.getTopic(topic).then((md) => setMarkdown(md || ''));
  }, [content, learningSession?.topic]);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncLayoutMode = (event) => setIsMobileInvestigationLayout(event.matches);
    syncLayoutMode(mediaQuery);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncLayoutMode);
      return () => mediaQuery.removeEventListener('change', syncLayoutMode);
    }
    mediaQuery.addListener(syncLayoutMode);
    return () => mediaQuery.removeListener(syncLayoutMode);
  }, []);

  React.useEffect(() => {
    setDraState(createEmptyDraState());
    setActiveTab('overview');
    setActiveStage('');
    setSelectedTargetKey('');
    setSelectedListenerTargetKeys([]);
    setMobileInvestigationView('chat');
    setLoading(true);

    async function loadState() {
      try {
        if (!isPreview && user && learningSession?.enrollment) {
          const state = await courseOps.getDraState();
          const normalizedState = normalizeDraState(state);
          const activeScenario = normalizedState.practiceScenarios.find((s) => s.scenarioRunId === normalizedState.selectedPracticeScenarioId) || normalizedState.finalScenario || {};
          // Prevent the state-change effect below from overriding our tab restoration.
          prevStateRef.current = activeScenario.state;
          setDraState(normalizedState);

          const uiSettings = courseId && topicId ? courseOps.getEnrollmentUiSettings(courseId) : null;

          const savedStage = normalizeDraStageName(uiSettings?.[`draActiveStage_${topicId}`]);
          const stageNames = getDraStageNames();
          if (savedStage && stageNames.includes(savedStage)) {
            setActiveStage(savedStage);
          } else {
            setActiveStage(getFirstDraStage());
          }

          const savedTab = uiSettings?.[`draActiveTab_${topicId}`];
          if (savedTab) setActiveTab(savedTab);

          const savedTargetKey = uiSettings?.[`draSelectedTarget_${topicId}`];
          if (savedTargetKey) setSelectedTargetKey(savedTargetKey);

          const savedListenerKeys = uiSettings?.[`draSelectedListeners_${topicId}`];
          if (Array.isArray(savedListenerKeys)) {
            setSelectedListenerTargetKeys(savedListenerKeys.filter((item) => typeof item === 'string' && item));
          }

          const savedInvestigationView = uiSettings?.[`draInvestigationMobileView_${topicId}`];
          if (savedInvestigationView === 'chat' || savedInvestigationView === 'record') {
            setMobileInvestigationView(savedInvestigationView);
          }
        }
      } catch (err) {
        console.error('Failed to load DRA state:', err);
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, [isPreview, user, learningSession?.enrollment, topicId]);

  const params = React.useMemo(() => parseDraMarkdown(markdown), [markdown]);
  const practiceScenarios = draState.practiceScenarios || [];
  const selectedPracticeScenarioId = draState.selectedPracticeScenarioId || null;
  const finalScenario = draState.finalScenario || null;
  const details = practiceScenarios.find((s) => s.scenarioRunId === selectedPracticeScenarioId) || finalScenario || { state: 'notStarted' };
  const busy = busyAction !== null;
  const inProgressPracticeScenario = findInProgressPracticeScenario(practiceScenarios);
  const hasScenarioInProgress = Boolean(inProgressPracticeScenario);
  const viewingPreviousScenario = Boolean(inProgressPracticeScenario?.scenarioRunId && details?.scenarioRunId && details.scenarioRunId !== inProgressPracticeScenario.scenarioRunId);
  const draReadOnly = isObserveReadOnly || viewingPreviousScenario;

  function selectTab(tab) {
    setActiveTab(tab);
    if (courseId && topicId) {
      courseOps.saveEnrollmentUiSettings(courseId, { [`draActiveTab_${topicId}`]: tab });
    }
  }

  // Switch to relevant tab when assessment state changes (not on initial load — see loadState).
  const prevStateRef = React.useRef('notStarted');
  React.useEffect(() => {
    if (prevStateRef.current !== details.state) {
      prevStateRef.current = details.state;
      if (details.state === 'inProgress') selectTab('scenario');
      if (details.state === 'notStarted') selectTab('overview');
    }
  }, [details.state]);

  function applyStateUpdate(nextDetails, options = {}) {
    const { preserveSelection = false } = options;

    setDraState((prev) => {
      const current = normalizeDraState(prev);

      if (nextDetails?.mode === 'final') {
        return { practiceScenarios: current.practiceScenarios, selectedPracticeScenarioId: current.selectedPracticeScenarioId, finalScenario: nextDetails };
      }

      if (nextDetails?.mode === 'practice' && nextDetails?.scenarioRunId) {
        const existingIndex = current.practiceScenarios.findIndex((item) => item.scenarioRunId === nextDetails.scenarioRunId);
        const nextPracticeScenarios = existingIndex === -1 ? [...current.practiceScenarios, nextDetails] : current.practiceScenarios.map((item, index) => (index === existingIndex ? nextDetails : item));
        const nextSelectedId = preserveSelection ? current.selectedPracticeScenarioId : nextDetails.scenarioRunId;
        return { practiceScenarios: nextPracticeScenarios, selectedPracticeScenarioId: nextSelectedId, finalScenario: current.finalScenario };
      }

      return current;
    });
    setIsDirty(true);
  }

  // The run whose score/items represent the topic in enrollment.progress: the final run
  // when one exists (it is the graded assessment), otherwise the selected/latest practice run.
  function pickSummaryRun(state) {
    const s = normalizeDraState(state);
    if (s.finalScenario) return s.finalScenario;
    return s.practiceScenarios.find((r) => r.scenarioRunId === s.selectedPracticeScenarioId) || s.practiceScenarios[s.practiceScenarios.length - 1] || null;
  }

  // Roll the graded run into enrollment.progress (score/items/state/last-activity). The
  // history row is throttled by courseOps unless `force`.
  async function syncDraProgress(state, { force = false } = {}) {
    if (draReadOnly || !courseOps.updateDraProgress) return;
    const run = pickSummaryRun(state);
    if (!run || run.state === 'notStarted') return;
    const summary = summarizeDraRun(run, run.difficulty ?? params.difficulty);
    try {
      await courseOps.updateDraProgress(
        { state: run.state, mode: run.mode, itemsCompleted: summary.itemsCompleted, totalItems: summary.totalItems, masteryScore: summary.score },
        { force },
      );
    } catch {
      // progress reporting is best-effort; never block the learner's save
    }
  }

  // Auto-saves without marking dirty — used for definitive actions (generate, cancel, complete).
  async function autoSaveState(nextState, { forceProgressRow = false } = {}) {
    const normalizedState = normalizeDraState(nextState);
    setDraState(normalizedState);
    setIsDirty(false);
    if (!draReadOnly) {
      await courseOps.saveDraState(normalizedState);
      await syncDraProgress(normalizedState, { force: forceProgressRow });
    }
  }

  async function autoSaveDetails(nextDetails, options = {}) {
    const current = normalizeDraState(draState);
    let nextPracticeScenarios = current.practiceScenarios;
    let nextSelectedPracticeScenarioId = current.selectedPracticeScenarioId;
    let nextFinalScenario = current.finalScenario;

    if (nextDetails?.mode === 'final') {
      nextFinalScenario = nextDetails;
      nextSelectedPracticeScenarioId = null;
    } else if (nextDetails?.mode === 'practice' && nextDetails?.scenarioRunId) {
      const existingIndex = current.practiceScenarios.findIndex((item) => item.scenarioRunId === nextDetails.scenarioRunId);
      if (existingIndex === -1) {
        nextPracticeScenarios = [...current.practiceScenarios, nextDetails];
      } else {
        nextPracticeScenarios = current.practiceScenarios.map((item, index) => (index === existingIndex ? nextDetails : item));
      }
      nextSelectedPracticeScenarioId = options.selectPracticeScenarioId ?? nextDetails.scenarioRunId;
    }

    await autoSaveState({ practiceScenarios: nextPracticeScenarios, selectedPracticeScenarioId: nextSelectedPracticeScenarioId, finalScenario: nextFinalScenario }, { forceProgressRow: options.forceProgressRow });
  }

  async function handleSave() {
    if (!isDirty || saving || draReadOnly) return;
    setSaving(true);
    try {
      await courseOps.saveDraState(draState);
      await syncDraProgress(draState);
      setIsDirty(false);
    } catch {
      alert('Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  React.useEffect(() => {
    function handleBeforeUnload(e) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  function selectStage(stage) {
    const normalizedStage = normalizeDraStageName(stage);
    if (!normalizedStage || activeStage === normalizedStage) return;
    setActiveStage(normalizedStage);
    if (courseId && topicId) {
      courseOps.saveEnrollmentUiSettings(courseId, { [`draActiveStage_${topicId}`]: normalizedStage });
    }
  }

  function updateStakeholderGroup(nextTargetKey, nextListenerKeys) {
    setSelectedTargetKey(nextTargetKey);
    setSelectedListenerTargetKeys(nextListenerKeys);
    if (courseId && topicId) {
      courseOps.saveEnrollmentUiSettings(courseId, {
        [`draSelectedTarget_${topicId}`]: nextTargetKey,
        [`draSelectedListeners_${topicId}`]: nextListenerKeys,
      });
    }
  }

  function selectTarget(targetKey, options = {}) {
    const { preserveCurrentInGroup = true } = options;
    if (!targetKey || selectedTargetKey === targetKey) return;
    const nextTarget = details.stakeholders?.find((_, index) => `stakeholder:${index}` === targetKey) || details.resources?.find((_, index) => `resource:${index}` === targetKey) || details.identified?.find((_, index) => `identified:${index}` === targetKey);
    const nextTargetType = targetKey.startsWith('resource:') ? 'resource' : nextTarget?.kind || nextTarget?.type || 'stakeholder';
    let nextListenerKeys = selectedListenerTargetKeys.filter((key) => key !== targetKey);

    if (nextTargetType === 'stakeholder' && selectedTargetKey && stakeholderTargets.some((target) => target.key === selectedTargetKey) && preserveCurrentInGroup) {
      nextListenerKeys = [...nextListenerKeys, selectedTargetKey].filter((key, index, list) => list.indexOf(key) === index);
    }

    if (nextTargetType !== 'stakeholder') {
      nextListenerKeys = [];
    }

    updateStakeholderGroup(targetKey, nextListenerKeys);
  }

  function selectListenerTargetKeys(listenerTargetKeys) {
    const normalizedKeys = [...new Set((listenerTargetKeys || []).filter((key) => key && key !== selectedTargetKey))];
    updateStakeholderGroup(selectedTargetKey, normalizedKeys);
  }

  function selectMobileInvestigationView(view) {
    if (view !== 'chat' && view !== 'record') return;
    setMobileInvestigationView(view);
    if (courseId && topicId) {
      courseOps.saveEnrollmentUiSettings(courseId, { [`draInvestigationMobileView_${topicId}`]: view });
    }
  }

  // Scan a reply for hidden stakeholders/resources by exact name match. The AI prompt
  // now instructs the model to use only predefined names, so exact matching is reliable.
  function detectNewTargets(replyText, currentDetails) {
    const disclosure = scenarioDisclosure(currentDetails.difficulty ?? params.difficulty);
    const lowerReply = replyText.toLowerCase();

    const knownNames = new Set([(currentDetails.stakeholders || [])[0]?.name, ...(disclosure.showStakeholders ? (currentDetails.stakeholders || []).map((s) => s.name) : []), ...(disclosure.showResources ? (currentDetails.resources || []).map((r) => r.name) : []), ...(currentDetails.identified || []).map((t) => t.name)].filter(Boolean));

    const found = [];
    for (const s of currentDetails.stakeholders || []) {
      if (!knownNames.has(s.name) && lowerReply.includes(s.name.toLowerCase())) {
        found.push({ ...s, kind: 'stakeholder' });
      }
    }
    for (const r of currentDetails.resources || []) {
      if (!knownNames.has(r.name) && lowerReply.includes(r.name.toLowerCase())) {
        found.push({ ...r, kind: 'resource' });
      }
    }
    return found;
  }

  async function sendInvestigationMessage(target, text) {
    const conversations = details.conversations || {};
    const participantTargets = target.type === 'stakeholder' ? [target, ...listenerTargets] : [target];
    const listenerTargetKeys = participantTargets.filter((item) => item.key !== target.key).map((item) => item.key);
    const addressedPrimaryKey = target.type === 'stakeholder' ? detectMentionedStakeholderPrimary(text, participantTargets) || target.key : target.key;
    const addressedPrimaryTarget = participantTargets.find((item) => item.key === addressedPrimaryKey) || target;
    const addressedListenerTargets = participantTargets.filter((item) => item.key !== addressedPrimaryTarget.key);
    const conversationKey = makeConversationKey(
      addressedPrimaryTarget.key,
      addressedListenerTargets.map((item) => item.key),
    );
    const currentConversation = conversations[conversationKey] || {
      primaryTargetKey: addressedPrimaryTarget.key,
      listenerTargetKeys: addressedListenerTargets.map((item) => item.key),
      messages: [],
    };
    const turnId = crypto.randomUUID();
    const withUser = [...(currentConversation.messages || []), { role: 'user', text, stage: activeStage, turnId }];
    applyStateUpdate({
      ...details,
      conversations: {
        ...conversations,
        [conversationKey]: {
          primaryTargetKey: addressedPrimaryTarget.key,
          listenerTargetKeys: addressedListenerTargets.map((item) => item.key),
          messages: withUser,
        },
      },
    });

    try {
      if (addressedPrimaryTarget.key !== selectedTargetKey) {
        selectTarget(addressedPrimaryTarget.key);
      }
      const replies = await courseOps.getDraStakeholderResponse(details.scenario, addressedPrimaryTarget, addressedListenerTargets, withUser, details.stakeholders || [], details.resources || [], details.difficulty ?? params.difficulty, activeStage);
      const normalizedReplies = (Array.isArray(replies) ? replies : [])
        .map((reply) => ({
          role: 'model',
          text: typeof reply?.text === 'string' ? reply.text : '',
          stage: activeStage,
          turnId,
          speakerKey: reply?.speakerKey || target.key,
          speakerName: reply?.speakerName || target.name || '',
          speakerRole: reply?.speakerRole || target.role || target.type || '',
        }))
        .filter((reply) => reply.text.trim());
      const nextConversations = {
        ...conversations,
        [conversationKey]: {
          primaryTargetKey: addressedPrimaryTarget.key,
          listenerTargetKeys: addressedListenerTargets.map((item) => item.key),
          messages: [...withUser, ...normalizedReplies],
        },
      };
      const newTargets = detectNewTargets(normalizedReplies.map((reply) => reply.text).join('\n'), details);
      applyStateUpdate({
        ...details,
        conversations: nextConversations,
        ...(newTargets.length > 0 && { identified: [...(details.identified || []), ...newTargets] }),
      });
    } catch {
      applyStateUpdate({
        ...details,
        conversations: {
          ...conversations,
          [conversationKey]: {
            primaryTargetKey: addressedPrimaryTarget.key,
            listenerTargetKeys: addressedListenerTargets.map((item) => item.key),
            messages: withUser,
          },
        },
      });
      alert('The interview partner could not respond. Please try again.');
    }
  }

  function updateStageNote(stage, value) {
    const current = details.stageNotes?.[stage] || '';
    if (value.trim() === current.trim()) return;
    applyStateUpdate({ ...details, stageNotes: { ...(details.stageNotes || {}), [stage]: value } });
  }

  async function generateScenario(runMode = 'practice') {
    if (draReadOnly || busy) return;
    setBusyAction(runMode === 'practice' ? 'generatePractice' : 'startFinal');
    try {
      const generated = await courseOps.generateDraScenario(params);
      const primaryStakeholder = generated?.stakeholders?.[0];
      const stageNotes = createDraStageNotes();
      const firstStage = getFirstDraStage();
      const scenarioRunId = crypto.randomUUID();
      setActiveStage(firstStage);
      if (courseId && topicId && firstStage) {
        courseOps.saveEnrollmentUiSettings(courseId, { [`draActiveStage_${topicId}`]: firstStage });
      }
      const nextDetails = {
        state: 'inProgress',
        mode: runMode,
        scenarioRunId,
        createdAt: new Date().toISOString(),
        difficulty: params.difficulty,
        scenario: generated?.scenario || {},
        constraints: generated?.constraints || [],
        stakeholders: generated?.stakeholders || [],
        resources: generated?.resources || [],
        stageNotes,
        identified: primaryStakeholder ? [{ ...primaryStakeholder, kind: 'stakeholder' }] : [],
      };
      await autoSaveDetails(nextDetails, { selectPracticeScenarioId: runMode === 'practice' ? scenarioRunId : selectedPracticeScenarioId, forceProgressRow: true });
    } catch (ex) {
      alert(`Unable to generate a scenario. Please try again. ${ex.message || ''}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function startFinal() {
    if (draReadOnly || busy) return;
    if (!window.confirm('Start the final assessment? Once it begins the scenario is locked and must be completed.')) return;
    await generateScenario('final');
  }

  async function cancelScenario() {
    if (draReadOnly || busy) return;
    await autoSaveState({ practiceScenarios, selectedPracticeScenarioId: null, finalScenario });
  }

  function buildTranscripts(source) {
    const transcriptMap = new Map();
    const targetLookup = buildScenarioTargetMap(source);

    Object.values(source.conversations || {}).forEach((conversation) => {
      const localTranscriptMap = new Map();
      const messages = Array.isArray(conversation) ? conversation : Array.isArray(conversation?.messages) ? conversation.messages : [];

      const learnerHistory = [];

      messages.forEach((message) => {
        if (message?.role === 'user') {
          const learnerMessage = {
            role: 'user',
            text: message.text || '',
            stage: message.stage || '',
          };
          learnerHistory.push(learnerMessage);
          localTranscriptMap.forEach((transcript) => {
            transcript.messages.push(learnerMessage);
          });
          return;
        }

        if (message?.role !== 'model' || !message?.speakerKey) return;
        const target = targetLookup.get(message.speakerKey) || {};
        if (!localTranscriptMap.has(message.speakerKey)) {
          localTranscriptMap.set(message.speakerKey, {
            name: message.speakerName || target.name || message.speakerKey,
            role: message.speakerRole || target.role || target.type || '',
            messages: [...learnerHistory],
          });
        }
        localTranscriptMap.get(message.speakerKey).messages.push({
          role: 'model',
          text: message.text || '',
          stage: message.stage || '',
        });
      });

      localTranscriptMap.forEach((localTranscript, speakerKey) => {
        if (!transcriptMap.has(speakerKey)) {
          transcriptMap.set(speakerKey, {
            name: localTranscript.name,
            role: localTranscript.role,
            messages: [...localTranscript.messages],
          });
          return;
        }

        transcriptMap.get(speakerKey).messages.push(...localTranscript.messages);
      });
    });

    return Array.from(transcriptMap.values()).filter((transcript) => transcript.messages.some((message) => message.text));
  }

  async function computeEvaluation(source) {
    return courseOps.getDraEvaluation(source.scenario, buildTranscripts(source), source.stageNotes || {}, source.difficulty, source.evaluation);
  }

  async function requestCoaching() {
    if (draReadOnly || coaching) return;
    setCoaching(true);
    try {
      const result = await courseOps.getDraCoaching(details.scenario, buildTranscripts(details), details.stageNotes || {}, activeStage, details.difficulty ?? params.difficulty, details.evaluation);
      await autoSaveDetails({ ...details, coaching: result });
    } catch {
      alert('Unable to get coaching right now. Please try again.');
    } finally {
      setCoaching(false);
    }
  }

  async function refreshEvaluation() {
    if (draReadOnly || evaluating) return;
    setEvaluating(true);
    try {
      const evaluation = await computeEvaluation(details);
      await autoSaveDetails({ ...details, evaluation });
    } catch {
      alert('Unable to evaluate progress right now. Please try again.');
    } finally {
      setEvaluating(false);
    }
  }

  async function completeAssessment() {
    if (draReadOnly || busy) return;
    setBusyAction('completeAssessment');
    try {
      let evaluation = details.evaluation;
      try {
        evaluation = await computeEvaluation(details);
      } catch {
        // Fall back to the most recent evaluation if the final scoring call fails.
      }
      const completedDetails = { ...details, evaluation, state: 'completed', completedAt: new Date().toISOString() };
      await autoSaveDetails(completedDetails, { forceProgressRow: true });
      selectTab('evaluation');
    } finally {
      setBusyAction(null);
    }
  }

  const canPractice = params.practiceMode;
  const canFinal = params.finalMode;
  const locked = details.mode === 'final';
  const hasScenario = details.state === 'inProgress' || details.state === 'completed';
  const showCoaching = details.state === 'inProgress' && !locked;
  const showEvaluation = (details.state === 'inProgress' && !locked) || details.state === 'completed';
  const showPracticeScenarioPicker = params.practiceMode && practiceScenarios.length > 0;

  const tabs = [{ id: 'overview', label: 'Overview' }, ...(hasScenario ? [{ id: 'scenario', label: 'Scenario' }] : []), ...(hasScenario ? [{ id: 'investigation', label: 'Workspace' }] : []), ...(showCoaching ? [{ id: 'coaching', label: 'Coaching' }] : []), ...(showEvaluation ? [{ id: 'evaluation', label: 'Evaluation' }] : [])];

  const safeActiveTab = tabs.some((t) => t.id === activeTab) ? activeTab : 'overview';

  const disclosure = scenarioDisclosure(details.difficulty ?? params.difficulty);
  const revealedTargets = [...(disclosure.showStakeholders ? (details.stakeholders || []).map((s, i) => ({ key: `stakeholder:${i}`, type: 'stakeholder', ...s })) : []), ...(disclosure.showResources ? (details.resources || []).map((r, i) => ({ key: `resource:${i}`, type: 'resource', ...r })) : [])];

  // The primary stakeholder (index 0) is always available regardless of difficulty —
  // they are the person who engaged the learner in the scenario.
  const primaryStakeholder = (details.stakeholders || [])[0];
  if (primaryStakeholder && !revealedTargets.some((t) => t.key === 'stakeholder:0')) {
    revealedTargets.unshift({ key: 'stakeholder:0', type: 'stakeholder', ...primaryStakeholder });
  }

  const revealedNames = new Set(revealedTargets.map((t) => t.name));
  const identifiedTargets = (details.identified || []).map((item, i) => ({ key: `identified:${i}`, type: item.kind || 'stakeholder', ...item })).filter((t) => !revealedNames.has(t.name));
  const targets = [...revealedTargets, ...identifiedTargets];
  const targetMap = new Map(targets.map((target) => [target.key, target]));
  const stakeholderTargets = targets.filter((target) => target.type === 'stakeholder');
  const listenerTargets = selectedListenerTargetKeys.map((key) => targetMap.get(key)).filter((target) => target?.type === 'stakeholder');
  const activeConversation = details.conversations?.[makeConversationKey(selectedTargetKey, selectedListenerTargetKeys)] || {
    primaryTargetKey: selectedTargetKey,
    listenerTargetKeys: selectedListenerTargetKeys,
    messages: [],
  };

  React.useEffect(() => {
    if (!selectedTargetKey && targets[0]?.key) {
      setSelectedTargetKey(targets[0].key);
    }
  }, [selectedTargetKey, targets]);

  React.useEffect(() => {
    const selectedTargetIsStakeholder = selectedTargetKey ? stakeholderTargets.some((target) => target.key === selectedTargetKey) : true;
    const validListenerKeys = selectedListenerTargetKeys
      .filter(() => selectedTargetIsStakeholder)
      .filter((key) => key !== selectedTargetKey)
      .filter((key) => stakeholderTargets.some((target) => target.key === key));

    if (validListenerKeys.length !== selectedListenerTargetKeys.length || validListenerKeys.some((key, index) => key !== selectedListenerTargetKeys[index])) {
      setSelectedListenerTargetKeys(validListenerKeys);
      if (courseId && topicId) {
        courseOps.saveEnrollmentUiSettings(courseId, { [`draSelectedListeners_${topicId}`]: validListenerKeys });
      }
    }
  }, [selectedListenerTargetKeys, selectedTargetKey, stakeholderTargets, courseId, topicId]);

  if (loading) return <div />;

  function openPracticeScenario(scenarioRunId) {
    const scenario = practiceScenarios.find((item) => item.scenarioRunId === scenarioRunId);
    if (!scenario) return;
    setDraState((prev) => ({ ...normalizeDraState(prev), selectedPracticeScenarioId: scenarioRunId }));
    const firstStage = getFirstDraStage();
    setActiveStage(firstStage);
    if (firstStage && courseId && topicId) {
      courseOps.saveEnrollmentUiSettings(courseId, { [`draActiveStage_${topicId}`]: firstStage });
    }
    selectTab('scenario');
  }

  function renderPracticeScenarioList(containerClassName = 'w-full max-w-3xl rounded border border-blue-200 bg-blue-50 p-3') {
    if (!showPracticeScenarioPicker) return null;

    return (
      <div className={containerClassName}>
        <div className="space-y-2">
          {practiceScenarios.map((scenario, index) => {
            const isSelected = selectedPracticeScenarioId === scenario.scenarioRunId;
            const isCompleted = Boolean(scenario.completedAt);
            const title = scenario?.scenario?.title || `Practice scenario ${index + 1}`;
            return (
              <button key={scenario.scenarioRunId} type="button" onClick={() => openPracticeScenario(scenario.scenarioRunId)} className={`w-full rounded border px-3 py-2 text-left transition-colors ${isSelected ? 'border-blue-500 bg-blue-600 text-white' : isCompleted ? 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100' : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-100'}`}>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {isCompleted
                    ? <BadgeCheck size={14} className={isSelected ? 'text-white shrink-0' : 'text-blue-500 shrink-0'} />
                    : <CircleDashed size={14} className={isSelected ? 'text-blue-100 shrink-0' : 'text-blue-400 shrink-0'} />}
                  {title}
                </div>
                <div className={`mt-1 text-xs ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                  Started {formatScenarioDate(scenario.createdAt, 'Start date unavailable')}
                  {isCompleted && <> · Completed {formatScenarioDate(scenario.completedAt, 'Completion date unavailable')}</>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderActionButtons() {
    if (isPreview || !user) return null;

    if (details.state === 'notStarted') {
      return (
        <div className="not-prose mt-4 flex flex-col items-start gap-2">
          <p className="text-sm text-gray-600">{canPractice ? 'Generate a scenario to begin. You can cancel and generate a new one until you are ready.' : 'When you start, a scenario is generated and locked until you complete the assessment.'}</p>
          {isObserveReadOnly && <p className="text-sm text-amber-700">Observe mode is read-only. Assessment actions are disabled.</p>}
          <div className="flex flex-wrap gap-2">
            {canPractice && (
              <button disabled={draReadOnly || busy} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={() => generateScenario('practice')}>
                {busyAction === 'generatePractice' && <Spinner />}
                {busyAction === 'generatePractice' ? 'Generating…' : 'Generate scenario'}
              </button>
            )}
            {canFinal && (
              <button disabled={draReadOnly || busy} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60" onClick={startFinal}>
                {busyAction === 'startFinal' && <Spinner />}
                {busyAction === 'startFinal' ? 'Generating…' : 'Start final assessment'}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (details.state === 'inProgress') {
      return (
        <div className="not-prose flex flex-wrap items-center justify-end gap-2">
          <div className="hidden sm:flex min-w-0 items-center gap-2 text-sm text-blue-700">
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold">In progress</span>
            {locked && <span className="text-xs text-blue-500">Final assessment</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!locked && (
              <button disabled={draReadOnly || busy} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded border border-gray-200 hover:bg-gray-200 disabled:opacity-60" onClick={cancelScenario}>
                Cancel
              </button>
            )}
            <button disabled={draReadOnly || busy} className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={completeAssessment}>
              {busyAction === 'completeAssessment' && <Spinner />}
              Complete assessment
            </button>
            {!draReadOnly && (
              <button disabled={!isDirty || saving} onClick={handleSave} className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-500 disabled:opacity-40">
                {saving && <Spinner />}
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (details.state === 'completed') {
      const wasFinal = details.mode === 'final';
      return (
        <div className="not-prose flex flex-wrap items-center justify-end gap-2">
          <div className="hidden sm:flex items-center gap-2 text-sm text-blue-700">
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold">Complete</span>
          </div>
          {!draReadOnly && (
            <button disabled={!isDirty || saving} onClick={handleSave} className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-500 disabled:opacity-40">
              {saving && <Spinner />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          {!wasFinal && !hasScenarioInProgress && (
            <div className="flex flex-wrap gap-2">
              {canPractice && (
                <button disabled={draReadOnly || busy} className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={() => generateScenario('practice')}>
                  {busyAction === 'generatePractice' && <Spinner />}
                  {busyAction === 'generatePractice' ? 'Generating…' : 'Start new scenario'}
                </button>
              )}
              {canFinal && (
                <button disabled={draReadOnly || busy} className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60" onClick={startFinal}>
                  {busyAction === 'startFinal' && <Spinner />}
                  {busyAction === 'startFinal' ? 'Generating…' : 'Start final assessment'}
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  function renderTabContent() {
    switch (safeActiveTab) {
      case 'overview':
        return (
          <div className="mt-4">
            <div className="not-prose mb-3 text-lg font-semibold text-gray-600">Description</div>
            {params.engagementDescription && (
              <Markdown learningSession={learningSession} content={params.engagementDescription} />
            )}
            <div className="not-prose mb-3 text-lg font-semibold text-gray-600">Outcomes</div>
            <Markdown learningSession={learningSession} content={params.learningOutcomes || '_Learning outcomes to be defined._'} />

            <div className="not-prose mt-6 mb-8">
              <div className="mb-3 text-lg font-semibold text-gray-600">Scenarios</div>
              {showPracticeScenarioPicker && renderPracticeScenarioList()}
              {!isPreview && user && details.state === 'notStarted' && (
                <div className={showPracticeScenarioPicker ? 'mt-3' : ''}>
                  {!showPracticeScenarioPicker && (
                    <p className="mb-3 text-sm text-gray-600">{canPractice ? 'Generate a scenario to begin. You can cancel and generate a new one until you are ready.' : 'When you start, a scenario is generated and locked until you complete the assessment.'}</p>
                  )}
                  {isObserveReadOnly && <p className="mb-2 text-sm text-amber-700">Observe mode is read-only. Assessment actions are disabled.</p>}
                  <div className="flex flex-wrap gap-2">
                    {canPractice && (
                      <button disabled={draReadOnly || busy} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={() => generateScenario('practice')}>
                        {busyAction === 'generatePractice' && <Spinner />}
                        {busyAction === 'generatePractice' ? 'Generating…' : 'Generate scenario'}
                      </button>
                    )}
                    {canFinal && (
                      <button disabled={draReadOnly || busy} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60" onClick={startFinal}>
                        {busyAction === 'startFinal' && <Spinner />}
                        {busyAction === 'startFinal' ? 'Generating…' : 'Start final assessment'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="not-prose pt-0">
            <div className="mb-3 text-lg font-semibold text-gray-600">How It Works</div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 pb-4">
              <div className="px-4 pt-4 space-y-4">
                <ol className="list-none !pl-0 space-y-3 text-sm text-gray-700">
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                    <div>
                      <strong>Start a scenario.</strong> {canPractice && canFinal ? 'Choose practice to explore freely or start the final assessment when you are ready.' : canPractice ? 'Click "Generate scenario" to create a unique case. You can cancel and generate a new one until you are happy with it.' : 'Click "Start final assessment" to begin. The scenario is locked once started and must be completed.'}
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
                    <div>
                      <strong>Read the Scenario tab.</strong> Review the situation, constraints, and any stakeholders revealed to you. On harder difficulty settings some details are intentionally withheld for you to discover.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
                    <div>
                      <strong>Work through the Workspace tab.</strong> The workspace is where you conduct your investigation and build your solution. Use the stage pills to move through the six stages of the assessment. The workspace has two sides: on the <strong>left</strong>, chat with stakeholders to gather information; on the <strong>right</strong>, use the reasoning record to document your work on each stage.
                      {canPractice && (
                        <span>
                          {' '}
                          In practice mode, the <strong>Coaching</strong> tab provides AI feedback on your approach at any point, and you can open the <strong>Evaluation</strong> tab to score your progress as many times as you like before finishing.
                        </span>
                      )}
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">4</span>
                    <div>
                      <strong>Complete and review.</strong> When you have worked through all stages, click "Complete assessment." A final AI evaluation of your reasoning and process will appear on the Evaluation tab.
                    </div>
                  </li>
                </ol>

                {(canPractice || canFinal) && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Modes</div>
                    <div className="grid gap-1.5">
                      {canPractice && (
                        <div className="rounded border border-blue-200 bg-white px-3 py-2 text-sm">
                          <div className="mb-1 font-semibold text-blue-800">Practice</div>
                          <ul className="space-y-1 text-xs text-gray-600 list-disc list-inside">
                            <li>Cancel and regenerate freely until ready</li>
                            <li>Coaching tab available throughout</li>
                            <li>Evaluation can be run at any time to check progress</li>
                            <li>Repeat as many times as you like</li>
                          </ul>
                        </div>
                      )}
                      {canFinal && (
                        <div className="rounded border border-amber-200 bg-white px-3 py-2 text-sm">
                          <div className="mb-1 font-semibold text-amber-800">Final assessment</div>
                          <ul className="space-y-1 text-xs text-gray-600 list-disc list-inside">
                            <li>Scenario is locked once started</li>
                            <li>Must be completed; cannot be cancelled</li>
                            <li>Coaching and mid-assessment evaluation are not available</li>
                            <li>Evaluation is generated on completion</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">The six stages</div>
                  <div className="grid gap-1.5">
                    {DRA_FIXED_STAGES.map((s) => (
                      <div key={s.stage} className="flex items-start gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm">
                        <div className="mt-0.5 shrink-0">{getStageIcon(s.stage)}</div>
                        <div>
                          <span className="font-semibold text-gray-800">{s.stage}</span>
                          <span className="text-gray-500">: {s.interpretation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded border border-blue-200 bg-white px-3 py-2 text-xs text-blue-800">
                  <strong>Tip:</strong> You can chat with multiple stakeholders at once. In the Workspace, click additional stakeholder names in the left panel to add them to your conversation group. Start your message with a name to direct it at a specific person.
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Evaluation</div>
                  <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 space-y-2">
                    <p>Your mastery is measured across three dimensions using evidence drawn from your conversations and notes:</p>
                    <ul className="space-y-1 list-disc list-inside text-xs text-gray-600">
                      <li>
                        <strong>Process:</strong> how thoroughly you applied the disciplinary reasoning framework across each stage. This is the foundation of your mastery rating.
                      </li>
                      <li>
                        <strong>Competency:</strong> the depth of domain knowledge and reasoning skills you demonstrated.
                      </li>
                      <li>
                        <strong>Disposition:</strong> the quality of your professional mindset and approach throughout.
                      </li>
                    </ul>
                    <p className="text-xs text-gray-600">Each dimension is rated on a five-point mastery continuum: Beginning, Emerging, Developing, Proficient, and Exemplary. Your Character (the combination of Competency and Disposition) reflects the depth of your professional practice and shapes how fully your Process mastery is recognized.</p>
                  </div>
                </div>
              </div>
            </div>
            </div>
            {(isPreview || !user) && (
              <div className="not-prose mt-4 rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                When a learner begins, a scenario is generated from these parameters.
                {!user && (
                  <>
                    {' '}
                    <a href="/" className="font-semibold underline underline-offset-2 hover:text-gray-800">
                      Login
                    </a>{' '}
                    to take this assessment.
                  </>
                )}
              </div>
            )}
          </div>
        );
      case 'scenario':
        return (
          <div className="mt-4">
            <ScenarioView details={details} difficulty={details.difficulty ?? params.difficulty} learningSession={learningSession} />
          </div>
        );
      case 'coaching':
        return (
          <div className="mt-4">
            <CoachPanel coaching={details.coaching} onRequest={requestCoaching} busy={coaching} readOnly={draReadOnly} />
          </div>
        );
      case 'evaluation':
        return (
          <div className="mt-4">
            {details.state === 'inProgress' && !locked && (
              <div className="not-prose mb-4">
                <button onClick={refreshEvaluation} disabled={draReadOnly || evaluating} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-60 text-sm">
                  {evaluating && <Spinner className="border-blue-200 border-t-blue-700" />}
                  {evaluating ? 'Evaluating…' : details.evaluation ? 'Update evaluation' : 'Evaluate my progress'}
                </button>
              </div>
            )}
            <DraEvaluation evaluation={details.evaluation} difficulty={details.difficulty ?? params.difficulty} />
          </div>
        );
      default:
        return null;
    }
  }

  const investigationReadOnly = details.state === 'completed' || draReadOnly;
  const stageNavigationDisabled = false;
  const activeStageInterpretation = getDraStageDefinition(activeStage)?.interpretation || '';
  const showMobileRecord = isMobileInvestigationLayout && mobileInvestigationView === 'record';
  const activeStageItem = getDraStageDefinition(activeStage);

  function renderStagePills() {
    if (isMobileInvestigationLayout) {
      return (
        <DraMobilePicker
          value={activeStage}
          valueLabel={activeStageItem?.stage || 'Select stage'}
          valueIcon={getStageIcon(activeStageItem?.stage)}
          groups={[
            {
              items: DRA_FIXED_STAGES.map((s) => ({
                value: s.stage,
                label: s.stage,
                icon: getStageIcon(s.stage),
                selected: s.stage === activeStage,
              })),
            },
          ]}
          isOpen={mobileStagePickerOpen}
          onToggle={() => setMobileStagePickerOpen((open) => !open)}
          onClose={() => setMobileStagePickerOpen(false)}
          onSelect={(value) => selectStage(value)}
          disabled={stageNavigationDisabled}
          className="not-prose shrink-0 w-[calc(100%-3.5rem)]"
        />
      );
    }

    return (
      <div className="not-prose shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {DRA_FIXED_STAGES.map((s) => (
            <button key={s.stage} onClick={() => selectStage(s.stage)} disabled={stageNavigationDisabled} className={`shrink-0 rounded-full border px-2.5 py-1 text-xs disabled:opacity-60 ${s.stage === activeStage ? 'border-blue-500 bg-blue-600 text-white' : 'border-blue-200 bg-white/90 text-gray-700 hover:bg-white'}`}>
              {s.stage}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderMobileInvestigationToggle() {
    if (!isMobileInvestigationLayout) return null;

    return (
      <button type="button" onClick={() => selectMobileInvestigationView(mobileInvestigationView === 'chat' ? 'record' : 'chat')} aria-label={mobileInvestigationView === 'chat' ? 'Open reasoning record' : 'Open chat'} title={mobileInvestigationView === 'chat' ? 'Open reasoning record' : 'Open chat'} className="absolute right-2 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-white/95 text-blue-700 shadow-md backdrop-blur-sm transition-colors hover:bg-blue-50">
        {mobileInvestigationView === 'chat' ? <FileText size={18} /> : <MessageSquare size={18} />}
      </button>
    );
  }

  function renderInvestigationStageHeader() {
    if (!activeStageInterpretation) return null;

    return (
      <div className="shrink-0 border-b border-gray-100 bg-blue-50 px-4 py-3">
        {renderStagePills()}
        {activeStageInterpretation && <p className="mt-2 text-sm text-gray-600">{activeStageInterpretation}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
      <div className="px-4 pt-4 shrink-0">
        <div className="not-prose flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 m-0">{params.title || 'Disciplinary Reasoning Assessment'}</h1>
          {(details.state === 'inProgress' || details.state === 'completed') && renderActionButtons()}
        </div>
        {tabs.length > 1 && <TabBar tabs={tabs} active={safeActiveTab} onChange={selectTab} />}
      </div>

      {safeActiveTab === 'investigation' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {isMobileInvestigationLayout ? (
            <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
              {renderMobileInvestigationToggle()}
              {showMobileRecord ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    {renderInvestigationStageHeader()}
                    <DraAssessment value={details.stageNotes?.[activeStage] || ''} onChange={(val) => updateStageNote(activeStage, val)} readOnly={investigationReadOnly} activeStage={activeStage} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                  <DraInvestigation targets={targets} stakeholderTargets={stakeholderTargets} selectedKey={selectedTargetKey} selectedListenerKeys={selectedListenerTargetKeys} onSelectTarget={selectTarget} onSelectListenerKeys={selectListenerTargetKeys} onUpdateStakeholderGroup={updateStakeholderGroup} conversation={activeConversation} onSendMessage={sendInvestigationMessage} readOnly={investigationReadOnly} learningSession={learningSession} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex overflow-hidden" ref={investigationSplitRef}>
              <div className="min-w-0 flex flex-col overflow-hidden" style={{ width: `${investigationPanePercent}%` }}>
                <DraInvestigation targets={targets} stakeholderTargets={stakeholderTargets} selectedKey={selectedTargetKey} selectedListenerKeys={selectedListenerTargetKeys} onSelectTarget={selectTarget} onSelectListenerKeys={selectListenerTargetKeys} onUpdateStakeholderGroup={updateStakeholderGroup} conversation={activeConversation} onSendMessage={sendInvestigationMessage} readOnly={investigationReadOnly} learningSession={learningSession} />
              </div>
              <Splitter onMove={onInvestigationPaneMoved} onResized={onInvestigationPaneResized} />
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                {renderInvestigationStageHeader()}
                <DraAssessment value={details.stageNotes?.[activeStage] || ''} onChange={(val) => updateStageNote(activeStage, val)} readOnly={investigationReadOnly} activeStage={activeStage} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 mt-4 min-h-0 overflow-auto">
          <div className="markdown-body px-4 pb-4">{renderTabContent()}</div>
        </div>
      )}
    </div>
  );
}
