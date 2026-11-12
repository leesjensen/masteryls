import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImagePromptText,
  IMAGE_STYLE_PHOTO,
  IMAGE_STYLE_VISUAL,
  IMAGE_STYLE_WATERCOLOR,
  IMAGE_STYLE_LINE_ART,
  IMAGE_STYLE_RENDER_3D,
  IMAGE_STYLE_MINIMALIST,
  IMAGE_STYLE_OPTIONS,
} from './imagePrompt.js';

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

test('each style injects the subject and its own aesthetic direction', () => {
  const cases = [
    [IMAGE_STYLE_WATERCOLOR, /watercolor/i],
    [IMAGE_STYLE_LINE_ART, /line drawing/i],
    [IMAGE_STYLE_RENDER_3D, /3D render/i],
    [IMAGE_STYLE_MINIMALIST, /minimalist/i],
  ];
  for (const [style, pattern] of cases) {
    const text = buildImagePromptText('a model of the atom', style);
    assert.match(text, /a model of the atom/);
    assert.match(text, pattern);
    // Artistic styles should suppress overlaid text.
    assert.match(text, /not overlay any title/i);
  }
});

test('every style shares the common base requirements', () => {
  for (const { value } of IMAGE_STYLE_OPTIONS) {
    assert.match(buildImagePromptText('x', value), /16:9 aspect ratio/);
  }
});

test('defaults to visual when style is omitted or unknown', () => {
  const omitted = buildImagePromptText('x');
  const unknown = buildImagePromptText('x', 'bogus');
  assert.match(omitted, /vector illustration style/);
  assert.equal(unknown, omitted);
});

test('style options list every choice with the visual one first, each carrying a label and description', () => {
  assert.deepEqual(
    IMAGE_STYLE_OPTIONS.map((o) => o.value),
    [IMAGE_STYLE_VISUAL, IMAGE_STYLE_PHOTO, IMAGE_STYLE_WATERCOLOR, IMAGE_STYLE_LINE_ART, IMAGE_STYLE_RENDER_3D, IMAGE_STYLE_MINIMALIST],
  );
  for (const option of IMAGE_STYLE_OPTIONS) {
    assert.ok(option.label && option.description);
  }
});
