export function getTopicDisplayLabel(topic) {
  if (!topic) return '(untitled)';
  return topic.title || topic.description || topic.path || '(untitled)';
}

export function createTopicLinkMarkdown(courseId, topic) {
  if (!courseId || !topic?.id) return '';
  const label = getTopicDisplayLabel(topic);
  return `[${label}](/course/${courseId}/topic/${topic.id})`;
}
