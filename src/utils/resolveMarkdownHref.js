// Resolve a raw markdown link href into a real, navigable app URL.
//
// Markdown topic content contains relative links (e.g. `../chess.md`,
// `../../instruction/chess-tips/chess-tips.md#phase-0---chess-moves`). We must turn these
// into a valid href *at render time* so the link works whether the click is intercepted for
// SPA navigation or the browser follows the href directly (open-in-new-tab / middle-click /
// cmd-click). The base topic needed to resolve a relative link is only known where the
// markdown renders - once a bare relative path reaches the router the originating topic is
// lost and it falls through to the error page.
//
// Resolution rules (mirrors the historical inline click handler):
//   - absolute (`http…`) or root-relative (`/…`) hrefs are returned unchanged
//   - a pure in-page anchor (`#foo`) is returned as-is
//   - a relative path that resolves to a topic in the course becomes
//     `/course/:courseId/topic/:topicId#anchor`
//   - a relative path that resolves to a non-topic resource becomes its absolute URL
export function resolveMarkdownHref(href, { topicPath, courseId, topicFromPath, resolveTopicUrl } = {}) {
  if (!href || href.startsWith('http') || href.startsWith('/')) {
    return href;
  }

  const match = href.match(/^([^#]*)(#.*)?$/);
  const hrefPath = match?.[1];
  const hrefAnchor = match?.[2] ?? ''; // already includes the leading '#'
  if (!hrefPath) {
    return hrefAnchor; // pure in-page anchor
  }

  try {
    const canonicalResolvedUrl = new URL(hrefPath, topicPath).toString();
    const targetTopic = topicFromPath?.(canonicalResolvedUrl, false);
    if (targetTopic) {
      return `/course/${courseId}/topic/${targetTopic.id}${hrefAnchor}`;
    }
    return resolveTopicUrl ? resolveTopicUrl(hrefPath) : href;
  } catch {
    return href;
  }
}
