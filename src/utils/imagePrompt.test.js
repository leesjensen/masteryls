import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImagePromptText, IMAGE_STYLE_PHOTO, IMAGE_STYLE_VISUAL, IMAGE_STYLE_OPTIONS } from './imagePrompt.js';

test('visual style produces the illustrated infographic prompt', () => {
  const text = buildImagePromptText('the event loop', IMAGE_STYLE_VISUAL);
  assert.match(text, /the event loop/);
  assert.match(text, /vector illustration style/);
  assert.doesNotMatch(text, /photorealistic/i);
});

test('photo style produces the photorealistic prompt', () => {
  const text = buildImagePromptText('a professor at a whiteboard', IMAGE_STYLE_PHOTO);
  assert.match(text, /a professor at a whiteboard/);
  assert.match(text, /photorealistic/i);
  assert.match(text, /real photograph/i);
  assert.doesNotMatch(text, /vector illustration style/);
});

test('defaults to visual when style is omitted or unknown', () => {
  const omitted = buildImagePromptText('x');
  const unknown = buildImagePromptText('x', 'bogus');
  assert.match(omitted, /vector illustration style/);
  assert.equal(unknown, omitted);
});

test('style options expose both choices with the visual one first', () => {
  assert.deepEqual(
    IMAGE_STYLE_OPTIONS.map((o) => o.value),
    [IMAGE_STYLE_VISUAL, IMAGE_STYLE_PHOTO],
  );
});
