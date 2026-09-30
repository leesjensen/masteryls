import { completedInteractionIds } from './topicProgress.js';

const SUMMARY_KEYS = new Set(['mastery', 'lastActivityAt', 'totalTimeSpent']);
const CACHE_REPAIR_TYPES = new Set(['instructionView', 'embeddedView', 'draView', 'quizSubmit', 'canvasGradebookSubmit', 'note', 'exam', 'draUpdate', 'interviewUpdate']);

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function latestIso(left, right) {
  if (!left) return right || null;
  if (!right) return left || null;
  return new Date(right).getTime() > new Date(left).getTime() ? right : left;
}

function scoreFromDetails(details) {
  const score = Number(details?.percentCorrect);
  return Number.isFinite(score) ? score : null;
}

function topicById(course) {
  return new Map((Array.isArray(course?.allTopics) ? course.allTopics : []).filter((topic) => topic?.id).map((topic) => [topic.id, topic]));
}

function getTopicProgress(progress, topicId) {
  if (!isObject(progress[topicId])) {
    progress[topicId] = { scores: {} };
  } else if (!isObject(progress[topicId].scores)) {
    progress[topicId].scores = {};
  }
  return progress[topicId];
}

export function calculateProgressMastery(progress, course) {
  const publishedTopics = (Array.isArray(course?.allTopics) ? course.allTopics : []).filter((topic) => topic?.state === 'published');
  if (publishedTopics.length === 0) {
    return 0;
  }

  let completedTopics = 0;
  for (const topic of publishedTopics) {
    const topicProgress = progress?.[topic.id];
    let topicPercent = topicProgress ? 1 : 0;

    if (topicProgress && Number.isFinite(Number(topicProgress.masteryScore))) {
      topicPercent = Math.max(0, Math.min(1, Number(topicProgress.masteryScore) / 100));
    } else if (topicProgress && Array.isArray(topic.interactions) && topic.interactions.length > 0) {
      const completed = completedInteractionIds(topicProgress);
      topicPercent = completed.length / topic.interactions.length;
    }

    completedTopics += topicPercent;
  }

  return Math.round((completedTopics / publishedTopics.length) * 100);
}

export function repairEnrollmentProgressCache({ enrollment, course, progressRows }) {
  const topics = topicById(course);
  const existingProgress = isObject(enrollment?.progress) ? enrollment.progress : {};
  const nextProgress = structuredClone(existingProgress);
  let rowDurationTotal = 0;
  let latestActivityAt = nextProgress.lastActivityAt || null;
  const topicDurationTotals = new Map();

  for (const row of progressRows || []) {
    if (!row?.topicId || !CACHE_REPAIR_TYPES.has(row.type)) {
      continue;
    }

    const topic = topics.get(row.topicId);
    const entry = getTopicProgress(nextProgress, row.topicId);
    const createdAt = row.createdAt || null;
    const duration = Number(row.duration || 0);

    if (duration > 0) {
      topicDurationTotals.set(row.topicId, Number(topicDurationTotals.get(row.topicId) || 0) + duration);
      rowDurationTotal += duration;
    }

    if (row.type === 'quizSubmit' && row.interactionId) {
      entry.scores = {
        ...entry.scores,
        [row.interactionId]: scoreFromDetails(row.details),
      };
    }

    if (row.type === 'canvasGradebookSubmit' && topic?.type === 'project') {
      entry.projectSubmission = true;
    }

    if (row.type === 'note') {
      entry.notes = true;
    }

    if (row.type === 'exam' && row.details?.state === 'completed') {
      entry.examCompleted = true;
    }

    if (row.type === 'draUpdate') {
      if (row.details?.draState || row.details?.state) entry.draState = row.details.draState || row.details.state;
      if (row.details?.mode) entry.mode = row.details.mode;
      if (Number.isFinite(Number(row.details?.itemsCompleted))) entry.itemsCompleted = Number(row.details.itemsCompleted);
      if (Number.isFinite(Number(row.details?.totalItems))) entry.totalItems = Number(row.details.totalItems);
      if (Number.isFinite(Number(row.details?.masteryScore))) entry.masteryScore = Number(row.details.masteryScore);
      if (row.details?.state === 'completed') entry.draCompleted = true;
    }

    if (row.type === 'interviewUpdate') {
      if (row.details?.interviewState || row.details?.state) entry.interviewState = row.details.interviewState || row.details.state;
      if (row.details?.mode) entry.mode = row.details.mode;
      if (Number.isFinite(Number(row.details?.sessionsCompleted))) entry.sessionsCompleted = Number(row.details.sessionsCompleted);
      if (Number.isFinite(Number(row.details?.totalSessions))) entry.totalSessions = Number(row.details.totalSessions);
      if (Number.isFinite(Number(row.details?.masteryScore))) entry.masteryScore = Number(row.details.masteryScore);
      if (row.details?.state === 'completed') entry.interviewCompleted = true;
    }

    entry.lastInteractionAt = latestIso(entry.lastInteractionAt, createdAt);
    latestActivityAt = latestIso(latestActivityAt, createdAt);
  }

  for (const [key, entry] of Object.entries(nextProgress)) {
    if (SUMMARY_KEYS.has(key) || !isObject(entry)) {
      continue;
    }
    if (Array.isArray(entry.interactions)) {
      entry.scores = {
        ...Object.fromEntries(entry.interactions.filter(Boolean).map((id) => [id, null])),
        ...(isObject(entry.scores) ? entry.scores : {}),
      };
      delete entry.interactions;
    }
  }

  for (const [topicId, duration] of topicDurationTotals.entries()) {
    const entry = getTopicProgress(nextProgress, topicId);
    entry.timeSpent = Math.max(Number(entry.timeSpent || 0), duration);
  }

  nextProgress.totalTimeSpent = Math.max(Number(nextProgress.totalTimeSpent || 0), rowDurationTotal);
  nextProgress.lastActivityAt = latestActivityAt;
  nextProgress.mastery = calculateProgressMastery(nextProgress, course);

  return nextProgress;
}
