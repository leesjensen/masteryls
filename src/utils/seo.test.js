import test from 'node:test';
import assert from 'node:assert/strict';
import { topicMetaDescription, buildTopicHead } from './seo.js';

test('topicMetaDescription flattens the whole content (first N chars), dropping the title H1 and code', () => {
  const md = '# Title\n\n```js\nconst x = 1;\n```\n\nGit is a **distributed** version control system you use every day.\n\nMore text.';
  assert.equal(topicMetaDescription(md), 'Git is a distributed version control system you use every day. More text.');
});

test('topicMetaDescription draws from the full content, not just the first sub-heading', () => {
  // The old "first paragraph" rule stopped at a "Key points" label; now the description keeps going.
  const md = '# Grafana metrics\n\n## 🔑 Key points\n\n- You can report metrics easily using HTTP requests.\n- Grafana allows you to easily create visualizations.\n\n---\n\nIn previous instruction we used the TestData data source.';
  const out = topicMetaDescription(md);
  assert.doesNotMatch(out, /^Grafana metrics/); // leading H1 title dropped (it is already the <title>)
  assert.match(out, /Key points You can report metrics easily using HTTP requests\./);
  assert.doesNotMatch(out, /[#>*`]|---/); // no leftover markdown markers/bullets/rules
});

test('topicMetaDescription strips links/images and truncates on a word boundary', () => {
  const long = 'See [the docs](https://example.com) and ![pic](a.png) ' + 'word '.repeat(60);
  const out = topicMetaDescription(long, 40);
  assert.ok(out.length <= 40);
  assert.ok(out.endsWith('…'));
  assert.doesNotMatch(out, /\]\(|!\[/); // no markdown link/image syntax
  assert.match(out, /^See the docs/);
});

test('topicMetaDescription is empty-safe and keeps heading text', () => {
  assert.equal(topicMetaDescription(''), '');
  assert.equal(topicMetaDescription(null), '');
  assert.equal(topicMetaDescription('## Only a heading'), 'Only a heading');
});

const course = { id: 'c1', title: 'Web Programming', description: 'Learn the web.' };
const topic = { id: 't1', title: 'Git', state: 'published' };

test('buildTopicHead: a public published topic is indexable with canonical + OG', () => {
  const head = buildTopicHead({ origin: 'https://masteryls.com', course, topic, markdown: 'Git tracks changes to your code over time.', isPublic: true });
  assert.equal(head.robots, 'index,follow');
  assert.equal(head.canonical, 'https://masteryls.com/course/c1/topic/t1');
  assert.equal(head.title, 'Git · Web Programming');
  assert.equal(head.description, 'Git tracks changes to your code over time.');
  assert.equal(head.og['og:url'], 'https://masteryls.com/course/c1/topic/t1');
  assert.equal(head.og['og:type'], 'article');
  assert.equal(head.twitter['twitter:card'], 'summary');
  assert.equal(head.jsonLd.isPartOf.name, 'Web Programming');
});

test('buildTopicHead: a non-public course is noindex even when published', () => {
  assert.equal(buildTopicHead({ course, topic, isPublic: false }).robots, 'noindex,follow');
});

test('buildTopicHead: a public but unpublished topic is noindex', () => {
  assert.equal(buildTopicHead({ course, topic: { ...topic, state: 'unpublished' }, isPublic: true }).robots, 'noindex,follow');
});

test('buildTopicHead: description falls back to the course description then a generic line', () => {
  assert.equal(buildTopicHead({ course, topic, markdown: '', isPublic: true }).description, 'Learn the web.');
  assert.equal(buildTopicHead({ course: { id: 'c', title: 'C' }, topic, markdown: '', isPublic: true }).description, 'Git — C on MasteryLS.');
});

test('buildTopicHead returns null without a course/topic id', () => {
  assert.equal(buildTopicHead({ course: {}, topic }), null);
  assert.equal(buildTopicHead({ course, topic: {} }), null);
});
