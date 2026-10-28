import assert from 'node:assert/strict';
import test from 'node:test';
import { extractInteractionMetas, getInteractionPrecedingContent, isSubmittableInteractionType, topicContentForAi, normalizeInteractionIds, parseInteractionMeta } from './interactionMeta.js';

test('topicContentForAi keeps markdown structure but removes images and interaction blocks', () => {
  const md = `# Heading\n\nSome **bold** text and a [link](http://x).\n\n![alt](http://img.png)\n\n- bullet one\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n\n\`\`\`masteryls\n{"id":"a"}\nquestion?\n\`\`\`\n`;
  const text = topicContentForAi(md);
  assert.match(text, /# Heading/); // heading markers kept
  assert.match(text, /\*\*bold\*\*/); // emphasis kept
  assert.match(text, /\[link\]\(http:\/\/x\)/); // links kept
  assert.match(text, /- bullet one/); // list markers kept
  assert.match(text, /```js\nconst x = 1;\n```/); // ordinary code fences kept intact
  assert.doesNotMatch(text, /!\[alt\]|img\.png/); // images removed
  assert.doesNotMatch(text, /question\?/); // the masteryls interaction block is dropped
  assert.doesNotMatch(text, /masteryls/);
});

test('topicContentForAi removes html <img> tags', () => {
  assert.doesNotMatch(topicContentForAi('before <img src="http://x/y.png" width="10"/> after'), /<img|y\.png/);
});

test('getInteractionPrecedingContent returns the topic prose before the matching interaction', () => {
  const content = `# Intro\n\nFirst paragraph about cows.\n\n## Vocalization\n\nCows moo to communicate.\n\n\`\`\`masteryls\n{"id":"11111111-1111-4111-8111-111111111111","type":"essay"}\nWhat do cows say?\n\`\`\`\n\nTrailing text after.\n`;
  const ctx = getInteractionPrecedingContent(content, '11111111-1111-4111-8111-111111111111');
  assert.match(ctx, /First paragraph about cows\./);
  assert.match(ctx, /Cows moo to communicate\./);
  assert.match(ctx, /Intro/);
  assert.match(ctx, /Vocalization/);
  assert.doesNotMatch(ctx, /What do cows say\?/); // the interaction body itself is not included
  assert.doesNotMatch(ctx, /Trailing text after/); // nothing after the block
});

test('getInteractionPrecedingContent excludes earlier interaction blocks from the context', () => {
  const content = `Lead in.\n\n\`\`\`masteryls\n{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","type":"multiple-choice"}\nEarlier question?\n\`\`\`\n\nMiddle prose.\n\n\`\`\`masteryls\n{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","type":"essay"}\nEssay prompt?\n\`\`\`\n`;
  const ctx = getInteractionPrecedingContent(content, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.match(ctx, /Lead in\./);
  assert.match(ctx, /Middle prose\./);
  assert.doesNotMatch(ctx, /Earlier question\?/); // the earlier interaction's body is dropped
});

test('getInteractionPrecedingContent returns empty for a missing id or content', () => {
  assert.equal(getInteractionPrecedingContent('', 'x'), '');
  assert.equal(getInteractionPrecedingContent('no interactions here', 'x'), '');
  assert.equal(getInteractionPrecedingContent('```masteryls\n{"id":"a"}\nq\n```', 'missing'), '');
});

test('parseInteractionMeta tolerates a missing comma before a key', () => {
  const { meta } = parseInteractionMeta('{"id":"a3b2a9f8-25e3-4ca4-8cca-42f3eb20537e", "title":"Web page", "type":"web-page" "file":"index.html"}');

  assert.equal(meta.type, 'web-page');
  assert.equal(meta.file, 'index.html');
});

test('extractInteractionMetas identifies passive web page interactions', () => {
  const markdown = '```masteryls\n{"id":"web", "title":"Web page", "type":"web-page", "file":"index.html"}\n```\n```masteryls\n{"id":"quiz", "type":"multiple-choice"}\nQuestion\n```';
  const metas = extractInteractionMetas(markdown);

  assert.equal(metas.length, 2);
  assert.equal(isSubmittableInteractionType(metas[0].type), false);
  assert.equal(isSubmittableInteractionType(metas[1].type), true);
});

test('ai web page interactions are submittable', () => {
  assert.equal(isSubmittableInteractionType('ai-web-page'), true);
});

test('likert interactions are submittable', () => {
  assert.equal(isSubmittableInteractionType('likert'), true);
});

test('normalizeInteractionIds assigns UUID when id is non-uuid', () => {
  const markdown = '```masteryls\n{"id":"modern-deployment-strategies","title":"Q","type":"multiple-choice"}\nQuestion\n```';
  const normalized = normalizeInteractionIds(markdown, () => '11111111-2222-4333-8abc-999999999999');

  assert.match(normalized, /"id":"11111111-2222-4333-8abc-999999999999"/);
});

test('normalizeInteractionIds preserves existing UUID id', () => {
  const markdown = '```masteryls\n{"id":"a3b2a9f8-25e3-4ca4-8cca-42f3eb20537e","title":"Q","type":"multiple-choice"}\nQuestion\n```';
  const normalized = normalizeInteractionIds(markdown, () => '11111111-2222-4333-8abc-999999999999');

  assert.match(normalized, /"id":"a3b2a9f8-25e3-4ca4-8cca-42f3eb20537e"/);
});
