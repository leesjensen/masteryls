// Pure helpers for the client-side SEO of a course topic page. The app is a client-rendered SPA, so
// these build the metadata that `useHeadTags` writes into the document head after a topic loads.
// Indexing is opt-in per course (`catalog.settings.public`): only a public, published topic gets
// `robots: index,follow`; everything else stays `noindex` (the default baked into index.html), so the
// empty app shell a non-JS crawler sees is never indexed.

const SITE_NAME = 'MasteryLS';
const DESCRIPTION_MAX = 155;

// Flatten a topic's Markdown into one plain-text string: drop fenced/`masteryls` code, HTML comments
// and tags, a leading top-level heading (the topic title — already used as the <title>), and images;
// strip Markdown markers (heading/link/emphasis/list/quote/rule) while keeping their text. Whichever
// topic you open, the first run of prose varies (an intro paragraph, a "Key points" summary, a list),
// so a single "first paragraph/heading" rule picks poor text — the first N characters of the whole
// flattened content represents the page far better.
function topicPlainText(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';
  let text = markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced code (incl. ```masteryls blocks)
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ') // HTML comments / metrics markers
    .replace(/<[^>]+>/g, ' '); // inline/raw HTML tags

  text = text.replace(/^\s*#\s+[^\n]*\n?/, ' '); // drop the leading H1 (topic title)

  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // heading markers (keep text)
    .replace(/^\s{0,3}>\s?/gm, '') // blockquote markers
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, '') // list markers
    .replace(/^\s{0,3}(?:[-*_]\s?){3,}$/gm, ' ') // thematic breaks (---, ***)
    .replace(/[*_`~]/g, '') // emphasis / inline-code markers
    .replace(/\s+/g, ' ')
    .trim();
}

// Meta description = the first N characters of the flattened topic content, truncated on a word boundary.
export function topicMetaDescription(markdown, maxLength = DESCRIPTION_MAX) {
  return truncateAtWord(topicPlainText(markdown), maxLength);
}

function truncateAtWord(text, maxLength) {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

/**
 * Build the head metadata for a topic page. Returns a normalized spec consumed by `useHeadTags`:
 * `{ title, description, canonical, robots, og, twitter, jsonLd }`. `origin` is the site origin
 * (e.g. window.location.origin); `isPublic` is the course's `settings.public` flag.
 */
export function buildTopicHead({ origin = '', course, topic, markdown = '', isPublic = false }) {
  if (!course?.id || !topic?.id) return null;

  const courseTitle = course.title || course.name || SITE_NAME;
  const topicTitle = topic.title || 'Topic';
  const title = `${topicTitle} · ${courseTitle}`;
  const description = topicMetaDescription(markdown) || course.description || `${topicTitle} — ${courseTitle} on ${SITE_NAME}.`;
  const canonical = `${origin}/course/${course.id}/topic/${topic.id}`;
  const image = `${origin}/masteryls-logo.png`;

  // A topic is indexable only when the course is marked public AND the topic is published.
  const published = !topic.state || topic.state === 'published';
  const robots = isPublic && published ? 'index,follow' : 'noindex,follow';

  const og = {
    'og:title': title,
    'og:description': description,
    'og:type': 'article',
    'og:url': canonical,
    'og:site_name': SITE_NAME,
    'og:image': image,
  };
  const twitter = {
    'twitter:card': 'summary',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': image,
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: topicTitle,
    description,
    url: canonical,
    inLanguage: 'en',
    learningResourceType: 'Lesson',
    isPartOf: { '@type': 'Course', name: courseTitle, provider: { '@type': 'Organization', name: SITE_NAME } },
  };

  return { title, description, canonical, robots, og, twitter, jsonLd };
}
