import test from 'node:test';
import assert from 'node:assert/strict';
import { buttonClasses, inputClasses, textareaClasses, selectClasses, BUTTON_VARIANT_NAMES, BUTTON_SIZE_NAMES } from './styles.js';

test('buttonClasses defaults to primary md', () => {
  const cls = buttonClasses();
  assert.match(cls, /bg-blue-600/);
  assert.match(cls, /hover:bg-blue-700/);
  assert.match(cls, /px-4 py-2/);
  assert.match(cls, /rounded-md/);
  assert.match(cls, /disabled:opacity-50/);
  assert.match(cls, /focus-visible:ring-blue-500/);
});

test('buttonClasses applies each variant', () => {
  assert.match(buttonClasses({ variant: 'secondary' }), /bg-gray-200/);
  assert.match(buttonClasses({ variant: 'outline' }), /bg-white/);
  assert.match(buttonClasses({ variant: 'outline' }), /border-gray-300/);
  assert.match(buttonClasses({ variant: 'danger' }), /bg-red-600/);
  assert.match(buttonClasses({ variant: 'ghost' }), /bg-transparent/);
});

test('buttonClasses falls back to primary/md for unknown values', () => {
  const cls = buttonClasses({ variant: 'bogus', size: 'nope' });
  assert.match(cls, /bg-blue-600/);
  assert.match(cls, /px-4 py-2/);
});

test('buttonClasses honors sm/xs sizes and appends custom className last', () => {
  const cls = buttonClasses({ size: 'sm', className: 'w-full' });
  assert.match(cls, /px-3 py-1/);
  assert.ok(cls.endsWith('w-full'));
  assert.match(buttonClasses({ size: 'xs' }), /px-2 py-1 text-xs/);
});

test('field helpers honor the sm size', () => {
  assert.match(inputClasses({ size: 'sm' }), /px-2 py-1/);
  assert.match(selectClasses({ size: 'sm' }), /px-2 py-1/);
  assert.match(inputClasses(), /px-3 py-2/);
});

test('field helpers share the canonical border/focus and add their own bits', () => {
  for (const cls of [inputClasses(), textareaClasses(), selectClasses()]) {
    assert.match(cls, /border-gray-300/);
    assert.match(cls, /focus:ring-blue-500/);
    assert.match(cls, /rounded-md/);
  }
  assert.match(textareaClasses(), /resize-y/);
  assert.match(selectClasses(), /bg-white/);
  assert.ok(inputClasses({ className: 'mb-4' }).endsWith('mb-4'));
});

test('variant/size name exports stay in sync', () => {
  assert.deepEqual(BUTTON_VARIANT_NAMES, ['primary', 'secondary', 'outline', 'danger', 'ghost']);
  assert.deepEqual(BUTTON_SIZE_NAMES, ['xs', 'sm', 'md']);
});
