# UI Contract Changelog

## Scope
This is the canonical governance record for UI contract versioning.

Canonical version:
- `ui-contract`: `1.0.0`

Version policy:
- Semver is required for UI contract changes.
- Patch: clarifications, typo fixes, non-behavioral wording updates.
- Minor: additive tokens/components/states that are backward compatible.
- Major: removals or semantic changes that can alter rendering/behavior.

## Changelog

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
