# UI Contract Changelog

## Scope
This is the canonical governance record for UI contract versioning.

Canonical version:
- `ui-contract`: `1.2.0`

Version policy:
- Semver is required for UI contract changes.
- Patch: clarifications, typo fixes, non-behavioral wording updates.
- Minor: additive tokens/components/states that are backward compatible.
- Major: removals or semantic changes that can alter rendering/behavior.

## Changelog

### `1.2.0` - 2026-03-12
- Added component contract schema layer:
  - `specification/component-contract-schemas.md`
  - `specification/ui/schemas/components/component-contracts.json`
  - `specification/ui/schemas/components/component-contract.schema.json`
  - `specification/ui/schemas/components/component-contracts.schema.json`
- Added `CourseCard` to approved component list and aligned component usage contracts.

### `1.1.0` - 2026-03-12
- Added machine-validated screen view-model schema layer:
  - `specification/view-model-schemas.md`
  - `specification/ui/schemas/*.json`
- Added per-screen state-variant validation contracts aligned to `ui/manifests/*.ui-manifest.json`.
- Added `viewModelSchema` pointers in UI manifests for direct manifest-to-schema derivation.

### `1.0.0` - 2026-03-11
- Established initial framework-agnostic UI contract.
- Added `ui-principles.md`, `ui-tokens.md`, `ui-components.md`, and `ui-screens.md`.
- Added machine-derivable screen manifests under `specification/ui/manifests/`.
- Added `overview.md` route/state/layout/rendering maps.
- Added `AboutScreen` route and screen manifest.

## Governance Rules
- Any UI token/component/screen-structure change must update this changelog.
- Specs and manifests must be updated in the same change set as version bump.
- Visual regression and accessibility checks must pass for versioned UI changes.
