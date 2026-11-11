import test from 'node:test';
import assert from 'node:assert/strict';
import { gitBlobSha } from './gitBlobSha.js';

// These are the canonical outputs of `git hash-object` for the given content, so a match proves our
// SHA equals the `sha` GitHub stores for a blob with the same bytes.
test('gitBlobSha matches git hash-object for an empty file', async () => {
  assert.equal(await gitBlobSha(''), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
});

test('gitBlobSha matches git hash-object for "hello\\n"', async () => {
  assert.equal(await gitBlobSha('hello\n'), 'ce013625030ba8dba906f756967f9e9ca394464a');
});

test('gitBlobSha matches git hash-object for "what is up, doc?"', async () => {
  assert.equal(await gitBlobSha('what is up, doc?'), 'bd9dbf5aae1a3862dd1526723246b20206e5fc37');
});

test('gitBlobSha hashes multibyte content by byte length, not character length', async () => {
  // "é" is 2 bytes in UTF-8; the blob header must use the byte length.
  const expected = await gitBlobSha(new TextEncoder().encode('é'));
  assert.equal(await gitBlobSha('é'), expected);
});
