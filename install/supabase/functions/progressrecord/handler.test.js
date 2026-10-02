import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressRecordHandler } from './handler.js';

function createMockSupabase({ user, dataMap }) {
  return {
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
    },
    async rpc(name, params) {
      if (name !== 'record_progress_event') {
        return { data: null, error: { message: `Unexpected RPC ${name}` } };
      }

      const enrollment = dataMap.enrollment.find((row) => row.id === params.p_enrollment_id);
      if (!enrollment) {
        return { data: null, error: { message: 'Enrollment not found' } };
      }

      const progress = structuredClone(enrollment.progress || {});
      progress[params.p_topic_id] ||= { scores: {} };
      progress[params.p_topic_id].scores ||= {};

      let saved = null;
      if (params.p_insert_progress !== false) {
        saved = {
          id: `progress-${dataMap.progress.length + 1}`,
          createdAt: '2026-10-02T12:00:00.000Z',
          userId: params.p_user_id,
          catalogId: params.p_catalog_id,
          enrollmentId: params.p_enrollment_id,
          topicId: params.p_topic_id,
          interactionId: params.p_interaction_id,
          type: params.p_type,
          duration: params.p_duration,
          details: params.p_details,
        };
        dataMap.progress.push(saved);
      }

      const cacheUpdate = params.p_cache_update || {};
      if (cacheUpdate.score?.interactionId) {
        progress[params.p_topic_id].scores[cacheUpdate.score.interactionId] = Number(cacheUpdate.score.percentCorrect);
      }

      if (Number(cacheUpdate.timeSpentDelta || 0) > 0) {
        progress[params.p_topic_id].timeSpent = Number(progress[params.p_topic_id].timeSpent || 0) + Number(cacheUpdate.timeSpentDelta);
      }

      enrollment.progress = progress;

      return {
        data: [
          {
            progress: saved,
            enrollment,
          },
        ],
        error: null,
      };
    },
  };
}

function makeRequest(body) {
  return new Request('https://local/functions/v1/progressrecord', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('progressrecord preserves existing scores while merging later time into current enrollment', async () => {
  const dataMap = {
    enrollment: [
      {
        id: 'enrollment-1',
        catalogId: 'course-1',
        learnerId: 'learner-1',
        settings: {},
        progress: {
          mastery: 50,
          totalTimeSpent: 0,
          'topic-1': {
            scores: { 'interaction-1': 100 },
            timeSpent: 0,
          },
        },
      },
    ],
    progress: [],
  };
  const handler = createProgressRecordHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'learner-1', email: 'learner@test.com' }, dataMap }),
    getEnv: () => 'configured',
  });

  const response = await handler(
    makeRequest({
      catalogId: 'course-1',
      enrollmentId: 'enrollment-1',
      topicId: 'topic-1',
      type: 'instructionView',
      duration: 60,
      details: {},
      cacheUpdate: { touchActivity: true, touchTopic: true, touchTopicActivity: true, timeSpentDelta: 60 },
      insertProgress: false,
    }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.progress, null);
  assert.deepEqual(body.enrollment.progress['topic-1'].scores, { 'interaction-1': 100 });
  assert.equal(body.enrollment.progress['topic-1'].timeSpent, 60);
  assert.equal(body.enrollment.progress.totalTimeSpent, 0);
});

test('progressrecord inserts quiz progress and returns updated enrollment cache', async () => {
  const dataMap = {
    enrollment: [
      {
        id: 'enrollment-1',
        catalogId: 'course-1',
        learnerId: 'learner-1',
        settings: {},
        progress: { mastery: 0 },
      },
    ],
    progress: [],
  };
  const handler = createProgressRecordHandler({
    createSupabaseClientFromAuthHeader: () => createMockSupabase({ user: { id: 'learner-1', email: 'learner@test.com' }, dataMap }),
    getEnv: () => 'configured',
  });

  const response = await handler(
    makeRequest({
      catalogId: 'course-1',
      enrollmentId: 'enrollment-1',
      topicId: 'topic-1',
      interactionId: 'interaction-1',
      type: 'quizSubmit',
      duration: 0,
      details: { percentCorrect: 100 },
      cacheUpdate: { touchActivity: true, touchTopic: true, touchTopicActivity: true, score: { interactionId: 'interaction-1', percentCorrect: 100 } },
    }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.progress.type, 'quizSubmit');
  assert.equal(dataMap.progress.length, 1);
  assert.deepEqual(body.enrollment.progress['topic-1'].scores, { 'interaction-1': 100 });
  assert.equal(body.enrollment.progress.mastery, 0);
});
