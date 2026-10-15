// Shared helpers for attendance sessions and check-ins.
//
// Session questions: [{ id, type: 'multiple-choice', prompt, choices: [] }]
// Attendance progress row details: { answers: { [questionId]: answer } }

// The standard wellness question asked at every check-in. Its id is stable so the
// charts can find a session's answers and tally them consistently over time.
export const DEFAULT_ATTENDANCE_QUESTION = {
  id: 'q1',
  type: 'multiple-choice',
  prompt: 'How are things going?',
  choices: ['Great', 'Good', 'OK', 'Struggling'],
};

// Ordered sentiment scale for the standard question (best -> worst), each with the
// colour used across the attendance charts. Attendees with no recognised answer
// (legacy sessions without the question, or a skipped answer) use NO_RESPONSE_COLOR.
export const ATTENDANCE_SENTIMENTS = [
  { value: 'Great', color: '#059669' }, // emerald-600
  { value: 'Good', color: '#34d399' }, // emerald-400
  { value: 'OK', color: '#fbbf24' }, // amber-400
  { value: 'Struggling', color: '#f87171' }, // red-400
];

export const NO_RESPONSE_COLOR = '#e5e7eb'; // gray-200

const SENTIMENT_BY_VALUE = new Map(ATTENDANCE_SENTIMENTS.map((sentiment) => [sentiment.value, sentiment]));

// Colour for a single answer; unknown/blank answers fall back to the neutral tone.
export function sentimentColor(answer) {
  return SENTIMENT_BY_VALUE.get(answer)?.color || NO_RESPONSE_COLOR;
}

// Ordered stacked segments for one session's bar, built from an answer tally
// ({ [choice]: count }) and the number who checked in. Recognised sentiments come
// first (best -> worst), then any unrecognised answers, then a trailing "No response"
// segment for attendees who didn't answer (or legacy sessions without the question) so
// the stacked height always equals the turnout.
export function sentimentSegments(answerCounts, attendeeCount) {
  const counts = answerCounts || {};
  const segments = [];
  let answered = 0;
  for (const sentiment of ATTENDANCE_SENTIMENTS) {
    const count = counts[sentiment.value] || 0;
    if (count > 0) {
      segments.push({ key: sentiment.value, label: sentiment.value, count, color: sentiment.color });
      answered += count;
    }
  }
  for (const [choice, count] of Object.entries(counts)) {
    if (!SENTIMENT_BY_VALUE.has(choice) && count > 0) {
      segments.push({ key: choice, label: choice, count, color: NO_RESPONSE_COLOR });
      answered += count;
    }
  }
  const noResponse = Math.max(0, (attendeeCount || 0) - answered);
  if (noResponse > 0) {
    segments.push({ key: '__none__', label: 'No response', count: noResponse, color: NO_RESPONSE_COLOR });
  }
  return segments;
}

// Pair every session with whether the learner checked in to it (oldest first), and
// carry the learner's answer to that session's question when they checked in. `answer`
// is null for absent sessions and for legacy sessions that had no question.
export function buildAttendanceHistory(sessions, attendanceRows) {
  const rowBySession = new Map((attendanceRows || []).map((row) => [row.interactionId, row]));
  return (sessions || [])
    .map((session) => {
      const row = rowBySession.get(session.id);
      const questionId = session.questions?.[0]?.id;
      const answer = (questionId && row?.details?.answers?.[questionId]) || null;
      return { session, present: !!row, answer };
    })
    .sort((a, b) => new Date(a.session.openedAt) - new Date(b.session.openedAt));
}

export function allQuestionsAnswered(questions, answers) {
  return questions.every((question) => !!answers[question.id]);
}

export function formatSessionDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
