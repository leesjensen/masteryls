import React from 'react';
import Markdown from '../../Markdown';
import { parseDraMarkdown } from '../../../utils/draMarkdown';
import DraInvestigation from './draInvestigation';
import DraEvaluation from './draEvaluation';
import DraCoach from './draCoach';
import Splitter from '../../Splitter';
import useSplitPaneState from '../../../hooks/useSplitPaneState';

const ASSESSMENT_FIELDS = [
  ['understanding', 'Current understanding'],
  ['assumptions', 'Assumptions'],
  ['unknowns', 'Unknowns'],
  ['hypotheses', 'Hypotheses'],
  ['decisions', 'Decisions'],
  ['evidence', 'Evidence'],
  ['confidence', 'Confidence'],
];

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
  const [evaluating, setEvaluating] = React.useState(false);
  const [coaching, setCoaching] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('overview');
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
      if (!isPreview && user && learningSession?.enrollment) {
        setDraState(await courseOps.getDraState());
      }
      setLoading(false);
    }
    loadState();
  }, [isPreview, user, learningSession?.enrollment]);

  const params = React.useMemo(() => parseDraMarkdown(markdown), [markdown]);
  const details = draState.details || { state: 'notStarted' };

  // Switch to relevant tab when assessment state changes.
  const prevStateRef = React.useRef(details.state);
  React.useEffect(() => {
    if (prevStateRef.current !== details.state) {
      prevStateRef.current = details.state;
      if (details.state === 'inProgress') setActiveTab('scenario');
      if (details.state === 'completed') setActiveTab('evaluation');
      if (details.state === 'notStarted') setActiveTab('overview');
    }
  }, [details.state]);

  function setLocalDetails(nextDetails) {
    setDraState({ details: nextDetails });
  }

  async function persist(nextDetails) {
    setDraState({ details: nextDetails });
    await courseOps.addProgress(null, null, 'dra', 0, nextDetails);
  }

  async function selectStage(stage) {
    if (isObserveReadOnly || details.activeStage === stage) return;
    await persist({ ...details, activeStage: stage });
  }

  async function sendInvestigationMessage(target, text) {
    const key = target.key;
    const conversations = details.conversations || {};
    const withUser = [...(conversations[key] || []), { role: 'user', text, stage: details.activeStage || '' }];
    setLocalDetails({ ...details, conversations: { ...conversations, [key]: withUser } });

    try {
      const reply = await courseOps.getDraStakeholderResponse(details.scenario, target, withUser);
      await persist({ ...details, conversations: { ...conversations, [key]: [...withUser, { role: 'model', text: reply }] } });
    } catch {
      await persist({ ...details, conversations: { ...conversations, [key]: withUser } });
      alert('The interview partner could not respond. Please try again.');
    }
  }

  function updateReasoning(field, value) {
    setLocalDetails({ ...details, reasoningRecord: { ...(details.reasoningRecord || {}), [field]: value } });
  }

  async function saveReasoning() {
    if (isObserveReadOnly) return;
    await persist(details);
  }

  async function generateScenario(runMode = 'practice') {
    if (isObserveReadOnly || busy) return;
    setBusy(true);
    try {
      const generated = await courseOps.generateDraScenario(params);
      const stages = generated?.stages || [];
      await persist({
        state: 'inProgress',
        mode: runMode,
        difficulty: params.difficulty,
        scenario: generated?.scenario || {},
        constraints: generated?.constraints || [],
        stakeholders: generated?.stakeholders || [],
        resources: generated?.resources || [],
        stages,
        activeStage: stages[0]?.stage || '',
      });
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
    await persist({ state: 'notStarted' });
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
    return courseOps.getDraEvaluation(source.scenario, buildTranscripts(source), source.reasoningRecord || {});
  }

  async function requestCoaching() {
    if (isObserveReadOnly || coaching) return;
    setCoaching(true);
    try {
      const result = await courseOps.getDraCoaching(details.scenario, buildTranscripts(details), details.reasoningRecord || {}, details.activeStage || '');
      await persist({ ...details, coaching: result });
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
      await persist({ ...details, evaluation });
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
      await persist({ ...details, evaluation, state: 'completed', completedAt: new Date().toISOString() });
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
        {tabs.length > 1 && <DraTabBar tabs={tabs} active={safeActiveTab} onChange={setActiveTab} />}
      </div>

      {safeActiveTab === 'investigation' ? (
        <div className="flex-1 min-h-0 flex overflow-hidden" ref={investigationSplitRef}>
          <div className="min-w-0 overflow-auto p-4" style={{ width: `${investigationPanePercent}%` }}>
            <DraInvestigation
              targets={targets}
              stages={details.stages || []}
              activeStage={details.activeStage || ''}
              onSelectStage={selectStage}
              conversations={details.conversations || {}}
              onSendMessage={sendInvestigationMessage}
              readOnly={investigationReadOnly}
              learningSession={learningSession}
            />
          </div>
          <Splitter onMove={onInvestigationPaneMoved} onResized={onInvestigationPaneResized} />
          <div className="flex-1 min-w-0 overflow-auto p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Assessment</div>
            <div className="grid grid-cols-1 gap-3">
              {ASSESSMENT_FIELDS.map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">{label}</label>
                  <textarea
                    aria-label={label}
                    value={details.reasoningRecord?.[key] || ''}
                    onChange={(e) => updateReasoning(key, e.target.value)}
                    onBlur={saveReasoning}
                    readOnly={investigationReadOnly}
                    rows={3}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm read-only:bg-gray-50"
                  />
                </div>
              ))}
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
