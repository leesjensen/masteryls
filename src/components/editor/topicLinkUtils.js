export function getTopicDisplayLabel(topic) {
  if (!topic) return '(untitled)';
  return topic.title || topic.description || topic.path || '(untitled)';
}

// Compute a relative markdown path from the topic being edited (fromPath) to a target topic
// (toPath). Both are the absolute `main`-pinned raw URLs that loaded topics carry, e.g.
//   from: https://raw.githubusercontent.com/acct/repo/main/instruction/introduction/introduction.md
//   to:   https://raw.githubusercontent.com/acct/repo/main/instruction/example-links/example-links.md
//   ->    ../example-links/example-links.md
// Returns null when the paths can't be compared (missing, unparseable, or different origins), so
// callers can fall back to an absolute /course/:id/topic/:id link.
export function relativeTopicPath(fromPath, toPath) {
  if (!fromPath || !toPath) return null;

  let from;
  let to;
  try {
    from = new URL(fromPath);
    to = new URL(toPath);
  } catch {
    return null;
  }
  if (from.origin !== to.origin) return null;

  const fromSegments = from.pathname.split('/').filter(Boolean);
  const toSegments = to.pathname.split('/').filter(Boolean);
  fromSegments.pop(); // drop the source file name so we walk from its directory

  let shared = 0;
  while (shared < fromSegments.length && shared < toSegments.length && fromSegments[shared] === toSegments[shared]) {
    shared += 1;
  }

  const up = fromSegments.slice(shared).map(() => '..');
  const down = toSegments.slice(shared);
  const relative = [...up, ...down].join('/');
  return relative || null;
}

// The path shown for a topic in the insert-link dialog: the relative link that will be inserted,
// falling back to the raw topic path when a relative path can't be computed.
export function topicLinkDisplayPath(currentTopicPath, topic) {
  return relativeTopicPath(currentTopicPath, topic?.path) || topic?.path || '';
}

// The markdown inserted when a topic is chosen. Prefers a portable relative path (which renders
// correctly on GitHub and resolves in-app), falling back to an absolute course/topic link.
export function createTopicLinkMarkdown(courseId, topic, currentTopicPath) {
  if (!topic?.id) return '';
  const relative = relativeTopicPath(currentTopicPath, topic.path);
  const href = relative || (courseId ? `/course/${courseId}/topic/${topic.id}` : '');
  if (!href) return '';
  const label = getTopicDisplayLabel(topic);
  return `[${label}](${href})`;
}
