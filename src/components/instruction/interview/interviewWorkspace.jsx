import React from 'react';
import { BadgeCheck, Circle, CircleDashed, UserRound } from 'lucide-react';
import { generateId } from '../../../utils/utils';
import Spinner from '../../Spinner';
import ChatPanel from '../../shared/ChatPanel';

function SessionSidebar({ sessions = [], currentIndex = -1, selectedIndex = -1, allInterviewers = [], onSelect, isRunComplete = false, onSelectCompletion }) {
  const interviewerMap = React.useMemo(() => {
    const map = new Map();
    allInterviewers.forEach((iv) => map.set(iv.key, iv));
    return map;
  }, [allInterviewers]);

  return (
    <div className="flex flex-col p-3 border-r border-gray-200 min-w-[180px] max-w-[220px] bg-gray-50 shrink-0 overflow-y-auto">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Schedule</div>
      <div className="flex flex-col gap-2">
        {sessions.map((s, i) => {
          const isDone = s.state === 'completed';
          const isLive = i === currentIndex;
          const isSelected = i === selectedIndex;
          const isClickable = isDone || isLive;
          const sessionIvs = (s.interviewerKeys || []).map((k) => interviewerMap.get(k)).filter(Boolean);

          let cardClass = 'rounded-lg border px-3 py-2 transition-colors ';
          if (isSelected && isLive) cardClass += 'bg-blue-50 border-blue-300 cursor-pointer';
          else if (isSelected) cardClass += 'bg-white border-gray-400 cursor-pointer';
          else if (isLive) cardClass += 'bg-blue-50 border-blue-200 cursor-pointer hover:border-blue-300';
          else if (isDone) cardClass += 'bg-white border-gray-200 cursor-pointer hover:border-gray-300 hover:bg-gray-50';
          else cardClass += 'bg-white border-gray-200 opacity-50';

          return (
            <div key={i} className={cardClass} onClick={isClickable ? () => onSelect(i) : undefined}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="shrink-0">
                  {isDone
                    ? <BadgeCheck size={13} className="text-gray-400" />
                    : isLive
                      ? <CircleDashed size={13} className="text-blue-500" />
                      : <Circle size={13} className="text-gray-300" />}
                </div>
                <div className={`text-xs font-semibold truncate ${isLive ? 'text-blue-800' : isDone ? 'text-gray-600' : 'text-gray-400'}`}>
                  {s.title}
                </div>
              </div>
              {sessionIvs.length > 0 && (
                <div className="flex flex-col gap-1 pl-0.5">
                  {sessionIvs.map((iv) => (
                    <div key={iv.key} className="flex items-center gap-1.5">
                      <UserRound size={11} className={`shrink-0 ${isLive ? 'text-blue-400' : 'text-gray-300'}`} />
                      <div className="min-w-0">
                        <span className={`text-[11px] font-medium ${isLive ? 'text-blue-700' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>{iv.name}</span>
                        {iv.role && <span className={`text-[10px] ml-1 ${isLive ? 'text-blue-400' : 'text-gray-400'}`}>· {iv.role}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isRunComplete && (
          <div
            onClick={onSelectCompletion}
            className={`rounded-lg border px-3 py-3 cursor-pointer transition-colors flex items-center justify-center gap-2
              ${selectedIndex === null
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
              }`}
          >
            <BadgeCheck size={15} className={selectedIndex === null ? 'text-blue-500' : 'text-gray-400'} />
            <span className="text-xs font-semibold">Interview Complete</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterviewWorkspace({ courseOps, learningSession, user, params, run, setRun, persistRun, onStartRun, busyAction, setActiveTab }) {
  const [sending, setSending] = React.useState(false);
  const [openingPending, setOpeningPending] = React.useState(false);
  const [advancing, setAdvancing] = React.useState(false);
  const [viewIndex, setViewIndex] = React.useState(null);

  const sessions = run?.sessions || [];
  const currentSessionIndex = run?.currentSessionIndex ?? 0;
  const currentSession = sessions[currentSessionIndex] || null;
  const busy = Boolean(busyAction);

  // When the active session advances, snap back to the live view
  React.useEffect(() => {
    setViewIndex(null);
  }, [currentSessionIndex]);

  const viewedIndex = viewIndex ?? currentSessionIndex;
  const viewedSession = sessions[viewedIndex] || null;
  const isViewingPast = viewedIndex !== currentSessionIndex;
  const isCurrentSessionDone = currentSession?.state === 'completed';

  function handleSelectSession(i) {
    setViewIndex((prev) => (prev === i ? null : i));
  }

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

  const isRunComplete = Boolean(run.completedAt);
  const nextSession = sessions[currentSessionIndex + 1] ?? null;
  const isLastSession = currentSessionIndex === sessions.length - 1;
  const viewedSessionInterviewers = (run.interviewers || []).filter((iv) => (viewedSession?.interviewerKeys || []).includes(iv.key));

  const advanceFooter = isCurrentSessionDone && !isLastSession && !isRunComplete ? (
    <div className="flex items-center gap-2">
      <button
        onClick={handleAdvanceSession}
        disabled={advancing}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-60"
      >
        {advancing && <Spinner className="border-blue-300 border-t-white" />}
        Begin: {nextSession?.title}
      </button>
    </div>
  ) : null;

  const mainPanel = isRunComplete && viewIndex === null ? (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 p-8 text-center">
      <BadgeCheck size={40} className="text-green-500" />
      <div>
        <div className="text-base font-semibold text-gray-800 mb-1">Interview complete</div>
        <div className="text-sm text-gray-500">Your evaluation is ready. You can also select any session in the schedule to review the conversation.</div>
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
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
      </div>
    </div>
  ) : (
    <>
      <div className="px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="text-sm font-semibold text-gray-800">{viewedSession?.title}</div>
        <div className="text-[11px] text-gray-500">
          {viewedSessionInterviewers.map((iv) => iv.name).join(' & ')}
          {viewedSession?.objective ? ` · ${viewedSession.objective}` : ''}
        </div>
      </div>
      <div className="flex-1 min-h-0 p-3 overflow-hidden flex flex-col">
        <ChatPanel
          messages={viewedSession?.messages || []}
          onSend={handleSend}
          learningSession={learningSession}
          sending={sending || openingPending}
          readOnly={isViewingPast || isCurrentSessionDone}
          placeholder="Type your response…"
          emptyText="The interview is starting…"
          footer={advanceFooter}
        />
      </div>
    </>
  );

  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden h-full">
      <SessionSidebar
        sessions={sessions}
        currentIndex={isRunComplete || isCurrentSessionDone ? -1 : currentSessionIndex}
        selectedIndex={viewIndex}
        allInterviewers={run.interviewers || []}
        onSelect={handleSelectSession}
        isRunComplete={isRunComplete}
        onSelectCompletion={() => setViewIndex(null)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {mainPanel}
      </div>
    </div>
  );
}
