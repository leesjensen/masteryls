# UI Components Specification

## Scope
This document defines approved UI components, shared state semantics, and composition rules.

It is normative for the UI contract and framework-agnostic.

See also:
- `overview.md`
- `../component-contract-schemas.md`

## Component State Model
All interactive components support the following state vocabulary where applicable:
- `default`
- `hover`
- `focusVisible`
- `active`
- `disabled`
- `loading`
- `readonly`
- `error`

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "lineColor": "#9ca3af", "primaryBorderColor": "#9ca3af", "secondaryBorderColor": "#9ca3af", "tertiaryBorderColor": "#9ca3af", "clusterBorder": "#9ca3af", "edgeLabelBackground": "#ffffff", "primaryTextColor": "#111827"}}}%%
stateDiagram-v2
  [*] --> default
  default --> hover
  default --> focusVisible
  focusVisible --> active
  default --> loading
  default --> disabled
  default --> readonly
  default --> error
  loading --> default
  error --> default
```

## Approved Core Components

### Layout
- `AppShell`
- `PaneGroup`
- `CoursePane`
- `DiscussionPane`
- `MainPane`
- `Splitter`

### Navigation
- `TopToolbar`
- `Tabs`
- `BreadcrumbTitle`
- `TopicList`
- `Pagination`

### Content Surfaces
- `Card`
- `CourseCard`
- `Panel`
- `Badge`
- `EmptyState`

### Form And Inputs
- `FormField`
- `InputField`
- `TextAreaField`
- `SelectField`
- `CheckboxField`
- `RadioField`
- `Button`

### Feedback And Overlays
- `AlertBanner`
- `ConfirmDialog`
- `ProgressOverlay`
- `InlineError`

## Component Contracts
- `CoursePane`:
  - slots: `tabs`, `body`, `footer` (optional)
  - behaviors: resize, collapse, restore width
- `DiscussionPane`:
  - slots: `modeTabs`, `messagesOrNotes`, `composer`
  - behaviors: resize, collapse, readonly-observer lock
- `CourseCard`:
  - variants: `enrolled`, `discoverable`, `readonly`
  - actions: `open`, `join`, `leave` (by policy and state)
- `TopToolbar`:
  - slots: `leftActions`, `contextTitle`, `rightActions`
  - required indicators: mode, observer-readonly status
- `FormField`:
  - slots: `label`, `control`, `hint`, `error`
  - accessibility: label association required

## Composition Rules
- Screens are composed from approved components only.
- Feature code must not create new visual primitives inline when an approved component exists.
- Behavior logic remains in view models/capability hooks; components are render-first and side-effect-light.
- Observer mode write locks must be reflected by component `readonly`/`disabled` state, not hidden business logic.

## Machine-Derivable Contracts
Canonical component contract artifacts:
- `../component-contract-schemas.md`
- `schemas/components/component-contracts.json`
- `schemas/components/component-contract.schema.json`
- `schemas/components/component-contracts.schema.json`

## Extension Policy
- New component proposals must specify:
  - purpose and slot contract
  - state model
  - accessibility requirements
  - allowed usage contexts
- Approved additions update this document and relevant `ui-manifest.json` files.

## Legacy Gaps Addressed
- Removes repetitive one-off JSX/UI patterns.
- Standardizes pane and form behaviors across routes.
- Enforces consistent readonly-observer behavior at component level.
