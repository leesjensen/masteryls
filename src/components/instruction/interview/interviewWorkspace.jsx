import React from 'react';
import { BadgeCheck, Circle, CircleDashed, UserRound } from 'lucide-react';
import { generateId } from '../../../utils/utils';
import Spinner from '../../Spinner';
import ChatPanel from '../../shared/ChatPanel';

function SessionSidebar({ sessions = [], currentIndex = -1, interviewers = [] }) {
  return (
    <div className="flex flex-col gap-1 p-3 border-r border-gray-200 min-w-[160px] max-w-[200px] bg-gray-50 shrink-0 overflow-y-auto">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Sessions</div>
      {sessions.map((s, i) => {
        const isDone = s.state === 'completed';
        const isActive = i === currentIndex && !isDone;
        return (
          <div key={i} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${isActive ? 'bg-blue-50 border border-blue-200 text-blue-800 font-medium' : isDone ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className="shrink-0">
              {isDone
                ? <BadgeCheck size={13} className="text-gray-400" />
                : isActive
                  ? <CircleDashed size={13} className="text-blue-500" />
                  : <Circle size={13} className="text-gray-300" />}
            </div>
            <div className="min-w-0 truncate">{s.title}</div>
          </div>
        );
      })}

      {interviewers.length > 0 && (
        <>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1 mt-3">Interviewers</div>
          {interviewers.map((iv) => (
            <div key={iv.key} className="flex items-start gap-2 rounded px-2 py-2 border border-blue-200 bg-blue-50 text-blue-800">
              <div className="mt-0.5 shrink-0">
                <UserRound size={16} className="text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight break-words">{iv.name}</div>
                <div className="text-xs text-gray-500 leading-tight break-words">{iv.role}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function InterviewWorkspace({ courseOps, learningSession, user, params, run, setRun, persistRun, onStartRun, busyAction, setActiveTab }) {
  const [sending, setSending] = React.useState(false);
  const [openingPending, setOpeningPending] = React.useState(false);
  const [advancing, setAdvancing] = React.useState(false);

  const sessions = run?.sessions || [];
  const currentSessionIndex = run?.currentSessionIndex ?? 0;
  const currentSession = sessions[currentSessionIndex] || null;
  const busy = Boolean(busyAction);

  // Send opening message when the current session has no messages yet
  React.useEffect(() => {
    if (!run || !currentSession || currentSession.messages.length > 0 || sending || openingPending) return;
    if (currentSession.state !== 'inProgress') return;
    setOpeningPending(true);
    sendInterviewerOpening(run, currentSession).finally(() => setOpeningPending(false));
  }, [run?.runId, currentSessionIndex, currentSession?.messages?.length]);

  async function sendInterviewerOpening(runData, session) {
    let result;
    try {
      result = await courseOps.getInterviewSessionResponse(runData.scenario, session, runData.interviewers, [], runData.difficulty);
    } catch {
      result = null;
    }
    if (!result?.replies?.length) return;

    const aiMessages = result.replies.map((r) => ({
      id: generateId(),
      role: 'model',
      speakerKey: r.speakerKey,
      speakerName: r.speakerName,
      speakerRole: r.speakerRole,
      text: r.text,
    }));

    const updatedSession = { ...session, messages: aiMessages };
    const updatedSessions = runData.sessions.map((s, i) => (i === runData.currentSessionIndex ? updatedSession : s));
    const updatedRun = { ...runData, sessions: updatedSessions };
    await persistRun(updatedRun);
    setRun(updatedRun);
  }

  async function handleSend(text) {
    if (!currentSession) return;

    const userMessage = {
      id: generateId(),
      role: 'user',
      speakerKey: 'candidate',
      speakerName: 'You',
      speakerRole: '',
      text,
    };

    setSending(true);
    try {
      const updatedMessages = [...(currentSession.messages || []), userMessage];
      // Optimistic update with user message
      const sessionsWithUser = run.sessions.map((s, i) => (i === currentSessionIndex ? { ...currentSession, messages: updatedMessages } : s));
      setRun({ ...run, sessions: sessionsWithUser });

      let result;
      try {
        result = await courseOps.getInterviewSessionResponse(
          run.scenario,
          { ...currentSession, messages: updatedMessages },
          run.interviewers,
          updatedMessages,
          run.difficulty,
        );
      } catch {
        result = null;
      }

      if (!result?.replies?.length && !result?.sessionComplete) {
        const errorMessage = {
          id: generateId(),
          role: 'model',
          speakerKey: 'system',
          speakerName: '',
          speakerRole: '',
          text: '_There was a problem getting a response. Please try sending your message again._',
        };
        const sessionsWithError = run.sessions.map((s, i) =>
          i === currentSessionIndex ? { ...currentSession, messages: [...updatedMessages, errorMessage] } : s,
        );
        setRun({ ...run, sessions: sessionsWithError });
        return;
      }

      const aiMessages = (result?.replies || []).map((r) => ({
        id: generateId(),
        role: 'model',
        speakerKey: r.speakerKey,
        speakerName: r.speakerName,
        speakerRole: r.speakerRole,
        text: r.text,
      }));

      const allMessages = [...updatedMessages, ...aiMessages];
      let finalSessions = [...run.sessions];
      let finalSession = { ...currentSession, messages: allMessages };

      if (result?.sessionComplete) {
        finalSession = { ...finalSession, state: 'completed', completedAt: Date.now(), sessionSummary: result.sessionSummary || '' };
      }
      finalSessions[currentSessionIndex] = finalSession;

      // Keep currentSessionIndex on the completed session — user advances manually
      let finalRun = { ...run, sessions: finalSessions, currentSessionIndex: currentSessionIndex };

      if (result?.sessionComplete) {
        const isLastSession = currentSessionIndex === sessions.length - 1;
        const completedSessions = finalSessions.filter((s) => s.state === 'completed');
        const evaluation = await courseOps.getInterviewEvaluation(
          run.scenario, completedSessions, run.interviewers, run.difficulty, run.evaluation,
        );
        finalRun = { ...finalRun, evaluation };
        if (isLastSession) {
          finalRun = { ...finalRun, completedAt: Date.now() };
        }
      }

      await persistRun(finalRun);
      setRun(finalRun);
    } finally {
      setSending(false);
    }
  }

  async function handleAdvanceSession() {
    const nextIdx = currentSessionIndex + 1;
    if (nextIdx >= sessions.length) return;
    setAdvancing(true);
    try {
      const updatedSessions = run.sessions.map((s, i) =>
        i === nextIdx ? { ...s, state: 'inProgress' } : s,
      );
      const updatedRun = { ...run, sessions: updatedSessions, currentSessionIndex: nextIdx };
      await persistRun(updatedRun);
      setRun(updatedRun);
    } finally {
      setAdvancing(false);
    }
  }

  if (!run) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">No interview started yet. Use the button above to generate a scenario and begin.</p>
        <div className="flex gap-3 flex-wrap">
          {params.practiceMode && (
            <button onClick={() => onStartRun('practice')} disabled={busy} className="inline-flex items-center gap-2 px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-60">
              {busyAction === 'startPractice' && <Spinner className="border-blue-300 border-t-white" />}
              {busyAction === 'startPractice' ? 'Generating…' : 'Start practice interview'}
            </button>
          )}
          {params.finalMode && (
            <button onClick={() => onStartRun('final')} disabled={busy} className="inline-flex items-center gap-2 px-4 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-60">
              {busyAction === 'startFinal' && <Spinner className="border-amber-300 border-t-white" />}
              {busyAction === 'startFinal' ? 'Generating…' : 'Start final interview'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const isCurrentSessionDone = currentSession?.state === 'completed';
  const nextSession = sessions[currentSessionIndex + 1] ?? null;
  const isLastSession = currentSessionIndex === sessions.length - 1;
  const sessionMessages = currentSession?.messages || [];
  const sessionInterviewers = (run.interviewers || []).filter((iv) => (currentSession?.interviewerKeys || []).includes(iv.key));

  const sessionFooter = isCurrentSessionDone ? (
    <div className="flex items-center gap-2 flex-wrap">
      {!isLastSession ? (
        <button
          onClick={handleAdvanceSession}
          disabled={advancing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {advancing && <Spinner className="border-blue-300 border-t-white" />}
          Begin: {nextSession?.title}
        </button>
      ) : (
        <>
          <button
            onClick={() => setActiveTab('evaluation')}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            View Evaluation
          </button>
          {params.practiceMode && (
            <button
              onClick={() => onStartRun('practice')}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              {busyAction === 'startPractice' && <Spinner className="border-gray-200 border-t-gray-600" />}
              New practice run
            </button>
          )}
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden h-full">
      <SessionSidebar sessions={sessions} currentIndex={isCurrentSessionDone ? -1 : currentSessionIndex} interviewers={isCurrentSessionDone ? [] : sessionInterviewers} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-200 bg-white shrink-0">
          <div className="text-sm font-semibold text-gray-800">{currentSession?.title}</div>
          <div className="text-[11px] text-gray-500">{sessionInterviewers.map((iv) => iv.name).join(' & ')}{currentSession?.objective ? ` · ${currentSession.objective}` : ''}</div>
        </div>

        <div className="flex-1 min-h-0 p-3 overflow-hidden flex flex-col">
          <ChatPanel
            messages={sessionMessages}
            onSend={handleSend}
            learningSession={learningSession}
            sending={sending || openingPending}
            readOnly={isCurrentSessionDone}
            placeholder="Type your response…"
            emptyText="The interview is starting…"
            footer={sessionFooter}
          />
        </div>
      </div>
    </div>
  );
}
