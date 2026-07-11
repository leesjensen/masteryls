import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { generateId } from '../../../utils/utils';
import Spinner from '../../Spinner';
import Markdown from '../../Markdown';

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

function ChatBubble({ message, interviewers, learningSession }) {
  const isCandidate = message.role === 'user';
  const interviewer = !isCandidate ? (interviewers || []).find((iv) => iv.key === message.speakerKey) : null;

  return (
    <div className={`flex flex-col ${isCandidate ? 'items-end' : 'items-start'} gap-0.5`}>
      <div className={`text-[11px] font-medium ${isCandidate ? 'text-gray-500' : 'text-blue-700'}`}>
        {isCandidate ? 'You' : message.speakerName || interviewer?.name || 'Interviewer'}
        {!isCandidate && (message.speakerRole || interviewer?.role) ? ` · ${message.speakerRole || interviewer?.role}` : ''}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${isCandidate ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
        {isCandidate ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.text}</span>
        ) : (
          <div className="markdown-body text-sm">
            <Markdown learningSession={learningSession} content={message.text} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterviewWorkspace({ courseOps, learningSession, user, params, run, setRun, persistRun, onStartRun, busyAction, setActiveTab }) {
  const [inputText, setInputText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [openingPending, setOpeningPending] = React.useState(false);
  const chatEndRef = React.useRef(null);

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

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages?.length, sending]);

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

  async function handleSend() {
    if (!inputText.trim() || sending || !currentSession) return;

    const userMessage = {
      id: generateId(),
      role: 'user',
      speakerKey: 'candidate',
      speakerName: 'You',
      speakerRole: '',
      text: inputText.trim(),
    };

    setInputText('');
    setSending(true);

    try {
      const updatedMessages = [...(currentSession.messages || []), userMessage];
      // Optimistic UI update with user message
      const sessionWithUser = { ...currentSession, messages: updatedMessages };
      const sessionsWithUser = run.sessions.map((s, i) => (i === currentSessionIndex ? sessionWithUser : s));
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

      // Generate evaluation after any session completes
      if (result?.sessionComplete) {
        const completedSessions = finalSessions.filter((s) => s.state === 'completed');
        const evaluation = await courseOps.getInterviewEvaluation(
          run.scenario, completedSessions, run.interviewers, run.difficulty, run.evaluation,
        );
        finalRun = { ...finalRun, evaluation };

        // If all sessions done, mark run complete
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

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!run) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">No interview started yet. Use the button above to generate a scenario and begin.</p>
        <div className="flex gap-3 flex-wrap">
          {params.practiceMode && (
            <button onClick={() => onStartRun('practice')} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-60">
              {busyAction === 'startPractice' && <Spinner className="border-blue-300 border-t-white" />}
              {busyAction === 'startPractice' ? 'Generating…' : 'Start practice interview'}
            </button>
          )}
          {params.finalMode && (
            <button onClick={() => onStartRun('final')} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-60">
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
          <button onClick={() => setActiveTab('evaluation')} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">View evaluation</button>
          {params.practiceMode && (
            <button onClick={() => onStartRun('practice')} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-60">
              {busyAction === 'startPractice' && <Spinner className="border-gray-200 border-t-gray-600" />}
              New practice run
            </button>
          )}
        </div>
        <div className="mt-2">
          <SessionSidebar sessions={sessions} currentIndex={-1} />
        </div>
      </div>
    );
  }

  const sessionMessages = currentSession?.messages || [];
  const sessionInterviewers = (run.interviewers || []).filter((iv) => (currentSession?.interviewerKeys || []).includes(iv.key));
  const isWaitingForOpening = currentSession?.state === 'inProgress' && sessionMessages.length === 0;

  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden h-full">
      <SessionSidebar sessions={sessions} currentIndex={currentSessionIndex} />

      <div className="flex flex-col flex-1 min-w-0">
        <div className="px-4 py-2 border-b border-gray-200 bg-white shrink-0">
          <div className="text-sm font-semibold text-gray-800">{currentSession?.title}</div>
          <div className="text-[11px] text-gray-500">{sessionInterviewers.map((iv) => iv.name).join(' & ')}{currentSession?.objective ? ` · ${currentSession.objective}` : ''}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {(isWaitingForOpening || (openingPending && sessionMessages.length === 0)) && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Spinner className="border-gray-200 border-t-gray-400" />
              Preparing interview...
            </div>
          )}
          {sessionMessages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} interviewers={run.interviewers} learningSession={learningSession} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Spinner className="border-gray-200 border-t-gray-400" />
              ...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="border-t border-gray-200 p-3 bg-white shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending || isWaitingForOpening || openingPending}
              rows={2}
              className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50"
              placeholder="Type your response… (Enter to send, Shift+Enter for newline)"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || sending || isWaitingForOpening || openingPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed h-[68px] whitespace-nowrap"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
