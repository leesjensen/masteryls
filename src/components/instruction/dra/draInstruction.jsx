import React from 'react';
import Markdown from '../../Markdown';
import { parseDraMarkdown } from '../../../utils/draMarkdown';
import DraInvestigation from './draInvestigation';
import DraEvaluation from './draEvaluation';

// Learner experience for a Disciplinary Reasoning Assessment. The scenario is
// generated at runtime from the author's published parameters and the full state is
// persisted to the learner's progress record (type 'dra'), mirroring how exams save
// and resume. The interactive investigation (stakeholder chat, reasoning record,
// evaluation) is a later phase — this slice covers the scenario lifecycle:
//
//   notStarted -> (practice: generate / cancel / regenerate | final: confirm -> lock)
//              -> inProgress -> completed
function ParameterHeader({ params, learningSession }) {
  const metadata = [
    { label: 'Discipline', value: params.discipline || 'Unspecified' },
    { label: 'Problem type', value: params.problemType || 'Unspecified' },
    { label: 'Difficulty', value: `${params.difficulty} / 5` },
    { label: 'Modes', value: [params.practiceMode && 'Practice', params.finalMode && 'Final'].filter(Boolean).join(', ') || 'Practice' },
    { label: 'Instability', value: params.instability ? 'On' : 'Off' },
  ];

  return (
    <>
      <h1>{params.title || 'Disciplinary Reasoning Assessment'}</h1>
      <div className="not-prose flex flex-wrap gap-2 my-3">
        {metadata.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-700">
            <span className="font-semibold">{item.label}:</span>
            <span>{item.value}</span>
          </span>
        ))}
      </div>
      <h2>Learning Outcomes</h2>
      <Markdown learningSession={learningSession} content={params.learningOutcomes || '_Learning outcomes to be defined._'} />
    </>
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
    <div className="mt-6">
      <h2>Scenario</h2>
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
    </div>
  );
}

