import React from 'react';
import Markdown from '../../Markdown';
import { parseDraMarkdown } from '../../../utils/draMarkdown';
import DraInvestigation from './draInvestigation';
import DraEvaluation from './draEvaluation';
import DraCoach from './draCoach';
import Splitter from '../../Splitter';
import useSplitPaneState from '../../../hooks/useSplitPaneState';
import DraAssessment from './DraAssessment';
import Spinner from '../../Spinner';
import { FileText, MessageSquare } from 'lucide-react';

function DraTabBar({ tabs, active, onChange }) {
  return (
    <div className="not-prose mt-4 overflow-x-auto">
      <div className="flex min-w-max border-b border-gray-200">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onChange(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${active === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
          {tab.label}
        </button>
      ))}
      </div>
    </div>
  );
}

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

      {somethingWithheld && <p className="not-prose mt-3 text-sm text-gray-500 italic">Further details, constraints, stakeholders, and resources emerge as you investigate.</p>}
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

function normalizeDraState(state) {
  if (!state || typeof state !== 'object') return createEmptyDraState();

  const practiceScenarios = Array.isArray(state.practiceScenarios) ? state.practiceScenarios.filter((item) => item && typeof item === 'object' && item.scenarioRunId) : [];
  const selectedPracticeScenarioId = typeof state.selectedPracticeScenarioId === 'string' && practiceScenarios.some((item) => item.scenarioRunId === state.selectedPracticeScenarioId) ? state.selectedPracticeScenarioId : null;
  const finalScenario = state.finalScenario && typeof state.finalScenario === 'object' && state.finalScenario.scenarioRunId ? state.finalScenario : null;

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
  const [mobileInvestigationView, setMobileInvestigationView] = React.useState('chat');
  const [isMobileInvestigationLayout, setIsMobileInvestigationLayout] = React.useState(false);
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

          const savedStage = uiSettings?.[`draActiveStage_${topicId}`];
          const stages = activeScenario.stages || [];
          if (savedStage && stages.some((s) => s.stage === savedStage)) {
            setActiveStage(savedStage);
          } else {
            setActiveStage(stages[0]?.stage || '');
          }

          const savedTab = uiSettings?.[`draActiveTab_${topicId}`];
          if (savedTab) setActiveTab(savedTab);

          const savedTargetKey = uiSettings?.[`draSelectedTarget_${topicId}`];
          if (savedTargetKey) setSelectedTargetKey(savedTargetKey);

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
        const nextPracticeScenarios = existingIndex === -1
          ? [...current.practiceScenarios, nextDetails]
          : current.practiceScenarios.map((item, index) => (index === existingIndex ? nextDetails : item));
        const nextSelectedId = preserveSelection ? current.selectedPracticeScenarioId : nextDetails.scenarioRunId;
        return { practiceScenarios: nextPracticeScenarios, selectedPracticeScenarioId: nextSelectedId, finalScenario: current.finalScenario };
      }

      return current;
    });
    setIsDirty(true);
  }

  // Auto-saves without marking dirty — used for definitive actions (generate, cancel, complete).
  async function autoSaveState(nextState) {
    const normalizedState = normalizeDraState(nextState);
    setDraState(normalizedState);
    setIsDirty(false);
    if (!draReadOnly) {
      await courseOps.saveDraState(normalizedState);
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

    await autoSaveState({ practiceScenarios: nextPracticeScenarios, selectedPracticeScenarioId: nextSelectedPracticeScenarioId, finalScenario: nextFinalScenario });
  }

  async function handleSave() {
    if (!isDirty || saving || draReadOnly) return;
    setSaving(true);
    try {
      await courseOps.saveDraState(draState);
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
    if (activeStage === stage) return;
    setActiveStage(stage);
    if (courseId && topicId) {
      courseOps.saveEnrollmentUiSettings(courseId, { [`draActiveStage_${topicId}`]: stage });
    }
  }

  function selectTarget(targetKey) {
    if (!targetKey || selectedTargetKey === targetKey) return;
    setSelectedTargetKey(targetKey);
    if (courseId && topicId) {
      courseOps.saveEnrollmentUiSettings(courseId, { [`draSelectedTarget_${topicId}`]: targetKey });
    }
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
    const key = target.key;
    const conversations = details.conversations || {};
    const withUser = [...(conversations[key] || []), { role: 'user', text, stage: activeStage }];
    applyStateUpdate({ ...details, conversations: { ...conversations, [key]: withUser } });

    try {
      const reply = await courseOps.getDraStakeholderResponse(details.scenario, target, withUser, details.stakeholders || [], details.resources || [], details.difficulty ?? params.difficulty);
      const nextConversations = { ...conversations, [key]: [...withUser, { role: 'model', text: reply }] };
      const newTargets = detectNewTargets(reply, details);
      applyStateUpdate({
        ...details,
        conversations: nextConversations,
        ...(newTargets.length > 0 && { identified: [...(details.identified || []), ...newTargets] }),
      });
    } catch {
      applyStateUpdate({ ...details, conversations: { ...conversations, [key]: withUser } });
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
      const stages = generated?.stages || [];
      const primaryStakeholder = generated?.stakeholders?.[0];
      const stageNotes = Object.fromEntries(stages.map((s) => [s.stage, `# ${s.stage}\n\n`]));
      const firstStage = stages[0]?.stage || '';
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
        stages,
        stageNotes,
        identified: primaryStakeholder ? [{ ...primaryStakeholder, kind: 'stakeholder' }] : [],
      };
      await autoSaveDetails(nextDetails, { selectPracticeScenarioId: runMode === 'practice' ? scenarioRunId : selectedPracticeScenarioId });
      await courseOps.addProgress(null, null, 'dra', 0, { state: 'inProgress', mode: runMode });
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
    return Object.entries(source.conversations || {}).map(([key, messages]) => {
      const [type, idx] = key.split(':');
      let target;
      if (type === 'identified') {
        target = (source.identified || [])[Number(idx)];
      } else {
        target = (type === 'stakeholder' ? source.stakeholders : source.resources)?.[Number(idx)];
      }
      return { name: target?.name || key, role: target?.role || target?.type || '', messages };
    });
  }

  async function computeEvaluation(source) {
    return courseOps.getDraEvaluation(
      source.scenario,
      buildTranscripts(source),
      source.stageNotes || {},
      source.difficulty,
      source.evaluation,
    );
  }

  async function requestCoaching() {
    if (draReadOnly || coaching) return;
    setCoaching(true);
    try {
      const result = await courseOps.getDraCoaching(
        details.scenario,
        buildTranscripts(details),
        details.stageNotes || {},
        activeStage,
        details.difficulty ?? params.difficulty,
        details.evaluation,
      );
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
      await autoSaveDetails(completedDetails);
      selectTab('evaluation');
      await courseOps.addProgress(null, null, 'dra', 0, { state: 'completed', mode: details.mode, completedAt: completedDetails.completedAt });
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) return <div />;

  const canPractice = params.practiceMode;
  const canFinal = params.finalMode;
  const locked = details.mode === 'final';
  const hasScenario = details.state === 'inProgress' || details.state === 'completed';
  const showCoaching = details.state === 'inProgress' && !locked;
  const showEvaluation = (details.state === 'inProgress' && !locked) || details.state === 'completed';
  const showPracticeScenarioPicker = params.practiceMode && practiceScenarios.length > 0;

  const tabs = [{ id: 'overview', label: 'Overview' }, ...(hasScenario ? [{ id: 'scenario', label: 'Scenario' }] : []), ...(hasScenario ? [{ id: 'investigation', label: 'Investigation' }] : []), ...(showCoaching ? [{ id: 'coaching', label: 'Coaching' }] : []), ...(showEvaluation ? [{ id: 'evaluation', label: 'Evaluation' }] : [])];

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

  function openPracticeScenario(scenarioRunId) {
    const scenario = practiceScenarios.find((item) => item.scenarioRunId === scenarioRunId);
    if (!scenario) return;
    setDraState((prev) => ({ ...normalizeDraState(prev), selectedPracticeScenarioId: scenarioRunId }));
    setActiveStage(scenario.stages?.[0]?.stage || '');
    if (scenario.stages?.[0]?.stage && courseId && topicId) {
      courseOps.saveEnrollmentUiSettings(courseId, { [`draActiveStage_${topicId}`]: scenario.stages[0].stage });
    }
    selectTab('scenario');
  }

  function renderPracticeScenarioList(containerClassName = 'w-full max-w-3xl rounded border border-blue-200 bg-blue-50 p-3', headingClassName = 'text-sm font-semibold text-blue-700 mb-2') {
    if (!showPracticeScenarioPicker) return null;

    return (
      <div className={containerClassName}>
        <div className={headingClassName}>Practice scenarios</div>
        <div className="space-y-2">
          {practiceScenarios.map((scenario, index) => {
            const isSelected = selectedPracticeScenarioId === scenario.scenarioRunId;
            return (
              <button key={scenario.scenarioRunId} type="button" onClick={() => openPracticeScenario(scenario.scenarioRunId)} className={`w-full rounded border px-3 py-2 text-left transition-colors ${isSelected ? 'border-blue-500 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-100'}`}>
                <div className="text-sm font-medium">{formatScenarioLabel(scenario, index)}</div>
                <div className={`mt-1 text-xs ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                  Started {formatScenarioDate(scenario.createdAt, 'Start date unavailable')}
                  {' · '}
                  Completed {scenario.completedAt ? formatScenarioDate(scenario.completedAt, 'Completion date unavailable') : 'In progress'}
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
          {renderPracticeScenarioList('w-full max-w-3xl rounded border border-blue-200 bg-blue-50 p-3', 'text-sm font-semibold text-blue-700 mb-2')}
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
              <button disabled={draReadOnly || busy} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded border border-gray-200 hover:bg-gray-200 disabled:opacity-60" onClick={cancelScenario}>
                Cancel
              </button>
            )}
            <button disabled={draReadOnly || busy} className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={completeAssessment}>
              {busyAction === 'completeAssessment' && <Spinner />}
              Complete assessment
            </button>
            {!draReadOnly && (
              <button disabled={!isDirty || saving} onClick={handleSave} className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-500 disabled:opacity-40">
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
            {details.completedAt && <span className="text-xs text-blue-500">Completed {new Date(details.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
          </div>
          {!draReadOnly && (
            <button disabled={!isDirty || saving} onClick={handleSave} className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-500 disabled:opacity-40">
              {saving && <Spinner />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          {!wasFinal && !hasScenarioInProgress && (
            <div className="flex flex-wrap gap-2">
              {canPractice && (
                <button disabled={draReadOnly || busy} className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={() => generateScenario('practice')}>
                  {busyAction === 'generatePractice' && <Spinner />}
                  {busyAction === 'generatePractice' ? 'Generating…' : 'Start new scenario'}
                </button>
              )}
              {canFinal && (
                <button disabled={draReadOnly || busy} className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60" onClick={startFinal}>
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
            <Markdown learningSession={learningSession} content={params.learningOutcomes || '_Learning outcomes to be defined._'} />
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
            {renderPracticeScenarioList('not-prose mb-4 rounded border border-blue-200 bg-blue-50 p-3', 'text-sm font-semibold text-blue-700 mb-2')}
            <ScenarioView details={details} difficulty={details.difficulty ?? params.difficulty} learningSession={learningSession} />
          </div>
        );
      case 'coaching':
        return (
          <div className="mt-4">
            <DraCoach coaching={details.coaching} onRequest={requestCoaching} busy={coaching} readOnly={draReadOnly} />
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
  const activeStageInterpretation = (details.stages || []).find((s) => s.stage === activeStage)?.interpretation || '';
  const showMobileRecord = isMobileInvestigationLayout && mobileInvestigationView === 'record';

  function renderStagePills() {
    if ((details.stages || []).length === 0) return null;

    return (
      <div className="not-prose shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {(details.stages || []).map((s) => (
            <button key={s.stage} onClick={() => selectStage(s.stage)} disabled={stageNavigationDisabled} className={`px-2.5 py-1 rounded-full border text-xs disabled:opacity-60 ${s.stage === activeStage ? 'border-blue-500 bg-blue-600 text-white' : 'border-blue-200 bg-white/90 text-gray-700 hover:bg-white'}`}>
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
      <button
        type="button"
        onClick={() => selectMobileInvestigationView(mobileInvestigationView === 'chat' ? 'record' : 'chat')}
        aria-label={mobileInvestigationView === 'chat' ? 'Open reasoning record' : 'Open chat'}
        title={mobileInvestigationView === 'chat' ? 'Open reasoning record' : 'Open chat'}
        className="absolute right-2 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-white/95 text-blue-700 shadow-md backdrop-blur-sm transition-colors hover:bg-blue-50"
      >
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
        {details.state === 'notStarted' && renderActionButtons()}
        {tabs.length > 1 && <DraTabBar tabs={tabs} active={safeActiveTab} onChange={selectTab} />}
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
                  <DraInvestigation targets={targets} selectedKey={selectedTargetKey} onSelectTarget={selectTarget} conversations={details.conversations || {}} onSendMessage={sendInvestigationMessage} readOnly={investigationReadOnly} learningSession={learningSession} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex overflow-hidden" ref={investigationSplitRef}>
              <div className="min-w-0 flex flex-col overflow-hidden" style={{ width: `${investigationPanePercent}%` }}>
                <DraInvestigation targets={targets} selectedKey={selectedTargetKey} onSelectTarget={selectTarget} conversations={details.conversations || {}} onSendMessage={sendInvestigationMessage} readOnly={investigationReadOnly} learningSession={learningSession} />
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
