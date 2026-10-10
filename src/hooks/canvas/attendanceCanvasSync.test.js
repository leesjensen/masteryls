import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAttendanceGradeRequest, calculateAttendancePoints, getAttendanceGradeSettings } from './attendanceCanvasSync.js';

const course = {
  id: 'cat-1',
  externalRefs: {
    canvasCourseId: 12345,
    attendance: {
      canvasAssignmentId: 777,
      pointsPerSession: 2,
      pointsPossible: 80,
    },
  },
};

test('calculateAttendancePoints awards points per session up to the maximum', () => {
  const settings = { pointsPerSession: 2, pointsPossible: 80 };
  assert.equal(calculateAttendancePoints(0, settings), 0);
  assert.equal(calculateAttendancePoints(3, settings), 6);
  assert.equal(calculateAttendancePoints(40, settings), 80);
  assert.equal(calculateAttendancePoints(55, settings), 80);
  assert.equal(calculateAttendancePoints(undefined, settings), 0);
});

test('getAttendanceGradeSettings defaults missing point values', () => {
  assert.deepEqual(
    getAttendanceGradeSettings({
      externalRefs: { attendance: { canvasAssignmentId: 1 } },
    }),
    { canvasAssignmentId: 1, pointsPerSession: 2, pointsPossible: 80 },
  );
  assert.equal(getAttendanceGradeSettings({ externalRefs: {} }), null);
  assert.equal(
    getAttendanceGradeSettings({
      externalRefs: { attendance: { pointsPossible: 0 } },
    }),
    null,
  );
});

test('buildAttendanceGradeRequest posts points as a percent of points possible', () => {
  const request = buildAttendanceGradeRequest({
    course,
    learnerEmail: 'bud@cow.com',
    attended: 10,
  });
  assert.deepEqual(request, {
    courseId: '12345',
    catalogId: 'cat-1',
    topicType: 'attendance',
    percentCorrect: 25,
    pointsPossible: 80,
    canvasAssignmentId: 777,
    learnerEmail: 'bud@cow.com',
    autoGrade: true,
  });
});

test('buildAttendanceGradeRequest returns null without a linked assignment or learner email', () => {
  assert.equal(
    buildAttendanceGradeRequest({
      course: { id: 'cat-1', externalRefs: { canvasCourseId: 1 } },
      learnerEmail: 'bud@cow.com',
      attended: 1,
    }),
    null,
  );
  assert.equal(buildAttendanceGradeRequest({ course, learnerEmail: '', attended: 1 }), null);
});
