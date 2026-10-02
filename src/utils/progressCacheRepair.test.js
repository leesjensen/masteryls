import test from 'node:test';
import assert from 'node:assert/strict';
import { repairEnrollmentProgressCache } from './progressCacheRepair.js';

const course = {
  allTopics: [
    {
      id: 'topic-1',
      state: 'published',
      type: 'lesson',
      interactions: ['interaction-1', 'interaction-2'],
    },
    {
      id: 'topic-2',
      state: 'published',
      type: 'project',
      interactions: ['project-interaction'],
    },
  ],
};

test('repairEnrollmentProgressCache restores missing quiz scores from progress rows', () => {
  const enrollment = {
    progress: {
      mastery: 0,
      lastActivityAt: '2026-09-30T15:01:41.821Z',
      totalTimeSpent: 294,
      'topic-1': {
        scores: {},
        timeSpent: 294,
        lastInteractionAt: '2026-09-30T15:01:41.821Z',
      },
    },
  };
  const rows = [
    {
      createdAt: '2026-09-26T08:10:59.944Z',
      topicId: 'topic-1',
      interactionId: 'interaction-2',
      duration: 0,
      type: 'quizSubmit',
      details: { percentCorrect: 100 },
    },
    {
      createdAt: '2026-09-26T08:00:50.083Z',
      topicId: 'topic-1',
      interactionId: 'interaction-1',
      duration: 0,
      type: 'quizSubmit',
      details: { percentCorrect: 100 },
    },
  ];

  const repaired = repairEnrollmentProgressCache({ enrollment, course, progressRows: rows });

  assert.deepEqual(repaired['topic-1'].scores, {
    'interaction-1': 100,
    'interaction-2': 100,
  });
  assert.equal(repaired['topic-1'].timeSpent, 294);
  assert.equal(repaired.mastery, undefined);
  assert.equal(repaired.totalTimeSpent, undefined);
});

test('repairEnrollmentProgressCache merges durable rows without reducing cached time', () => {
  const enrollment = {
    progress: {
      mastery: 0,
      totalTimeSpent: 500,
      'topic-2': {
        scores: {},
        timeSpent: 400,
      },
    },
  };
  const rows = [
    {
      createdAt: '2026-09-26T08:10:59.944Z',
      topicId: 'topic-2',
      interactionId: 'project-interaction',
      duration: 75,
      type: 'canvasGradebookSubmit',
      details: { percentCorrect: 90 },
    },
  ];

  const repaired = repairEnrollmentProgressCache({ enrollment, course, progressRows: rows });

  assert.equal(repaired['topic-2'].projectSubmission, true);
  assert.equal(repaired['topic-2'].timeSpent, 400);
  assert.equal(repaired.totalTimeSpent, undefined);
});
