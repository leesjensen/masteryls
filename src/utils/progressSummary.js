import { completedInteractionCount } from './topicProgress.js';

const SUMMARY_KEYS = new Set(['mastery', 'lastActivityAt', 'totalTimeSpent']);

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function topicEntries(progress) {
  if (!isObject(progress)) return [];
  return Object.entries(progress).filter(([key, value]) => !SUMMARY_KEYS.has(key) && isObject(value));
}

export function calculateProgressMastery(progress, course) {
  const cached = Number(progress?.mastery);
  const publishedTopics = (Array.isArray(course?.allTopics) ? course.allTopics : []).filter((topic) => topic?.state === 'published');
  if (publishedTopics.length === 0) {
    return Number.isFinite(cached) ? cached : 0;
  }

  let completedTopics = 0;
  for (const topic of publishedTopics) {
    const topicProgress = progress?.[topic.id];
    let topicPercent = topicProgress ? 1 : 0;

    if (topicProgress && Number.isFinite(Number(topicProgress.masteryScore))) {
      topicPercent = Math.max(0, Math.min(1, Number(topicProgress.masteryScore) / 100));
    } else if (topicProgress && Array.isArray(topic.interactions) && topic.interactions.length > 0) {
      topicPercent = completedInteractionCount(topicProgress) / topic.interactions.length;
    }

    completedTopics += topicPercent;
  }

  return Math.round((completedTopics / publishedTopics.length) * 100);
}

export function calculateProgressTotalTimeSpent(progress) {
  const entries = topicEntries(progress);
  if (entries.length === 0) {
    const cached = Number(progress?.totalTimeSpent);
    return Number.isFinite(cached) ? cached : 0;
  }

  return entries.reduce((total, [, entry]) => {
    const timeSpent = Number(entry.timeSpent);
    return total + (Number.isFinite(timeSpent) && timeSpent > 0 ? timeSpent : 0);
  }, 0);
}

export function calculateProgressCompletedTopics(progress) {
  return topicEntries(progress).length;
}

export function calculateProgressExamCompletedCount(progress) {
  return topicEntries(progress).filter(([, entry]) => entry.examCompleted === true).length;
}

export function calculateProgressProjectSubmittedCount(progress) {
  return topicEntries(progress).filter(([, entry]) => entry.projectSubmission === true).length;
}

export function calculateProgressLastActivityAt(progress) {
  if (!isObject(progress)) return null;
  if (progress.lastActivityAt) return progress.lastActivityAt;

  return topicEntries(progress).reduce((latest, [, entry]) => {
    if (!entry.lastInteractionAt) return latest;
    if (!latest) return entry.lastInteractionAt;
    return new Date(entry.lastInteractionAt).getTime() > new Date(latest).getTime() ? entry.lastInteractionAt : latest;
  }, null);
}

export function deriveProgressSummary(progress, course) {
  return {
    mastery: calculateProgressMastery(progress, course),
    totalTimeSpent: calculateProgressTotalTimeSpent(progress),
    completedTopics: calculateProgressCompletedTopics(progress),
    lastActivityAt: calculateProgressLastActivityAt(progress),
    examCompletedCount: calculateProgressExamCompletedCount(progress),
    projectSubmittedCount: calculateProgressProjectSubmittedCount(progress),
  };
}
