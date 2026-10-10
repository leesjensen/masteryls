// Shared helpers for attendance sessions and check-ins.
//
// Session questions: [{ id, type: 'multiple-choice', prompt, choices: [] }]
// Attendance progress row details: { answers: { [questionId]: answer } }

export const DEFAULT_ATTENDANCE_QUESTION = {
  id: 'q1',
  type: 'multiple-choice',
  prompt: 'How are things going?',
  choices: ['Great', 'Good', 'OK', 'Struggling'],
};

// Pair every session with whether the learner checked in to it, oldest first.
export function buildAttendanceHistory(sessions, attendanceRows) {
  const attendedIds = new Set((attendanceRows || []).map((row) => row.interactionId));
  return (sessions || []).map((session) => ({ session, present: attendedIds.has(session.id) })).sort((a, b) => new Date(a.session.openedAt) - new Date(b.session.openedAt));
}

// Count answers for each question: { [questionId]: { [choice]: count } }
export function tallyAttendanceAnswers(questions, responses) {
  const tally = {};
  for (const question of questions || []) {
    tally[question.id] = Object.fromEntries((question.choices || []).map((choice) => [choice, 0]));
  }
  for (const response of responses || []) {
    const answers = response?.details?.answers || {};
    for (const [questionId, answer] of Object.entries(answers)) {
      if (!tally[questionId]) tally[questionId] = {};
      tally[questionId][answer] = (tally[questionId][answer] || 0) + 1;
    }
  }
  return tally;
}

export function allQuestionsAnswered(questions, answers) {
  return questions.every((question) => !!answers[question.id]);
}

// Trim a question for saving: drop blank choices.
export function normalizeQuestion(question) {
  return {
    ...question,
    prompt: question.prompt.trim(),
    choices: question.choices.map((choice) => choice.trim()).filter(Boolean),
  };
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