export default function DraInstruction({ courseOps, learningSession, user, content = null, instructionState = 'learning' }) {
  const [markdown, setMarkdown] = React.useState(content || '');
  const [draState, setDraState] = React.useState({ details: { state: 'notStarted' } });
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [evaluating, setEvaluating] = React.useState(false);
  const isObserveReadOnly = Boolean(learningSession?.observeMode);
  const isPreview = instructionState === 'preview';

  React.useEffect(() => {
    if (content != null) {
      setMarkdown(content);
      return;
    }
    const topic = learningSession?.topic;
    if (!topic || topic.type !== 'dra') {
      return;
    }
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

  // Local-only update (no server write) for in-flight edits like typing in the
  // reasoning record; persist() writes the full state to the progress record.
  function setLocalDetails(nextDetails) {
    setDraState({ details: nextDetails });
  }

  async function persist(nextDetails) {
    setDraState({ details: nextDetails });
    await courseOps.addProgress(null, null, 'dra', 0, nextDetails);
  }

  async function selectStage(stage) {
    if (isObserveReadOnly || details.activeStage === stage) {
      return;
    }
    await persist({ ...details, activeStage: stage });
  }

  async function sendInvestigationMessage(target, text) {
    const key = target.key;
    const conversations = details.conversations || {};
    // Tag the learner's message with the active stage so evidence can later be
    // attributed to a disciplinary stage.
    const withUser = [...(conversations[key] || []), { role: 'user', text, stage: details.activeStage || '' }];
    setLocalDetails({ ...details, conversations: { ...conversations, [key]: withUser } });

    try {
      const reply = await courseOps.getDraStakeholderResponse(details.scenario, target, withUser);
      await persist({ ...details, conversations: { ...conversations, [key]: [...withUser, { role: 'model', text: reply }] } });
    } catch {
      // Keep the learner's question saved even if the agent fails to respond.
      await persist({ ...details, conversations: { ...conversations, [key]: withUser } });
      alert('The interview partner could not respond. Please try again.');
    }
  }

  function updateReasoning(field, value) {
    setLocalDetails({ ...details, reasoningRecord: { ...(details.reasoningRecord || {}), [field]: value } });
  }

  async function saveReasoning() {
    if (isObserveReadOnly) {
      return;
    }
    await persist(details);
  }

  async function generateScenario(runMode = 'practice') {
    if (isObserveReadOnly || busy) {
      return;
    }
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
    if (isObserveReadOnly || busy) {
      return;
    }
    if (!window.confirm('Start the final assessment? Once it begins the scenario is locked and must be completed.')) {
      return;
    }
    await generateScenario('final');
  }

  async function cancelScenario() {
    if (isObserveReadOnly || busy) {
      return;
    }
    await persist({ state: 'notStarted' });
  }

  function buildTranscripts(source) {
    return Object.entries(source.conversations || {}).map(([key, messages]) => {
      const [type, idx] = key.split(':');
      const target = (type === 'stakeholder' ? source.stakeholders : source.resources)?.[Number(idx)];
      return { name: target?.name || key, role: target?.role || target?.type || '', messages };
    });
  }

  async function computeEvaluation(source) {
    return courseOps.getDraEvaluation(source.scenario, buildTranscripts(source), source.reasoningRecord || {});
  }

  async function refreshEvaluation() {
    if (isObserveReadOnly || evaluating) {
      return;
    }
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
    if (isObserveReadOnly || busy) {
      return;
    }
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

  const generatingLabel = busy ? 'Generating...' : null;

  function renderBody() {
    if (isPreview || !user) {
      return (
        <div className="not-prose mt-6 rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          When a learner begins, a scenario is generated from these parameters.
          {!user && ' Login to take this assessment.'}
        </div>
      );
    }

    const canPractice = params.practiceMode;
    const canFinal = params.finalMode;

    // Only difficulty-revealed stakeholders/resources are available to interview;
    // the rest become discoverable during the investigation (a later phase).
    const disclosure = scenarioDisclosure(details.difficulty ?? params.difficulty);
    const targets = [
      ...(disclosure.showStakeholders ? (details.stakeholders || []).map((s, i) => ({ key: `stakeholder:${i}`, type: 'stakeholder', ...s })) : []),
      ...(disclosure.showResources ? (details.resources || []).map((r, i) => ({ key: `resource:${i}`, type: 'resource', ...r })) : []),
    ];

    const investigation = (readOnly) => (
      <DraInvestigation
        scenario={details.scenario}
        targets={targets}
        stages={details.stages || []}
        activeStage={details.activeStage || ''}
        onSelectStage={selectStage}
        conversations={details.conversations || {}}
        reasoningRecord={details.reasoningRecord || {}}
        onSendMessage={sendInvestigationMessage}
        onReasoningChange={updateReasoning}
        onReasoningBlur={saveReasoning}
        readOnly={readOnly}
        learningSession={learningSession}
      />
    );

    if (details.state === 'completed') {
      // A completed final run is terminal. After practice the learner may practice
      // again or, if final is enabled, move on to the final assessment.
      const wasFinal = details.mode === 'final';
      return (
        <>
          <div className="not-prose mt-6 rounded border border-blue-200 bg-blue-50 p-4">
            <div className="text-lg font-bold text-blue-600">Assessment complete</div>
            {details.completedAt && <div className="text-sm text-blue-400">Completed on {new Date(details.completedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
          </div>
          {!wasFinal && (
            <div className="not-prose mt-4 flex flex-wrap gap-2">
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
          <ScenarioView details={details} difficulty={details.difficulty ?? params.difficulty} learningSession={learningSession} />
          {investigation(true)}
          {details.evaluation && <DraEvaluation evaluation={details.evaluation} />}
        </>
      );
    }

    if (details.state === 'inProgress') {
      const locked = details.mode === 'final';
      return (
        <>
          <div className="not-prose mt-6 flex flex-wrap items-center gap-2">
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
          <ScenarioView details={details} difficulty={details.difficulty ?? params.difficulty} learningSession={learningSession} />
          {investigation(isObserveReadOnly)}
          {!locked && (
            <div className="not-prose mt-8">
              <button onClick={refreshEvaluation} disabled={isObserveReadOnly || evaluating} className="px-4 py-2 bg-gray-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-60 text-sm">
                {evaluating ? 'Evaluating...' : details.evaluation ? 'Update evaluation' : 'Evaluate my progress'}
              </button>
            </div>
          )}
          {!locked && details.evaluation && <DraEvaluation evaluation={details.evaluation} />}
        </>
      );
    }

    // notStarted
    return (
      <div className="not-prose mt-6 flex flex-col items-start gap-2">
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

  if (loading) {
    return <div />;
  }

  return (
    <div className="h-full w-full min-h-0 min-w-0 overflow-auto">
      <div className="markdown-body p-4 max-w-3xl mx-auto">
        <ParameterHeader params={params} learningSession={learningSession} />
        {renderBody()}
      </div>
    </div>
  );
}
