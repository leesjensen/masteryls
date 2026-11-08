import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScheduleMarkdown } from './scheduleMarkdown.js';
import { decoratePulseProgressEvidence, excludePulseStaffRows, getPulseScheduleDueItems, reconcilePulseCanvasAssignments, resolvePulseScheduleDate, summarizeCanvasRosterGrades, summarizePulseAttendance } from './pulseEvidence.js';

test('course pulse roster exclusion removes enrolled course editors and mentors', () => {
  const result = excludePulseStaffRows([
    { learnerId: 'learner-1' },
    { learnerId: 'editor-1' },
    { learnerId: 'mentor-1' },
  ], ['editor-1', 'mentor-1']);

  assert.deepEqual(result, { rows: [{ learnerId: 'learner-1' }], excludedCount: 2 });
});

test('pulse schedule dates parse display dates and filter against term bounds as calendar dates', () => {
  const referenceDate = new Date('2026-11-08T12:00:00');
  assert.equal(resolvePulseScheduleDate('Sat Oct 31, 2026', { startDate: '2026-09-01', endDate: '2026-12-18', referenceDate }), '2026-10-31');
  assert.equal(resolvePulseScheduleDate('Fri Nov 13, 2026', { startDate: '2026-09-01', endDate: '2026-12-18', referenceDate }), '2026-11-13');
  assert.equal(resolvePulseScheduleDate('Tue Nov 10', { startDate: '2026-09-01', endDate: '2026-12-18', referenceDate }), '2026-11-10');
  assert.equal(resolvePulseScheduleDate('Sat Aug 29, 2026', { startDate: '2026-09-01', endDate: '2026-12-18', referenceDate }), null);
});

test('pulse extracts the real dated due rows from schedule Markdown', () => {
  const markdown = [
    '| Week | Date | Module | Due | Topics Covered | Slides |',
    '| :--: | ---- | ------ | --- | -------------- | ------ |',
    '| 9 | Sat Oct 31, 2026 | `Database` | [☑ Phase 4: Chess Database](../chess/4-database.md) | | |',
    '| 11 | Fri Nov 13, 2026 | `Enrichment` | [☑ Phase 5: Chess Pregame](../chess/5-pregame.md) | | |',
  ].join('\n');
  const { weeks } = parseScheduleMarkdown(markdown);
  const items = getPulseScheduleDueItems(weeks, {
    startDate: '2026-09-01',
    endDate: '2026-12-18',
    referenceDate: new Date('2026-11-08T12:00:00'),
  });

  assert.deepEqual(items.map(({ date, item }) => ({ date, item })), [
    { date: '2026-10-31', item: 'Phase 4: Chess Database' },
    { date: '2026-11-13', item: 'Phase 5: Chess Pregame' },
  ]);
});

test('pulse Canvas grade evidence maps assignment dates to the schedule and flags material conflicts', () => {
  const result = reconcilePulseCanvasAssignments({ assignments: [
    { name: '♕ Phase 4: Chess Database', dueAt: '2026-11-15T06:59:59Z', averagePercent: 83.5 },
  ] }, [{ item: '☑ Phase 4: Chess Database', date: '2026-10-31' }]);

  assert.equal(result.assignments[0].scheduleDate, '2026-10-31');
  assert.equal(result.assignments[0].canvasDueAt, '2026-11-15T06:59:59Z');
  assert.equal(result.assignments[0].scheduleCanvasDateConflict, true);
  assert.equal('dueAt' in result.assignments[0], false);
});

test('pulse progress decoration resolves topic names and essay prompts for bounded SQL results', () => {
  const summary = decoratePulseProgressEvidence({
    recentEvents: [{ createdAt: '2026-11-06T12:00:00Z', type: 'topicView', learner: 'Learner One', topicId: 'topic-1' }],
    essayExamples: [{ learner: 'Learner One', topicId: 'topic-1', interactionId: 'essay-1', response: 'A short response', evaluatorFeedback: 'Clear explanation', scorePercent: 80 }],
  }, [{ id: 'topic-1', title: 'Interfaces' }], new Map([['topic-1:essay-1', 'Explain interfaces.']]));

  assert.equal(summary.recentEvents[0].topic, 'Interfaces');
  assert.equal(summary.essayExamples[0].topic, 'Interfaces');
  assert.equal(summary.essayExamples[0].question, 'Explain interfaces.');
  assert.equal(summary.essayExamples[0].evaluatorFeedback, 'Clear explanation');
  assert.equal(summary.essayExamples[0].scorePercent, 80);
});

test('pulse attendance summary limits sessions to the term and aggregates wellness responses', () => {
  const summary = summarizePulseAttendance([
    { sectionId: 'section-1', enrolledCount: 10, sessions: [
      { openedAt: '2026-10-01T10:00:00Z', attendeeCount: 8, questions: [{ id: 'q1', text: 'How are things?' }], answerTally: { q1: { Great: 5, Okay: 3 } } },
      { openedAt: '2026-08-01T10:00:00Z', attendeeCount: 7, questions: [{ id: 'q1', text: 'How are things?' }], answerTally: { q1: { Great: 7 } } },
    ] },
  ], [{ id: 'section-1', title: 'Section 1' }], { startDate: '2026-09-01', endDate: '2026-12-20' });

  assert.equal(summary.sessionsHeld, 1);
  assert.equal(summary.totalCheckIns, 8);
  assert.equal(summary.attendancePercent, 80);
  assert.deepEqual(summary.responseTotals, [
    { question: 'How are things?', choice: 'Great', count: 5 },
    { question: 'How are things?', choice: 'Okay', count: 3 },
  ]);
  assert.equal(summary.responseTotalsBySection[0].section, 'Section 1');
});

test('Canvas roster summary aggregates current grades by roster section and term assignments', () => {
  const summary = summarizeCanvasRosterGrades({
    'one@test.com': { overall: { score: 90 }, assignments: [{ name: 'Phase 1', score: 18, pointsPossible: 20, missing: false, late: false, dueAt: '2026-10-01' }] },
    'two@test.com': { overall: { score: 70 }, assignments: [{ name: 'Phase 1', score: null, pointsPossible: 20, missing: true, late: false, dueAt: '2026-10-01' }] },
  }, [
    { learnerEmail: 'one@test.com', sectionId: 'section-1' },
    { learnerEmail: 'two@test.com', sectionId: 'section-2' },
  ], [{ id: 'section-1', title: 'Section 1' }, { id: 'section-2', title: 'Section 2' }]);

  assert.equal(summary.currentOverall.averagePercent, 80);
  assert.equal(summary.currentGradeBySection.length, 2);
  assert.equal(summary.assignments[0].averagePercent, 90);
  assert.equal(summary.assignments[0].missingCount, 1);
});
