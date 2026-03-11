# UI Tokens Specification

## Scope
This document defines canonical design tokens for the UI contract as framework-agnostic CSS variable names.

It is normative for all styling systems (Tailwind, CSS modules, etc.).

See also:
- `overview.md`

## Token Conventions
- Prefix: `--ui-*`
- Semantic names only (no framework utility names)
- Product code should consume semantic tokens, not hard-coded palette values

## Core Tokens

### Color Tokens
```css
:root {
  --ui-color-surface: #ffffff;
  --ui-color-surface-muted: #f8fafc;
  --ui-color-surface-subtle: #f1f5f9;

  --ui-color-border: #d1d5db;
  --ui-color-border-subtle: #e5e7eb;
  --ui-color-border-strong: #9ca3af;

  --ui-color-text: #111827;
  --ui-color-text-muted: #4b5563;
  --ui-color-text-subtle: #6b7280;
  --ui-color-text-inverse: #ffffff;

  --ui-color-primary: #f59e0b;
  --ui-color-primary-hover: #d97706;
  --ui-color-primary-soft: #fef3c7;

  --ui-color-link: #2563eb;
  --ui-color-link-hover: #1d4ed8;
  --ui-color-link-soft: #dbeafe;

  --ui-color-danger: #dc2626;
  --ui-color-danger-soft: #fef2f2;
  --ui-color-success: #059669;
  --ui-color-warning: #d97706;
}
```

### Spacing Tokens
```css
:root {
  --ui-space-1: 0.25rem;
  --ui-space-2: 0.5rem;
  --ui-space-3: 0.75rem;
  --ui-space-4: 1rem;
  --ui-space-5: 1.25rem;
  --ui-space-6: 1.5rem;
  --ui-space-8: 2rem;
  --ui-space-10: 2.5rem;
  --ui-space-12: 3rem;
}
```

### Radius And Shadow Tokens
```css
:root {
  --ui-radius-sm: 0.375rem;
  --ui-radius-md: 0.5rem;
  --ui-radius-lg: 0.75rem;
  --ui-radius-xl: 1rem;

  --ui-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --ui-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --ui-shadow-lg: 0 10px 24px rgba(0, 0, 0, 0.12);
}
```

### Motion Tokens
```css
:root {
  --ui-motion-fast: 120ms;
  --ui-motion-base: 200ms;
  --ui-motion-slow: 300ms;
  --ui-ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

### Typography Tokens
```css
:root {
  --ui-font-size-xs: 0.75rem;
  --ui-font-size-sm: 0.875rem;
  --ui-font-size-base: 1rem;
  --ui-font-size-lg: 1.125rem;
  --ui-font-size-xl: 1.25rem;
  --ui-font-size-2xl: 1.5rem;
}
```

### Z-Index Tokens
```css
:root {
  --ui-z-base: 0;
  --ui-z-sticky: 100;
  --ui-z-dropdown: 400;
  --ui-z-overlay: 900;
  --ui-z-modal: 1000;
  --ui-z-toast: 1100;
}
```

## Token Usage Rules
- All style constants must originate from these tokens or explicit extensions in this file.
- Raw one-off color values in feature code are disallowed unless a temporary exception is documented.
- Pane width/collapse constants must be defined as shared tokens/primitives, not per-screen ad hoc values.

## Versioning And Change Control
- UI contract follows semver via `ui-contract`; canonical version is pinned in `ui-contract-changelog.md`.
- Token additions: minor version bump.
- Token removals or semantic meaning changes: major version bump.
- Any token change requires spec update and visual regression verification.
