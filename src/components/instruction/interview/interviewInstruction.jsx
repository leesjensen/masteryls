import React from 'react';
import { BadgeCheck, CircleDashed } from 'lucide-react';
import { parseInterviewMarkdown } from '../../../utils/interviewMarkdown';
import Markdown from '../../Markdown';
import TabBar from '../../shared/TabBar';
import CoachPanel from '../../shared/CoachPanel';
import InterviewWorkspace from './interviewWorkspace';
import InterviewEvaluation from './interviewEvaluation';
import Spinner from '../../Spinner';
import { generateId } from '../../../utils/utils';

function formatRunDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function InterviewInstruction({ courseOps, learningSession, user, content = null, instructionState }) {
  const [markdown, setMarkdown] = React.useState(content || '');
  const [activeTab, setActiveTab] = React.useState('overview');
  const [run, setRun] = React.useState(null);
  const [fullState, setFullState] = React.useState(null);
  const [loadingState, setLoadingState] = React.useState(true);
  const [coaching, setCoaching] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState(null);

  React.useEffect(() => {
    const topic = learningSession?.topic;
    if (content != null) { setMarkdown(content); return; }
    if (topic) courseOps.getTopic(topic).then((md) => setMarkdown(md || ''));
  }, [content, learningSession?.topic]);

  const params = React.useMemo(() => parseInterviewMarkdown(markdown), [markdown]);

  const isPreview = instructionState === 'preview';
  const canPractice = params.practiceMode;
  const canFinal = params.finalMode;
  const busy = Boolean(busyAction);

  React.useEffect(() => {
    if (!user || isPreview) { setLoadingState(false); return; }
    courseOps.getInterviewState().then((state) => {
      setFullState(state);
      const existing = (state?.practiceRuns || []).find((r) => r.runId === state.selectedPracticeRunId) || null;
      setRun(existing);
      setLoadingState(false);
    });
  }, [learningSession?.topic?.id]);

  // Auto-navigate to Scenario tab when a new run starts
  const prevRunIdRef = React.useRef(null);
  React.useEffect(() => {
    if (run?.runId && run.runId !== prevRunIdRef.current) {
      prevRunIdRef.current = run.runId;
      setActiveTab('scenario');
    }
  }, [run?.runId]);

  const runInProgress = run && !run.completedAt;
  const runComplete = run && Boolean(run.completedAt);
  const locked = run?.mode === 'final';
  const showCoaching = canPractice && runInProgress && run?.mode === 'practice';
  const practiceRuns = fullState?.practiceRuns || [];
  const showPracticeRunPicker = canPractice && practiceRuns.length > 0;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(run ? [{ id: 'scenario', label: 'Scenario' }] : []),
    ...(run ? [{ id: 'interview', label: 'Interview' }] : []),
    ...(showCoaching ? [{ id: 'coaching', label: 'Coaching' }] : []),
    ...(run ? [{ id: 'evaluation', label: 'Evaluation' }] : []),
  ];
  const safeActiveTab = tabs.some((t) => t.id === activeTab) ? activeTab : 'overview';

  async function persistRun(updatedRun) {
    const currentState = fullState || { practiceRuns: [], selectedPracticeRunId: null, finalRun: null };
    let updatedState;
    if (updatedRun.mode === 'final') {
      updatedState = { ...currentState, finalRun: updatedRun };
    } else {
      const runs = (currentState.practiceRuns || []).map((r) => (r.runId === updatedRun.runId ? updatedRun : r));
      updatedState = { ...currentState, practiceRuns: runs, selectedPracticeRunId: updatedRun.runId };
    }
    setFullState(updatedState);
    await courseOps.saveInterviewState(updatedState);
  }

  async function startRun(mode) {
    setBusyAction(mode === 'final' ? 'startFinal' : 'startPractice');
    try {
      const scenarioData = await courseOps.generateInterviewScenario({
        discipline: params.discipline,
        jobTitle: params.jobTitle,
        jobDescription: params.jobDescription,
        difficulty: params.difficulty,
        learningOutcomes: params.learningOutcomes,
      });

      const runId = generateId();
      const newSessions = (scenarioData?.sessions || []).map((s, i) => ({
        sessionId: `session_${i}`,
        title: s.title,
        objective: s.objective,
        interviewerKeys: s.interviewerKeys || [],
        targetQuestionCount: s.targetQuestionCount || 5,
        state: i === 0 ? 'inProgress' : 'pending',
        messages: [],
        completedAt: null,
        sessionSummary: '',
      }));

      const newRun = {
        runId,
        mode,
        difficulty: params.difficulty,
        createdAt: Date.now(),
        scenario: scenarioData.scenario || {},
        interviewers: scenarioData.interviewers || [],
        sessions: newSessions,
        currentSessionIndex: 0,
        evaluation: null,
        coaching: null,
        completedAt: null,
      };

      const currentState = fullState || { practiceRuns: [], selectedPracticeRunId: null, finalRun: null };
      let updatedState;
      if (mode === 'final') {
        updatedState = { ...currentState, finalRun: newRun };
      } else {
        updatedState = { ...currentState, practiceRuns: [...(currentState.practiceRuns || []), newRun], selectedPracticeRunId: runId };
      }

      await courseOps.saveInterviewState(updatedState);
      await courseOps.updateInterviewProgress({ state: updatedState, mode, sessionsCompleted: 0, totalSessions: newSessions.length }, { force: true });
      setFullState(updatedState);
      setRun(newRun);
    } finally {
      setBusyAction(null);
    }
  }

  async function cancelRun() {
    if (busy || locked) return;
    const currentState = fullState || { practiceRuns: [], selectedPracticeRunId: null, finalRun: null };
    const updatedState = { ...currentState, selectedPracticeRunId: null };
    setFullState(updatedState);
    setRun(null);
    setActiveTab('overview');
    await courseOps.saveInterviewState(updatedState);
  }

  async function completeRun() {
    if (!run || busy) return;
    setBusyAction('completeRun');
    try {
      let evaluation = run.evaluation;
      try {
        const completedSessions = (run.sessions || []).filter((s) => s.state === 'completed');
        evaluation = await courseOps.getInterviewEvaluation(run.scenario, completedSessions, run.interviewers, run.difficulty, run.evaluation);
      } catch {
        // fall back to existing evaluation
      }
      const completedRun = { ...run, evaluation, completedAt: Date.now() };
      await persistRun(completedRun);
      setRun(completedRun);
      setActiveTab('evaluation');
    } finally {
      setBusyAction(null);
    }
  }

  async function requestCoaching() {
    if (!run) return;
    setCoaching(true);
    try {
      const result = await courseOps.getInterviewCoaching(run.scenario, run.sessions, run.interviewers, run.difficulty, run.evaluation);
      const updatedRun = { ...run, coaching: result };
      setRun(updatedRun);
      await persistRun(updatedRun);
    } finally {
      setCoaching(false);
    }
  }

  function selectPracticeRun(runId) {
    const selected = practiceRuns.find((r) => r.runId === runId);
    if (!selected) return;
    const updatedState = { ...(fullState || {}), selectedPracticeRunId: runId };
    setFullState(updatedState);
    setRun(selected);
    setActiveTab('scenario');
  }

  function renderPracticeRunList(containerClassName = 'w-full max-w-3xl rounded border border-blue-200 bg-blue-50 p-3', headingClassName = 'text-sm font-semibold text-blue-700 mb-2') {
    if (!showPracticeRunPicker) return null;
    return (
      <div className={containerClassName}>
        <div className={headingClassName}>Practice interviews</div>
        <div className="space-y-2">
          {practiceRuns.map((r, index) => {
            const isSelected = fullState?.selectedPracticeRunId === r.runId;
            const isCompleted = Boolean(r.completedAt);
            const title = r.scenario?.title || r.scenario?.company || `Practice run ${index + 1}`;
            return (
              <button key={r.runId} type="button" onClick={() => selectPracticeRun(r.runId)} className={`w-full rounded border px-3 py-2 text-left transition-colors ${isSelected ? 'border-blue-500 bg-blue-600 text-white' : isCompleted ? 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100' : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-100'}`}>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {isCompleted
                    ? <BadgeCheck size={14} className={isSelected ? 'text-white shrink-0' : 'text-blue-500 shrink-0'} />
                    : <CircleDashed size={14} className={isSelected ? 'text-blue-100 shrink-0' : 'text-blue-400 shrink-0'} />}
                  {title}
                </div>
                <div className={`mt-1 text-xs ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                  Started {formatRunDate(r.createdAt)}
                  {isCompleted && <> · Completed {formatRunDate(r.completedAt)}</>}
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

    if (!run) {
      return (
        <div className="not-prose mt-4 flex flex-col items-start gap-2">
          <p className="text-sm text-gray-600">
            {canPractice && canFinal
              ? 'Choose practice to explore freely or start the final assessment when you are ready.'
              : canPractice
                ? 'Start a practice interview to generate a unique scenario. You can repeat practice as many times as you like.'
                : 'Start the final interview. The scenario is locked once started.'}
          </p>
          {renderPracticeRunList()}
          <div className="flex flex-wrap gap-2">
            {canPractice && (
              <button disabled={busy} onClick={() => startRun('practice')} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60">
                {busyAction === 'startPractice' && <Spinner />}
                {busyAction === 'startPractice' ? 'Generating…' : 'Start practice interview'}
              </button>
            )}
            {canFinal && (
              <button disabled={busy} onClick={() => startRun('final')} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60">
                {busyAction === 'startFinal' && <Spinner />}
                {busyAction === 'startFinal' ? 'Generating…' : 'Start final interview'}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (runInProgress) {
      return (
        <div className="not-prose flex flex-wrap items-center justify-end gap-2">
          <div className="hidden sm:flex min-w-0 items-center gap-2 text-sm text-blue-700">
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold">In progress</span>
            {locked && <span className="text-xs text-blue-500">Final interview</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!locked && (
              <button disabled={busy} onClick={cancelRun} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded border border-gray-200 hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
            )}
            <button disabled={busy} onClick={completeRun} className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60">
              {busyAction === 'completeRun' && <Spinner />}
              Complete assessment
            </button>
          </div>
        </div>
      );
    }

    if (runComplete) {
      return (
        <div className="not-prose flex flex-wrap items-center justify-end gap-2">
          <div className="hidden sm:flex items-center gap-2 text-sm text-blue-700">
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold">Complete</span>
          </div>
          {!locked && (
            <div className="flex flex-wrap gap-2">
              {canPractice && (
                <button disabled={busy} onClick={() => startRun('practice')} className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60">
                  {busyAction === 'startPractice' && <Spinner />}
                  {busyAction === 'startPractice' ? 'Generating…' : 'New practice run'}
                </button>
              )}
              {canFinal && (
                <button disabled={busy} onClick={() => startRun('final')} className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60">
                  {busyAction === 'startFinal' && <Spinner />}
                  {busyAction === 'startFinal' ? 'Generating…' : 'Start final interview'}
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
            <div className="not-prose pt-8">
              <details className="rounded-lg border border-blue-200 bg-blue-50 open:pb-4" open>
                <summary className="cursor-pointer select-none rounded-lg px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100 list-none">How this assessment works</summary>
                <div className="px-4 pt-2 space-y-4">
                  <ol className="space-y-3 text-sm text-gray-700">
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                      <div>
                        <strong>Start an interview.</strong>{' '}
                        {canPractice && canFinal
                          ? 'Choose practice to explore freely, or start the final assessment when you are ready.'
                          : canPractice
                            ? 'Click "Start practice interview" to generate a unique scenario and session schedule. You can start new practice runs as many times as you like.'
                            : 'Click "Start final interview" to begin. The scenario is locked once started and must be completed.'}
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
                      <div>
                        <strong>Read the Scenario tab.</strong> Review the company context, the role you are interviewing for, and your interview schedule. You will see who will be interviewing you and what each session is designed to assess.
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
                      <div>
                        <strong>Work through the Interview tab.</strong> Participate in each session. The AI interviewers will ask questions and follow up on your answers. The sidebar shows your progress through the schedule.
                        {canPractice && (
                          <span> In practice mode, the <strong>Coaching</strong> tab provides AI feedback, and you can view your <strong>Evaluation</strong> at any time.</span>
                        )}
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">4</span>
                      <div>
                        <strong>Complete and review.</strong> Click "Complete assessment" when you are done. A final AI evaluation of your performance will appear on the Evaluation tab.
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
                              <li>Cancel and start fresh freely</li>
                              <li>Coaching tab available throughout</li>
                              <li>Evaluation can be viewed at any time</li>
                              <li>Repeat as many times as you like</li>
                            </ul>
                          </div>
                        )}
                        {canFinal && (
                          <div className="rounded border border-amber-200 bg-white px-3 py-2 text-sm">
                            <div className="mb-1 font-semibold text-amber-800">Final assessment</div>
                            <ul className="space-y-1 text-xs text-gray-600 list-disc list-inside">
                              <li>Scenario is locked once started</li>
                              <li>Cannot be cancelled</li>
                              <li>Coaching and mid-assessment evaluation are not available</li>
                              <li>Evaluation is generated on completion</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Evaluation</div>
                    <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 space-y-2">
                      <p>Your performance is measured across three areas using evidence drawn from your interview conversations:</p>
                      <ul className="space-y-1 list-disc list-inside text-xs text-gray-600">
                        <li><strong>Interview sessions:</strong> how well you performed in each individual session.</li>
                        <li><strong>Competency:</strong> domain knowledge, communication, problem solving, and technical depth.</li>
                        <li><strong>Disposition:</strong> professional mindset, curiosity, and approach throughout.</li>
                      </ul>
                      <p className="text-xs text-gray-600">Each area is rated on a five-point mastery continuum: Beginning, Emerging, Developing, Proficient, and Exemplary.</p>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {(isPreview || !user) && (
              <div className="not-prose mt-4 rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                When a learner begins, an interview scenario is generated from these parameters.
                {!user && (
                  <> <a href="/" className="font-semibold underline underline-offset-2 hover:text-gray-800">Login</a> to take this assessment.</>
                )}
              </div>
            )}
          </div>
        );

      case 'scenario':
        if (!run?.scenario) return <div className="mt-4 text-sm text-gray-500">Start an interview to generate the scenario.</div>;
        return (
          <div className="not-prose mt-4 space-y-4">
            {renderPracticeRunList('mb-4 rounded border border-blue-200 bg-blue-50 p-3', 'text-sm font-semibold text-blue-700 mb-2')}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Company</div>
              <div className="text-sm font-semibold text-gray-800">{run.scenario.company || run.scenario.title}</div>
              {run.scenario.roleContext && <p className="mt-1 text-sm text-gray-700">{run.scenario.roleContext}</p>}
            </div>
            {run.scenario.description && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Context</div>
                <p className="text-sm text-gray-700">{run.scenario.description}</p>
              </div>
            )}
            {(run.interviewers || []).length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Your interviewers</div>
                <div className="grid gap-1.5">
                  {run.interviewers.map((iv, i) => (
                    <div key={i} className="rounded border border-gray-200 bg-white px-3 py-2 text-sm">
                      <div className="font-semibold text-gray-800">{iv.name} <span className="font-normal text-gray-500">— {iv.role}</span></div>
                      {iv.objectives && <div className="text-xs text-gray-500 mt-0.5">Evaluating: {iv.objectives}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(run.sessions || []).length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Session schedule</div>
                <div className="grid gap-1.5">
                  {run.sessions.map((s, i) => {
                    const sessionIvs = (run.interviewers || []).filter((iv) => (s.interviewerKeys || []).includes(iv.key));
                    return (
                      <div key={i} className="rounded border border-gray-200 bg-white px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-600">{i + 1}</span>
                          <span className="font-semibold text-gray-800">{s.title}</span>
                        </div>
                        {s.objective && <div className="text-xs text-gray-500 mt-0.5 ml-7">{s.objective}</div>}
                        {sessionIvs.length > 0 && <div className="text-xs text-gray-400 mt-0.5 ml-7">With: {sessionIvs.map((iv) => iv.name).join(', ')}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 'interview':
        return null; // rendered outside scroll container below

      case 'coaching':
        return (
          <div className="mt-4">
            <CoachPanel coaching={run?.coaching} onRequest={requestCoaching} busy={coaching} readOnly={!run} />
          </div>
        );

      case 'evaluation':
        if (!run?.evaluation) return <div className="mt-4 text-sm text-gray-500">Complete at least one session to see an evaluation.</div>;
        return (
          <div className="mt-4">
            <InterviewEvaluation evaluation={run.evaluation} difficulty={run.difficulty || params.difficulty} />
          </div>
        );

      default:
        return null;
    }
  }

  if (loadingState) return null;

  return (
    <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
      <div className="px-4 pt-4 shrink-0">
        <div className="not-prose flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 m-0">{params.title || learningSession?.topic?.title || 'Interview Assessment'}</h1>
          {(runInProgress || runComplete) && renderActionButtons()}
        </div>
        {!run && renderActionButtons()}
        {tabs.length > 1 && <TabBar tabs={tabs} active={safeActiveTab} onChange={setActiveTab} />}
      </div>

      {safeActiveTab === 'interview' ? (
        <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
          <InterviewWorkspace
            courseOps={courseOps}
            learningSession={learningSession}
            user={user}
            params={params}
            run={run}
            setRun={setRun}
            persistRun={persistRun}
            onStartRun={startRun}
            busyAction={busyAction}
            setActiveTab={setActiveTab}
          />
        </div>
      ) : (
        <div className="flex-1 mt-0 min-h-0 overflow-auto">
          <div className="markdown-body px-4 pb-4">{renderTabContent()}</div>
        </div>
      )}
    </div>
  );
}
