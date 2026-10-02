import test from 'node:test';
import assert from 'node:assert/strict';

test('whole-enrollment progress saves can erase quiz scores from a stale enrollment snapshot', () => {
  let persistedEnrollment = {
    id: 'enrollment-1',
    progress: {
      mastery: 0,
      totalTimeSpent: 0,
      'topic-1': {
        scores: {},
        timeSpent: 0,
      },
    },
  };

  const sessionAStaleEnrollment = structuredClone(persistedEnrollment);
  const sessionBEnrollment = structuredClone(persistedEnrollment);

  function saveEnrollmentWholeObject(enrollment) {
    persistedEnrollment = structuredClone(enrollment);
  }

  sessionBEnrollment.progress['topic-1'].scores['interaction-1'] = 100;
  sessionBEnrollment.progress.mastery = 100;
  saveEnrollmentWholeObject(sessionBEnrollment);

  assert.deepEqual(persistedEnrollment.progress['topic-1'].scores, {
    'interaction-1': 100,
  });

  sessionAStaleEnrollment.progress['topic-1'].timeSpent = 60;
  sessionAStaleEnrollment.progress.totalTimeSpent = 60;
  saveEnrollmentWholeObject(sessionAStaleEnrollment);

  assert.deepEqual(persistedEnrollment.progress['topic-1'].scores, {});
  assert.equal(persistedEnrollment.progress['topic-1'].timeSpent, 60);
});
