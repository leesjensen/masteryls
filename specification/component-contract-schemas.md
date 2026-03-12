# Component Contract Schema Specification

## Scope
This document defines machine-derivable prop/state/slot contracts for approved UI components.

It is aligned to:
- `ui/ui-components.md`
- `ui/ui-screens.md`
- `view-model-schemas.md`
- `ui/overview.md`

## Purpose
- Freeze reusable component behavior contracts.
- Reduce drift between screen manifests and component implementations.
- Provide a generation-ready registry for component scaffolding and validation.

## Schema Artifacts
Registry data:
- `specification/ui/schemas/components/component-contracts.json`

Validation schemas:
- `specification/ui/schemas/components/component-contract.schema.json`
- `specification/ui/schemas/components/component-contracts.schema.json`

## Contract Model
Each component contract includes:
- `componentId`
- `category` (`layout`, `navigation`, `content`, `form`, `feedback`)
- `description`
- `slots[]`
- `states[]` (subset of canonical state vocabulary)
- `props`:
  - `required[]`
  - `properties{}` (type, enum, itemsType, description)
- `events[]` (name + payload type)
- `a11y.requirements[]`
- `usedByScreens[]`

## Canonical State Vocabulary
The registry uses this state vocabulary:
- `default`
- `hover`
- `focusVisible`
- `active`
- `disabled`
- `loading`
- `readonly`
- `error`

## Derivation Rules
- `usedByScreens` is derived from `ui/manifests/*.ui-manifest.json` `allowedComponents`.
- Every component referenced in any screen manifest must exist in `component-contracts.json`.
- Every component in `component-contracts.json` must define at least one accessibility requirement.

## Required Consistency Checks
1. Manifest component allowlists must be a subset of component registry IDs.
2. Screen view-model state handling must map to component states for interactive controls.
3. Observer-mode read-only screens must map writable controls to `readonly` or `disabled` component states.

## Governance
- Any component add/remove/rename requires updates to:
  - `ui/ui-components.md`
  - `ui/schemas/components/component-contracts.json`
  - `ui/ui-contract-changelog.md`
  - affected screen manifests
- Any prop/state/slot contract change requires a UI contract semver update.

## Legacy Gaps Addressed
- Replaces informal component descriptions with machine-checked contracts.
- Encodes component API boundaries for generation and regression validation.
- Makes component usage-to-screen relationships explicit.
