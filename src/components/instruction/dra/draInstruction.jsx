import React from 'react';
import Markdown from '../../Markdown';
import { parseDraMarkdown } from '../../../utils/draMarkdown';
import DraInvestigation from './draInvestigation';
import DraEvaluation from './draEvaluation';
import DraCoach from './draCoach';
import Splitter from '../../Splitter';
import useSplitPaneState from '../../../hooks/useSplitPaneState';
import DraAssessment from './DraAssessment';


function DraTabBar({ tabs, active, onChange }) {
  return (
    <div className="not-prose flex border-b border-gray-200 mt-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            active === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
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

export default function DraInstruction({ courseOps, learningSession, user, content = null, instructionState = 'learning' }) {
  const [markdown, setMarkdown] = React.useState(content || '');
  const [draState, setDraState] = React.useState({ details: { state: 'notStarted' } });
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [evaluating, setEvaluating] = React.useState(false);
  const [coaching, setCoaching] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [activeStage, setActiveStage] = React.useState('');
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
    async function loadState() {
      try {
        if (!isPreview && user && learningSession?.enrollment) {
          const state = await courseOps.getDraState();
          const ds = state.details || {};
          // Prevent the state-change effect below from overriding our tab restoration.
          prevStateRef.current = ds.state;
          setDraState(state);

          const uiSettings = courseId && topicId ? courseOps.getEnrollmentUiSettings(courseId) : null;

          const savedStage = uiSettings?.[`draActiveStage_${topicId}`];
          const stages = ds.stages || [];
          if (savedStage && stages.some((s) => s.stage === savedStage)) {
            setActiveStage(savedStage);
          } else {
            setActiveStage(stages[0]?.stage || '');
          }

          const savedTab = uiSettings?.[`draActiveTab_${topicId}`];
          if (savedTab) setActiveTab(savedTab);
        }
      } catch (err) {
        console.error('Failed to load DRA state:', err);
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, [isPreview, user, learningSession?.enrollment]);

  const params = React.useMemo(() => parseDraMarkdown(markdown), [markdown]);
  const details = draState.details || { state: 'notStarted' };

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
      if (details.state === 'completed') selectTab('evaluation');
      if (details.state === 'notStarted') selectTab('overview');
    }
  }, [details.state]);

  function setLocalDetails(nextDetails) {
    setDraState({ details: nextDetails });
    setIsDirty(true);
  }

  // Auto-saves without marking dirty — used for definitive actions (generate, cancel, complete).
  async function autoSave(nextDetails) {
    setDraState({ details: nextDetails });
    setIsDirty(false);
    if (!isObserveReadOnly) {
      await courseOps.saveDraState(nextDetails);
    }
  }

  async function handleSave() {
    if (!isDirty || saving || isObserveReadOnly) return;
    setSaving(true);
    try {
      await courseOps.saveDraState(details);
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
    if (isObserveReadOnly || activeStage === stage) return;
    setActiveStage(stage);
    if (courseId && topicId) {
      courseOps.saveEnrollmentUiSettings(courseId, { [`draActiveStage_${topicId}`]: stage });
    }
  }

  // Scan a reply for hidden stakeholders/resources by exact name match. The AI prompt
  // now instructs the model to use only predefined names, so exact matching is reliable.
  function detectNewTargets(replyText, currentDetails) {
    const disclosure = scenarioDisclosure(currentDetails.difficulty ?? params.difficulty);
    const lowerReply = replyText.toLowerCase();

    const knownNames = new Set([
      (currentDetails.stakeholders || [])[0]?.name,
      ...(disclosure.showStakeholders ? (currentDetails.stakeholders || []).map((s) => s.name) : []),
      ...(disclosure.showResources ? (currentDetails.resources || []).map((r) => r.name) : []),
      ...(currentDetails.identified || []).map((t) => t.name),
    ].filter(Boolean));

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
    setLocalDetails({ ...details, conversations: { ...conversations, [key]: withUser } });

    try {
      const reply = await courseOps.getDraStakeholderResponse(details.scenario, target, withUser, details.stakeholders || [], details.resources || []);
      const nextConversations = { ...conversations, [key]: [...withUser, { role: 'model', text: reply }] };
      const newTargets = detectNewTargets(reply, details);
      setLocalDetails({
        ...details,
        conversations: nextConversations,
        ...(newTargets.length > 0 && { identified: [...(details.identified || []), ...newTargets] }),
      });
    } catch {
      setLocalDetails({ ...details, conversations: { ...conversations, [key]: withUser } });
      alert('The interview partner could not respond. Please try again.');
    }
  }

  function updateStageNote(stage, value) {
    setLocalDetails({ ...details, stageNotes: { ...(details.stageNotes || {}), [stage]: value } });
  }

  async function generateScenario(runMode = 'practice') {
    if (isObserveReadOnly || busy) return;
    setBusy(true);
    try {
      const generated = await courseOps.generateDraScenario(params);
      const stages = generated?.stages || [];
      const primaryStakeholder = generated?.stakeholders?.[0];
      const stageNotes = Object.fromEntries(stages.map((s) => [s.stage, `# ${s.stage}\n\n`]));
      const firstStage = stages[0]?.stage || '';
      setActiveStage(firstStage);
      if (courseId && topicId && firstStage) {
        courseOps.saveEnrollmentUiSettings(courseId, { [`draActiveStage_${topicId}`]: firstStage });
      }
      const nextDetails = {
        state: 'inProgress',
        mode: runMode,
        difficulty: params.difficulty,
        scenario: generated?.scenario || {},
        constraints: generated?.constraints || [],
        stakeholders: generated?.stakeholders || [],
        resources: generated?.resources || [],
        stages,
        stageNotes,
        identified: primaryStakeholder ? [{ ...primaryStakeholder, kind: 'stakeholder' }] : [],
      };
      await autoSave(nextDetails);
      await courseOps.addProgress(null, null, 'dra', 0, { state: 'inProgress', mode: runMode });
    } catch {
      alert('Unable to generate a scenario. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function startFinal() {
    if (isObserveReadOnly || busy) return;
    if (!window.confirm('Start the final assessment? Once it begins the scenario is locked and must be completed.')) return;
    await generateScenario('final');
  }

  async function cancelScenario() {
    if (isObserveReadOnly || busy) return;
    await autoSave({ state: 'notStarted' });
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
    return courseOps.getDraEvaluation(source.scenario, buildTranscripts(source), source.stageNotes || {});
  }

  async function requestCoaching() {
    if (isObserveReadOnly || coaching) return;
    setCoaching(true);
    try {
      const result = await courseOps.getDraCoaching(details.scenario, buildTranscripts(details), details.stageNotes || {}, activeStage);
      setLocalDetails({ ...details, coaching: result });
    } catch {
      alert('Unable to get coaching right now. Please try again.');
    } finally {
      setCoaching(false);
    }
  }

  async function refreshEvaluation() {
    if (isObserveReadOnly || evaluating) return;
    setEvaluating(true);
    try {
      const evaluation = await computeEvaluation(details);
      setLocalDetails({ ...details, evaluation });
    } catch {
      alert('Unable to evaluate progress right now. Please try again.');
    } finally {
      setEvaluating(false);
    }
  }

  async function completeAssessment() {
    if (isObserveReadOnly || busy) return;
    setBusy(true);
    try {
      let evaluation = details.evaluation;
      try {
        evaluation = await computeEvaluation(details);
      } catch {
        // Fall back to the most recent evaluation if the final scoring call fails.
      }
      const completedDetails = { ...details, evaluation, state: 'completed', completedAt: new Date().toISOString() };
      await autoSave(completedDetails);
      await courseOps.addProgress(null, null, 'dra', 0, { state: 'completed', mode: details.mode, completedAt: completedDetails.completedAt });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div />;

  const generatingLabel = busy ? 'Generating...' : null;
  const canPractice = params.practiceMode;
  const canFinal = params.finalMode;
  const locked = details.mode === 'final';
  const hasScenario = details.state === 'inProgress' || details.state === 'completed';
  const showCoaching = details.state === 'inProgress' && !locked;
  const showEvaluation = (details.state === 'inProgress' && !locked) || details.state === 'completed';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(hasScenario ? [{ id: 'scenario', label: 'Scenario' }] : []),
    ...(hasScenario ? [{ id: 'investigation', label: 'Investigation' }] : []),
    ...(showCoaching ? [{ id: 'coaching', label: 'Coaching' }] : []),
    ...(showEvaluation ? [{ id: 'evaluation', label: 'Evaluation' }] : []),
  ];

  const safeActiveTab = tabs.some((t) => t.id === activeTab) ? activeTab : 'overview';

  const disclosure = scenarioDisclosure(details.difficulty ?? params.difficulty);
  const revealedTargets = [
    ...(disclosure.showStakeholders ? (details.stakeholders || []).map((s, i) => ({ key: `stakeholder:${i}`, type: 'stakeholder', ...s })) : []),
    ...(disclosure.showResources ? (details.resources || []).map((r, i) => ({ key: `resource:${i}`, type: 'resource', ...r })) : []),
  ];

  // The primary stakeholder (index 0) is always available regardless of difficulty —
  // they are the person who engaged the learner in the scenario.
  const primaryStakeholder = (details.stakeholders || [])[0];
  if (primaryStakeholder && !revealedTargets.some((t) => t.key === 'stakeholder:0')) {
    revealedTargets.unshift({ key: 'stakeholder:0', type: 'stakeholder', ...primaryStakeholder });
  }

  const revealedNames = new Set(revealedTargets.map((t) => t.name));
  const identifiedTargets = (details.identified || [])
    .map((item, i) => ({ key: `identified:${i}`, type: item.kind || 'stakeholder', ...item }))
    .filter((t) => !revealedNames.has(t.name));
  const targets = [...revealedTargets, ...identifiedTargets];

  function renderActionButtons() {
    if (isPreview || !user) return null;

    if (details.state === 'notStarted') {
      return (
        <div className="not-prose mt-4 flex flex-col items-start gap-2">
          <p className="text-sm text-gray-600">
            {canPractice ? 'Generate a scenario to begin. You can cancel and generate a new one until you are ready.' : 'When you start, a scenario is generated and locked until you complete the assessment.'}
          </p>
          {isObserveReadOnly && <p className="text-sm text-amber-700">Observe mode is read-only. Assessment actions are disabled.</p>}
          <div className="flex flex-wrap gap-2">
            {canPractice && (
              <button disabled={isObserveReadOnly || busy} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={() => generateScenario('practice')}>
                {generatingLabel || 'Generate scenario'}
              </button>
            )}
            {canFinal && (
              <button disabled={isObserveReadOnly || busy} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60" onClick={startFinal}>
                {generatingLabel || 'Start final assessment'}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (details.state === 'inProgress') {
      return (
        <div className="not-prose mt-4 flex flex-wrap items-center gap-2">
          {locked ? (
            <span className="text-sm text-amber-700">Final assessment — the scenario is locked and must be completed.</span>
          ) : (
            <>
              <button disabled={isObserveReadOnly || busy} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-60" onClick={cancelScenario}>
                Cancel
              </button>
              {canFinal && (
                <button disabled={isObserveReadOnly || busy} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60" onClick={startFinal}>
                  Start final assessment
                </button>
              )}
            </>
          )}
          <button disabled={isObserveReadOnly || busy} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={completeAssessment}>
            Complete assessment
          </button>
          {!isObserveReadOnly && (
            <button disabled={!isDirty || saving} onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40">
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      );
    }

    if (details.state === 'completed') {
      const wasFinal = details.mode === 'final';
      return (
        <div className="not-prose mt-4 rounded border border-blue-200 bg-blue-50 p-3 flex flex-wrap items-center gap-4">
          <div>
            <div className="text-sm font-bold text-blue-600">Assessment complete</div>
            {details.completedAt && (
              <div className="text-xs text-blue-400">
                Completed on {new Date(details.completedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
          {!isObserveReadOnly && (
            <button disabled={!isDirty || saving} onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 text-sm">
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          {!wasFinal && (
            <div className="flex flex-wrap gap-2">
              {canPractice && (
                <button disabled={isObserveReadOnly || busy} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60" onClick={() => generateScenario('practice')}>
                  {generatingLabel || 'Start new scenario'}
                </button>
              )}
              {canFinal && (
                <button disabled={isObserveReadOnly || busy} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60" onClick={startFinal}>
                  {generatingLabel || 'Start final assessment'}
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
                {!user && ' Login to take this assessment.'}
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
            <DraCoach coaching={details.coaching} onRequest={requestCoaching} busy={coaching} readOnly={isObserveReadOnly} />
          </div>
        );
      case 'evaluation':
        return (
          <div className="mt-4">
            {details.state === 'inProgress' && !locked && (
              <div className="not-prose mb-4">
                <button onClick={refreshEvaluation} disabled={isObserveReadOnly || evaluating} className="px-4 py-2 bg-gray-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-60 text-sm">
                  {evaluating ? 'Evaluating...' : details.evaluation ? 'Update evaluation' : 'Evaluate my progress'}
                </button>
              </div>
            )}
            <DraEvaluation evaluation={details.evaluation} />
          </div>
        );
      default:
        return null;
    }
  }

  const investigationReadOnly = details.state === 'completed' || isObserveReadOnly;

  return (
    <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
      <div className="markdown-body px-4 pt-4 shrink-0">
        <h1>{params.title || 'Disciplinary Reasoning Assessment'}</h1>
        {renderActionButtons()}
        {tabs.length > 1 && <DraTabBar tabs={tabs} active={safeActiveTab} onChange={selectTab} />}
      </div>

      {safeActiveTab === 'investigation' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {(details.stages || []).length > 0 && (() => {
            const activeStageInterpretation = (details.stages || []).find((s) => s.stage === activeStage)?.interpretation || '';
            return (
              <div className="not-prose shrink-0 px-4 py-3 border-b border-gray-100 flex flex-col gap-2">
                <div className="flex flex-wrap gap-1">
                  {(details.stages || []).map((s) => (
                    <button key={s.stage} onClick={() => selectStage(s.stage)} disabled={investigationReadOnly} className={`px-3 py-1 rounded-full border text-sm disabled:opacity-60 ${s.stage === activeStage ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
                      {s.stage}
                    </button>
                  ))}
                </div>
                {activeStageInterpretation && <p className="text-sm text-gray-600">{activeStageInterpretation}</p>}
              </div>
            );
          })()}
          <div className="flex-1 min-h-0 flex overflow-hidden" ref={investigationSplitRef}>
          <div className="min-w-0 flex flex-col overflow-hidden" style={{ width: `${investigationPanePercent}%` }}>
            <DraInvestigation
              targets={targets}
              conversations={details.conversations || {}}
              onSendMessage={sendInvestigationMessage}
              readOnly={investigationReadOnly}
              learningSession={learningSession}
            />
          </div>
          <Splitter onMove={onInvestigationPaneMoved} onResized={onInvestigationPaneResized} />
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <DraAssessment
              value={details.stageNotes?.[activeStage] || ''}
              onChange={(val) => updateStageNote(activeStage, val)}
              readOnly={investigationReadOnly}
              activeStage={activeStage}
            />
          </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="markdown-body px-4 pb-4">
            {renderTabContent()}
          </div>
        </div>
      )}
    </div>
  );
}
