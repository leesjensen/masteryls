const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayNumber(day) {
  return day ? Date.parse(`${day}T00:00:00Z`) / DAY_MS : null;
}

export function summarizeLearnerActivity(records, { asOf = new Date(), topicTitleById = new Map(), maxEvents = 12, olderRecordsOmitted = false } = {}) {
  const validRecords = (Array.isArray(records) ? records : [])
    .filter((record) => record?.createdAt && record?.type && !Number.isNaN(new Date(record.createdAt).getTime()) && new Date(record.createdAt).getTime() <= new Date(asOf).getTime())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const currentTime = new Date(asOf).getTime();
  const currentDay = dayKey(asOf);
  const latestDay = dayKey(validRecords[0]?.createdAt);
  const previousActiveDay = validRecords.map((record) => dayKey(record.createdAt)).find((day) => day && day < latestDay) || null;
  const recentEvents = validRecords.slice(0, maxEvents).map((record) => ({
    at: record.createdAt,
    type: String(record.type),
    ...(record.topicId && topicTitleById.get(String(record.topicId)) ? { topic: topicTitleById.get(String(record.topicId)) } : {}),
    ...(Number.isFinite(Number(record.duration)) && Number(record.duration) > 0 ? { durationSeconds: Number(record.duration) } : {}),
    ...(record.type === 'quizSubmit' && record.details?.type ? { interactionType: String(record.details.type) } : {}),
    ...(record.type === 'quizSubmit' && Number.isFinite(Number(record.details?.percentCorrect)) ? { scorePercent: Number(record.details.percentCorrect) } : {}),
  }));

  return {
    status: 'available',
    recordsIncluded: validRecords.length,
    olderRecordsOmitted,
    eventsLast7Days: validRecords.filter((record) => currentTime - new Date(record.createdAt).getTime() <= 7 * DAY_MS && new Date(record.createdAt).getTime() <= currentTime).length,
    eventsLast30Days: validRecords.filter((record) => currentTime - new Date(record.createdAt).getTime() <= 30 * DAY_MS && new Date(record.createdAt).getTime() <= currentTime).length,
    eventsOnLatestDay: latestDay ? validRecords.filter((record) => dayKey(record.createdAt) === latestDay).length : 0,
    latestActivityAt: validRecords[0]?.createdAt || null,
    previousActiveDay,
    daysSincePreviousActiveDay: latestDay && previousActiveDay ? dayNumber(latestDay) - dayNumber(previousActiveDay) : null,
    asOfDate: currentDay,
    recentEvents,
  };
}

export function summarizeSectionAttendance(sessions, attendanceRows, { questionId = 'q1', maxSessions = 8 } = {}) {
  const sessionList = (Array.isArray(sessions) ? sessions : []).filter((session) => session?.id);
  const rowsBySession = new Map((Array.isArray(attendanceRows) ? attendanceRows : []).map((row) => [String(row.interactionId), row]));
  const closedSessions = sessionList.filter((session) => Boolean(session.closedAt));
  const attendedClosedSessions = closedSessions.filter((session) => rowsBySession.has(String(session.id)));
  const sessionsByDate = [...sessionList].sort((a, b) => new Date(b.openedAt || 0) - new Date(a.openedAt || 0));
  const responsesByChoice = {};
  const recentSessions = sessionsByDate.slice(0, maxSessions).map((session) => {
    const row = rowsBySession.get(String(session.id));
    const question = (Array.isArray(session.questions) ? session.questions : []).find((item) => item?.id === questionId || item?.prompt === 'How are things going?');
    const answer = question?.id ? row?.details?.answers?.[question.id] || null : null;
    if (answer) responsesByChoice[answer] = (responsesByChoice[answer] || 0) + 1;
    return {
      date: session.openedAt || null,
      attended: Boolean(row),
      ...(question ? { wellnessQuestion: question.prompt || 'How are things going?' } : {}),
      ...(answer ? { response: String(answer) } : {}),
      closed: Boolean(session.closedAt),
    };
  });
  // Include all responses, not just the recent-session display window.
  for (const session of sessionList.slice(maxSessions)) {
    const row = rowsBySession.get(String(session.id));
    const question = (Array.isArray(session.questions) ? session.questions : []).find((item) => item?.id === questionId || item?.prompt === 'How are things going?');
    const answer = question?.id ? row?.details?.answers?.[question.id] || null : null;
    if (answer) responsesByChoice[answer] = (responsesByChoice[answer] || 0) + 1;
  }

  return {
    status: 'available',
    closedSessionCount: closedSessions.length,
    attendedClosedSessionCount: attendedClosedSessions.length,
    missedClosedSessionCount: Math.max(0, closedSessions.length - attendedClosedSessions.length),
    attendancePercent: closedSessions.length ? Math.round((attendedClosedSessions.length / closedSessions.length) * 100) : null,
    wellnessResponseCount: Object.values(responsesByChoice).reduce((sum, count) => sum + count, 0),
    wellnessResponsesByChoice: responsesByChoice,
    recentSessions,
  };
}
