import { resolveMarkdownHref } from '../../../utils/resolveMarkdownHref.js';

// Resolve a relative link that appears inside an interaction body (rendered by
// inlineLiteMarkdown) to a real, navigable app URL, using the current learning session.
//
// Topic MATCHING must use topic.path - the `main`-pinned URL that course.json topics carry -
// because Course.topicFromPath compares against those paths. The topic's snapshotPath is
// SHA-pinned (e.g. .../<40-hex-sha>/chess/foo.md); resolving the relative link against it
// produces a canonical URL that topicFromPath can never match, so the link would fall through
// to the raw-resource branch and open the .md source instead of navigating to the topic. The
// snapshot path is therefore used ONLY for the external-resource fallback (an actual file
// fetch), mirroring how Markdown.jsx handles the main topic content.
export function resolveInteractionHref(href, learningSession) {
  const canonicalTopicPath = learningSession?.topic?.path;
  const snapshotTopicPath = learningSession?.topic?.snapshotPath || learningSession?.topic?.path;

  return resolveMarkdownHref(href, {
    topicPath: canonicalTopicPath,
    courseId: learningSession?.course?.id,
    topicFromPath: learningSession?.course ? (path, fallback) => learningSession.course.topicFromPath(path, fallback) : undefined,
    resolveTopicUrl: (rawPath) => {
      try {
        return new URL(rawPath, snapshotTopicPath).toString();
      } catch {
        return rawPath;
      }
    },
  });
}
