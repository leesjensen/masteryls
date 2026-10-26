// Canonical chrome styling for MasteryLS shared UI primitives.
//
// This module is the single source of truth for the class strings used by the
// `ui/` primitives (Button, Input, Select, Textarea, Modal). Keeping the class
// composition here (pure, no JSX) lets us unit-test the canonical choices and
// keeps every primitive consuming the same tokens.
//
// Canonical decisions (see the UI-consistency audit):
//   radius        rounded-md   (rounded-lg for modal surfaces)
//   input border  border-gray-300
//   card border   border-gray-200
//   focus ring    ring-2 ring-blue-500 (+ offset for buttons)
//   disabled      opacity-50 + cursor-not-allowed
//   accent        blue (amber is reserved for semantic use; see memory)

export const RADIUS = 'rounded-md';
export const INPUT_BORDER = 'border-gray-300';
export const CARD_BORDER = 'border-gray-200';

function join(...parts) {
  return parts.filter(Boolean).join(' ');
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  outline: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'bg-transparent text-gray-600 hover:text-blue-600',
};

const BUTTON_SIZES = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2 text-sm',
};

export function buttonClasses({ variant = 'primary', size = 'md', className = '' } = {}) {
  const variantClass = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;
  const sizeClass = BUTTON_SIZES[size] || BUTTON_SIZES.md;
  return join(BUTTON_BASE, variantClass, sizeClass, className);
}

const FIELD_BASE =
  'w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';

const FIELD_SIZES = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-3 py-2 text-sm',
};

function fieldClasses(size, extra, className) {
  return join(FIELD_BASE, FIELD_SIZES[size] || FIELD_SIZES.md, extra, className);
}

export function inputClasses({ size = 'md', className = '' } = {}) {
  return fieldClasses(size, '', className);
}

export function textareaClasses({ size = 'md', className = '' } = {}) {
  return fieldClasses(size, 'resize-y', className);
}

export function selectClasses({ size = 'md', className = '' } = {}) {
  return fieldClasses(size, 'bg-white', className);
}

export const BUTTON_VARIANT_NAMES = Object.keys(BUTTON_VARIANTS);
export const BUTTON_SIZE_NAMES = Object.keys(BUTTON_SIZES);
