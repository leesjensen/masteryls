import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { generateId } from '../../../utils/utils';
import Spinner from '../../Spinner';
import ChatPanel from '../../shared/ChatPanel';

function SessionSidebar({ sessions, currentIndex }) {
  return (
    <div className="flex flex-col gap-1 p-3 border-r border-gray-200 min-w-[160px] max-w-[200px] bg-gray-50 shrink-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Sessions</div>
      {sessions.map((s, i) => {
        const isDone = s.state === 'completed';
        const isActive = i === currentIndex && !isDone;
        return (
          <div key={i} className={`flex items-start gap-2 rounded px-2 py-1.5 text-sm ${isActive ? 'bg-white border border-blue-200 text-blue-800 font-medium shadow-sm' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>
            <div className="mt-0.5 shrink-0">
              {isDone ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Circle size={14} className={isActive ? 'text-blue-500 fill-blue-100' : 'text-gray-300'} />}
            </div>
            <div className="min-w-0 truncate">{s.title}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function InterviewWorkspace({ courseOps, learningSession, user, params, run, setRun, persistRun, onStartRun, busyAction, setActiveTab }) {
  const [sending, setSending] = React.useState(false);
  const [openingPending, setOpeningPending] = React.useState(false);

  const sessions = run?.sessions || [];
  const currentSessionIndex = run?.currentSessionIndex ?? 0;
  const currentSession = sessions[currentSessionIndex] || null;
  const allSessionsDone = sessions.length > 0 && sessions.every((s) => s.state === 'completed');
  const busy = Boolean(busyAction);

  // Send opening message when the current session has no messages yet
  React.useEffect(() => {
    if (!run || !currentSession || currentSession.messages.length > 0 || sending || openingPending) return;
    if (currentSession.state !== 'inProgress') return;
    setOpeningPending(true);
    sendInterviewerOpening(run, currentSession).finally(() => setOpeningPending(false));
  }, [run?.runId, currentSessionIndex, currentSession?.messages?.length]);

  async function sendInterviewerOpening(runData, session) {
    const result = await courseOps.getInterviewSessionResponse(runData.scenario, session, runData.interviewers, [], runData.difficulty);
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

      const result = await courseOps.getInterviewSessionResponse(
        run.scenario,
        { ...currentSession, messages: updatedMessages },
        run.interviewers,
        updatedMessages,
        run.difficulty,
      );

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
      let nextIndex = currentSessionIndex;

      if (result?.sessionComplete) {
        finalSession = { ...finalSession, state: 'completed', completedAt: Date.now(), sessionSummary: result.sessionSummary || '' };
        finalSessions[currentSessionIndex] = finalSession;
        if (currentSessionIndex + 1 < finalSessions.length) {
          nextIndex = currentSessionIndex + 1;
          finalSessions[nextIndex] = { ...finalSessions[nextIndex], state: 'inProgress' };
        }
      } else {
        finalSessions[currentSessionIndex] = finalSession;
      }

      let finalRun = { ...run, sessions: finalSessions, currentSessionIndex: nextIndex };

      if (result?.sessionComplete) {
        const completedSessions = finalSessions.filter((s) => s.state === 'completed');
        const evaluation = await courseOps.getInterviewEvaluation(
          run.scenario, completedSessions, run.interviewers, run.difficulty, run.evaluation,
        );
        finalRun = { ...finalRun, evaluation };
        if (nextIndex === currentSessionIndex) {
          finalRun = { ...finalRun, completedAt: Date.now() };
        }
      }

      await persistRun(finalRun);
      setRun(finalRun);
    } finally {
      setSending(false);
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

  if (allSessionsDone) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
          <CheckCircle2 size={16} /> All sessions complete
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setActiveTab('evaluation')} className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">View evaluation</button>
          {params.practiceMode && (
            <button onClick={() => onStartRun('practice')} disabled={busy} className="inline-flex items-center gap-2 px-4 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-60">
              {busyAction === 'startPractice' && <Spinner className="border-gray-200 border-t-gray-600" />}
              New practice run
            </button>
          )}
        </div>
        <SessionSidebar sessions={sessions} currentIndex={-1} />
      </div>
    );
  }

  const sessionMessages = currentSession?.messages || [];
  const sessionInterviewers = (run.interviewers || []).filter((iv) => (currentSession?.interviewerKeys || []).includes(iv.key));

  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden h-full">
      <SessionSidebar sessions={sessions} currentIndex={currentSessionIndex} />

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
            placeholder="Type your response…"
            emptyText="The interview is starting…"
          />
        </div>
      </div>
    </div>
  );
}
