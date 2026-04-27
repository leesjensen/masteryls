import assert from 'node:assert/strict';
import test from 'node:test';
import { extractInteractionMetas, isSubmittableInteractionType, parseInteractionMeta } from './interactionMeta.js';

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
