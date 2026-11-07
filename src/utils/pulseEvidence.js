function mean(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
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
      ...(attendedCount == null ? {} : { attendedCount }),
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
      attendanceRecordsAvailableFor: attended.length,
    },
    focusLearners,
    attendanceBySection: [...attendanceGroups.entries()].map(([sectionId, values]) => ({
      section: sectionById.get(sectionId)?.title || (sectionId === 'unassigned' ? 'Unassigned' : sectionId),
      learnersWithRecordedCount: values.length,
      averageAttendedSessionsRecorded: mean(values),
      maximumAttendedSessionsRecorded: Math.max(...values),
    })),
    sections: sections.map(({ id, title, attendanceEnabled, scheduleId }) => ({ id, title, attendanceEnabled: attendanceEnabled === true, scheduleId: scheduleId || null })),
    schedules: schedules.map(({ id, title, startDate, endDate }) => ({ id, title, startDate: startDate || null, endDate: endDate || null })),
  };
}
