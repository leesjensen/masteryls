import { parseScheduleDisplayDate } from './scheduleMarkdown.js';
import { canvasTimestampToPulseDate } from './scheduleTiming.js';

function mean(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null;
}

export function resolvePulseScheduleDate(value, { startDate = null, endDate = null, referenceDate = new Date() } = {}) {
  const parsed = parseScheduleDisplayDate(value, referenceDate);
  if (!parsed) return null;
  const date = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  if (startDate && date < startDate) return null;
  if (endDate && date > endDate) return null;
  return date;
}

export function getPulseScheduleDueItems(weeks = [], dateOptions = {}) {
  return (Array.isArray(weeks) ? weeks : []).flatMap((week) => {
    const date = resolvePulseScheduleDate(week?.date, dateOptions);
    if (!date) return [];
    return (week?.dueItems || []).map((item) => ({
      date,
      displayDate: week.date,
      item: String(item?.text || '').replace(/^(?:☑|☐|✅|\[[ xX]\])\s*/, '').trim(),
    })).filter((item) => item.item);
  });
}

function normalizedAssignmentName(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findPulseScheduleMatches(assignmentName, deadlines = []) {
  const assignmentKey = normalizedAssignmentName(assignmentName);
  return deadlines.filter((item) => {
    const scheduleKey = normalizedAssignmentName(item.item);
    return scheduleKey && assignmentKey && (scheduleKey.includes(assignmentKey) || assignmentKey.includes(scheduleKey));
  }).sort((a, b) => normalizedAssignmentName(b.item).length - normalizedAssignmentName(a.item).length);
}

export function reconcilePulseCanvasAssignments(canvas, scheduleDeadlines = []) {
  const deadlines = Array.isArray(scheduleDeadlines) ? scheduleDeadlines : [];
  return {
    ...canvas,
    assignments: (canvas?.assignments || []).map(({ dueAt, ...assignment }) => {
      const matches = findPulseScheduleMatches(assignment.name, deadlines);
      const scheduleDate = matches[0]?.date || null;
      const canvasDueDate = canvasTimestampToPulseDate(dueAt);
      const dateDistance = scheduleDate && canvasDueDate
        ? Math.abs(Date.parse(`${scheduleDate}T00:00:00Z`) - Date.parse(`${canvasDueDate}T00:00:00Z`)) / 86400000
        : 0;
      return {
        ...assignment,
        canvasDueAt: dueAt || null,
        canvasDueDate,
        scheduleDate,
        ...(dateDistance > 1 ? { scheduleCanvasDateConflict: true } : {}),
      };
    }),
  };
}

/**
 * Attach Canvas completion to each schedule milestone. Canvas is the authority for whether work was
 * submitted/graded — MasteryLS in-app progress only captures learners who submitted through the app,
 * and undercounts those who submitted to Canvas directly. When a milestone matches a Canvas
 * assignment (accent/punctuation-insensitive name match), its `completionSource` becomes `canvas`
 * and it carries the Canvas completed/graded/missing/late/average; otherwise it stays `in-app`.
 * "completed" means the learner earned a positive grade or is excused (a zero, a `missing` zero, or an
 * ungraded assignment is not completed) — NOT the absence of a `missing` flag (Canvas only marks work
 * missing past due) nor `submittedAt` (pass-off-graded projects have no submission timestamp).
 */
export function reconcileScheduleDeadlinesWithCanvas(deadlines = [], canvasAssignments = []) {
  const assignments = Array.isArray(canvasAssignments) ? canvasAssignments : [];
  return (Array.isArray(deadlines) ? deadlines : []).map((deadline) => {
    const deadlineKey = normalizedAssignmentName(deadline.item);
    const match = assignments
      .filter((assignment) => {
        const key = normalizedAssignmentName(assignment.name);
        return key && deadlineKey && (key.includes(deadlineKey) || deadlineKey.includes(key));
      })
      .sort((a, b) => normalizedAssignmentName(b.name).length - normalizedAssignmentName(a.name).length)[0];
    if (!match) return { ...deadline, completionSource: 'in-app' };
    const learnersWithAssignment = finiteNumber(match.learnersWithAssignment) || 0;
    const completed = finiteNumber(match.completedCount) || 0;
    return {
      ...deadline,
      completionSource: 'canvas',
      canvas: {
        name: match.name,
        completed,
        notCompleted: Math.max(0, learnersWithAssignment - completed),
        graded: finiteNumber(match.gradedCount),
        missing: finiteNumber(match.missingCount) || 0,
        late: finiteNumber(match.lateCount) || 0,
        averagePercent: match.averagePercent ?? null,
        learnersWithAssignment,
      },
    };
  });
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function excludePulseStaffRows(rows = [], staffUserIds = []) {
  const excludedIds = new Set((Array.isArray(staffUserIds) ? staffUserIds : []).map(String));
  const roster = Array.isArray(rows) ? rows : [];
  const learners = roster.filter((row) => !excludedIds.has(String(row?.learnerId || '')));
  return { rows: learners, excludedCount: roster.length - learners.length };
}

export function buildPulseRosterEvidence(rows = [], { sections = [], schedules = [], asOf = new Date() } = {}) {
  const roster = Array.isArray(rows) ? rows : [];
  const mastery = roster.map((row) => Number(row.masteryPercent)).filter(Number.isFinite);
  const completedTopics = roster.map((row) => Number(row.completedTopics)).filter(Number.isFinite);
  const times = roster.map((row) => Number(row.totalTimeSpent)).filter((value) => Number.isFinite(value) && value >= 0);
  const activityTimes = roster.map((row) => row.lastActivityAt ? new Date(row.lastActivityAt).getTime() : NaN).filter(Number.isFinite);
  const now = new Date(asOf).getTime();
  const attended = roster.map((row) => Number(row.attendedCount)).filter((value) => Number.isFinite(value) && value >= 0);
  const sectionById = new Map(sections.map((section) => [String(section.id), section]));
  const attendanceGroups = new Map();
  for (const row of roster) {
    const attendedCount = Number(row.attendedCount);
    if (!Number.isFinite(attendedCount) || attendedCount < 0) continue;
    const key = String(row.sectionId || 'unassigned');
    if (!attendanceGroups.has(key)) attendanceGroups.set(key, []);
    attendanceGroups.get(key).push(attendedCount);
  }
  const bands = [
    { range: '0–24%', count: mastery.filter((value) => value < 25).length },
    { range: '25–49%', count: mastery.filter((value) => value >= 25 && value < 50).length },
    { range: '50–74%', count: mastery.filter((value) => value >= 50 && value < 75).length },
    { range: '75–99%', count: mastery.filter((value) => value >= 75 && value < 100).length },
    { range: '100%', count: mastery.filter((value) => value >= 100).length },
  ];
  const focusLearners = [...roster]
    .filter((row) => Number.isFinite(Number(row.masteryPercent)))
    .sort((a, b) => Number(a.masteryPercent) - Number(b.masteryPercent))
    .slice(0, 12)
    .map(({ learnerName, sectionId, masteryPercent, completedTopics, examCompletedCount, projectSubmittedCount, attendedCount, lastActivityAt }) => ({
      learnerName,
      section: sectionById.get(String(sectionId || ''))?.title || null,
      masteryPercent,
      completedTopics,
      examCompletedCount,
      projectSubmittedCount,
      ...(attendedCount == null ? {} : { allTimeAttendedCount: attendedCount }),
      lastActivityAt: lastActivityAt || null,
    }));

  return {
    scope: 'course roster',
    asOf: new Date(asOf).toISOString(),
    rosterSize: roster.length,
    overall: {
      averageMasteryPercent: mean(mastery),
      medianMasteryPercent: median(mastery),
      masteryBands: bands,
      averageCompletedTopics: mean(completedTopics),
      examsCompleted: roster.reduce((sum, row) => sum + (Number(row.examCompletedCount) || 0), 0),
      projectSubmissions: roster.reduce((sum, row) => sum + (Number(row.projectSubmittedCount) || 0), 0),
      learnersActiveInLast7Days: activityTimes.filter((time) => now - time <= 7 * 86400000 && time <= now).length,
      learnersActiveInLast30Days: activityTimes.filter((time) => now - time <= 30 * 86400000 && time <= now).length,
      learnersWithActivityDate: activityTimes.length,
      averageTimeSpentSeconds: mean(times),
      totalTimeSpentSeconds: times.length ? times.reduce((sum, value) => sum + value, 0) : null,
      allTimeAttendanceRecordsAvailableFor: attended.length,
    },
    focusLearners,
    allTimeAttendanceBySection: [...attendanceGroups.entries()].map(([sectionId, values]) => ({
      section: sectionById.get(sectionId)?.title || (sectionId === 'unassigned' ? 'Unassigned' : sectionId),
      learnersWithRecordedCount: values.length,
      averageAttendedSessionsRecorded: mean(values),
      maximumAttendedSessionsRecorded: Math.max(...values),
    })),
    sections: sections.map(({ id, title, attendanceEnabled, scheduleId }) => ({ id, title, attendanceEnabled: attendanceEnabled === true, scheduleId: scheduleId || null })),
    schedules: schedules.map(({ id, title, startDate, endDate }) => ({ id, title, startDate: startDate || null, endDate: endDate || null })),
  };
}

export function decoratePulseProgressEvidence(evidence = {}, topics = [], questionByKey = new Map()) {
  const topicById = new Map(topics.map((topic) => [String(topic.id), topic]));
  return {
    ...evidence,
    recentEvents: (evidence.recentEvents || []).map((event) => ({
      date: event.createdAt || event.date || null,
      type: event.type || 'unknown',
      learner: event.learner || 'Learner',
      ...(event.section ? { section: event.section } : {}),
      topic: topicById.get(String(event.topicId || ''))?.title || null,
    })),
    essayExamples: (evidence.essayExamples || []).map((essay) => ({
      learner: essay.learner || 'Learner',
      ...(essay.section ? { section: essay.section } : {}),
      topic: topicById.get(String(essay.topicId || ''))?.title || 'Unknown topic',
      question: questionByKey.get(`${essay.topicId}:${essay.interactionId}`) || 'Question text unavailable',
      response: essay.response || '',
      evaluatorFeedback: essay.evaluatorFeedback || '',
      ...(finiteNumber(essay.scorePercent) === null ? {} : { scorePercent: finiteNumber(essay.scorePercent) }),
      submittedAt: essay.submittedAt || null,
    })),
  };
}

export function summarizePulseAttendance(sessionsBySection = [], sections = [], { startDate = null, endDate = null } = {}) {
  const sectionById = new Map(sections.map((section) => [String(section.id), section]));
  const start = startDate ? new Date(startDate).getTime() : -Infinity;
  const end = endDate ? new Date(endDate).getTime() : Infinity;
  const sessions = [];
  const answerTotals = new Map();
  const sectionAnswerTotals = new Map();
  for (const group of sessionsBySection) {
    const sectionId = String(group.sectionId || '');
    const section = sectionById.get(sectionId);
    for (const session of group.sessions || []) {
      const sessionAt = new Date(session.openedAt || session.createdAt || '').getTime();
      if (!Number.isFinite(sessionAt) || sessionAt < start || sessionAt > end) continue;
      const questions = Array.isArray(session.questions) ? session.questions : [];
      const tally = session.answerTally || {};
      for (const question of questions) {
        const byChoice = tally[question.id] || {};
        for (const [choice, count] of Object.entries(byChoice)) {
          const key = `${question.prompt || question.text || question.id}\u0000${choice}`;
          answerTotals.set(key, (answerTotals.get(key) || 0) + (Number(count) || 0));
          const sectionKey = `${section?.title || 'Unknown section'}\u0000${question.prompt || question.text || question.id}\u0000${choice}`;
          sectionAnswerTotals.set(sectionKey, (sectionAnswerTotals.get(sectionKey) || 0) + (Number(count) || 0));
        }
      }
      sessions.push({
        section: section?.title || 'Unknown section',
        openedAt: session.openedAt || session.createdAt || null,
        attendeeCount: Number(session.attendeeCount) || 0,
        enrolledCount: Number(group.enrolledCount) || 0,
        questions: questions.map((question) => ({
          question: question.prompt || question.text || question.id,
          answers: tally[question.id] || {},
        })),
      });
    }
  }
  return {
    status: sessions.length ? 'available' : 'no attendance sessions in this term',
    sessionsHeld: sessions.length,
    sectionsWithAttendance: [...new Set(sessions.map((session) => session.section))],
    totalCheckIns: sessions.reduce((sum, session) => sum + session.attendeeCount, 0),
    totalExpectedCheckIns: sessions.reduce((sum, session) => sum + session.enrolledCount, 0),
    attendancePercent: mean(sessions.filter((session) => session.enrolledCount > 0).map((session) => (session.attendeeCount / session.enrolledCount) * 100)),
    responseTotals: [...answerTotals.entries()].map(([key, count]) => {
      const [question, choice] = key.split('\u0000');
      return { question, choice, count };
    }),
    responseTotalsBySection: [...sectionAnswerTotals.entries()].map(([key, count]) => {
      const [section, question, choice] = key.split('\u0000');
      return { section, question, choice, count };
    }),
    sessions: sessions.slice(-30),
  };
}

export function summarizeCanvasRosterGrades(gradesByEmail = {}, roster = [], sections = [], metadata = {}) {
  const sectionById = new Map(sections.map((section) => [String(section.id), section]));
  const rosterByEmail = new Map(roster.map((row) => [String(row.learnerEmail || '').trim().toLowerCase(), row]));
  const entries = Object.entries(gradesByEmail || {}).map(([email, grade]) => ({ email: email.toLowerCase(), row: rosterByEmail.get(email.toLowerCase()), grade })).filter((entry) => entry.row);
  const scores = entries.map((entry) => finiteNumber(entry.grade?.overall?.score)).filter((value) => value !== null);
  const assignmentStats = new Map();
  for (const entry of entries) {
    for (const assignment of entry.grade?.assignments || []) {
      if (!assignmentStats.has(assignment.name)) assignmentStats.set(assignment.name, []);
      assignmentStats.get(assignment.name).push(assignment);
    }
  }
  const summarizeAssignments = (values) => [...values.entries()].map(([name, assignments]) => {
    const score = (assignment) => finiteNumber(assignment.score);
    const points = (assignment) => finiteNumber(assignment.pointsPossible);
    const percentages = assignments.map((assignment) => score(assignment) !== null && points(assignment) > 0 ? score(assignment) / points(assignment) * 100 : null).filter(Number.isFinite);
    return {
      name,
      learnersWithAssignment: assignments.length,
      averagePercent: mean(percentages),
      // "Completed" = the learner earned a passing grade (any score greater than zero) or is excused.
      // A zero — including a `missing` zero — is not completion, and an ungraded assignment is not yet
      // completed. This is grade-based, so pass-off grading (a score with no `submittedAt`) is covered,
      // while `missing` (set only after the due date) is correctly ignored for not-yet-due milestones.
      completedCount: assignments.filter((a) => a.excused === true || (finiteNumber(a.score) > 0 && a.missing !== true)).length,
      gradedCount: assignments.filter((assignment) => finiteNumber(assignment.score) !== null).length,
      missingCount: assignments.filter((assignment) => assignment.missing === true).length,
      lateCount: assignments.filter((assignment) => assignment.late === true).length,
      dueAt: assignments.find((assignment) => assignment.dueAt)?.dueAt || null,
    };
  }).sort((a, b) => String(a.dueAt || '').localeCompare(String(b.dueAt || '')));
  const bySection = new Map();
  for (const entry of entries) {
    const sectionId = String(entry.row.sectionId || 'unassigned');
    if (!bySection.has(sectionId)) bySection.set(sectionId, []);
    const score = finiteNumber(entry.grade?.overall?.score);
    if (score !== null) bySection.get(sectionId).push(score);
  }
  return {
    status: entries.length ? 'available' : 'unavailable or no matched Canvas learners',
    matchedLearners: entries.length,
    rosterSize: roster.length,
    currentOverall: {
      averagePercent: mean(scores),
      medianPercent: median(scores),
      learnersWithNumericGrade: scores.length,
    },
    currentGradeBySection: [...bySection.entries()].map(([sectionId, values]) => ({
      section: sectionById.get(sectionId)?.title || (sectionId === 'unassigned' ? 'Unassigned' : sectionId),
      learnersWithNumericGrade: values.length,
      averagePercent: mean(values),
      medianPercent: median(values),
    })),
    undatedAssignmentsExcluded: entries.reduce((sum, entry) => sum + (Number(entry.grade?.undatedAssignmentsExcluded) || 0), 0),
    termAssignmentCount: Number(metadata.termAssignmentCount) || 0,
    undatedCanvasAssignmentsExcluded: Number(metadata.undatedAssignmentsExcluded) || 0,
    assignments: summarizeAssignments(assignmentStats),
  };
}
