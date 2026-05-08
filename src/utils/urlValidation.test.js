import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSubmittedUrl } from './urlValidation.js';

test('validateSubmittedUrl rejects invalid URL format', async () => {
  const result = await validateSubmittedUrl({ url: 'not-a-url', validateUrl: true, fetchImpl: async () => ({ ok: true, status: 200 }) });
  assert.equal(result.percentCorrect, 0);
});

test('validateSubmittedUrl returns full score when validation disabled', async () => {
  const result = await validateSubmittedUrl({ url: 'https://example.com', validateUrl: false, fetchImpl: async () => ({ ok: false, status: 404 }) });
  assert.equal(result.percentCorrect, 100);
  assert.match(result.feedback, /Submission received/i);
});

test('validateSubmittedUrl gives full score when fetch is successful', async () => {
  const result = await validateSubmittedUrl({
    url: 'https://example.com',
    validateUrl: true,
    fetchImpl: async () => ({ ok: true, status: 200 }),
  });
  assert.equal(result.percentCorrect, 100);
  assert.equal(result.validationStatus, 200);
});

test('validateSubmittedUrl uses server validator callback when provided', async () => {
  const result = await validateSubmittedUrl({
    url: 'https://example.com',
    validateUrl: true,
    validateWithServer: async () => ({ ok: true, status: 200 }),
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  assert.equal(result.percentCorrect, 100);
  assert.equal(result.validationStatus, 200);
});

test('validateSubmittedUrl surfaces server validator error message', async () => {
  const result = await validateSubmittedUrl({
    url: 'https://example.com',
    validateUrl: true,
    validateWithServer: async () => ({ ok: false, error: 'URL could not be reached from server.' }),
  });
  assert.equal(result.percentCorrect, 30);
  assert.match(result.feedback, /could not be reached/i);
});

test('validateSubmittedUrl gives partial score when fetch fails', async () => {
  const result = await validateSubmittedUrl({
    url: 'https://example.com/missing',
    validateUrl: true,
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });
  assert.equal(result.percentCorrect, 20);
  assert.equal(result.validationStatus, 404);
});

test('validateSubmittedUrl handles fetch exceptions', async () => {
  const result = await validateSubmittedUrl({
    url: 'https://example.com',
    validateUrl: true,
    fetchImpl: async () => {
      throw new Error('network');
    },
  });
  assert.equal(result.percentCorrect, 30);
  assert.match(result.feedback, /Unable to validate|timed out/i);
});
