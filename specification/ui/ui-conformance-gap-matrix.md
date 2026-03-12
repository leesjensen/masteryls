# UI Conformance Gap Matrix

## Scope
This document tracks known spec-vs-runtime conformance gaps that currently prevent full execution of required UI baseline scenarios.

It is aligned to:
- `ui-conformance-baseline.md`
- `baselines/ui-conformance-baseline.json`
- `baselines/ui-conformance-waivers.json`
- `../implementation-status.md`

## Purpose
- Keep skipped/waived conformance gaps explicit and actionable.
- Separate specification completeness from runtime implementation readiness.
- Define clear closure criteria before waiver removal.

## Priority Matrix

| Gap ID | Priority | Contract Area | Affected Screen States | Current Evidence | Closure Criteria |
|---|---|---|---|---|---|
| `GAP-ABOUT-ROUTE` | P1 | Route availability for `/about` | `AboutScreen.loading`, `AboutScreen.error` | Waived in `baselines/ui-conformance-waivers.json` | Runtime can deterministically render `/about` loading/error states; waivers removed; baseline scenarios added/updated |
| `GAP-ERROR-TYPED-ROUTES` | P1 | Typed `/error/:code` coverage | `ErrorScreen.401`, `ErrorScreen.409`, `ErrorScreen.422`, `ErrorScreen.500` | Waived in `baselines/ui-conformance-waivers.json` | Runtime supports deterministic rendering for all typed error codes in UI contract; waivers removed; scenarios captured |
| `GAP-OBSERVER-DETERMINISM` | P0 | Observer-mode deterministic runtime controls | `CourseCreationScreen.readonlyObserver`, `CourseExportScreen.readonlyObserver`, `MetricsScreen.readonlyObserver`, `ProgressScreen.readonlyObserver` | Waived in `baselines/ui-conformance-waivers.json`; historical capture skips | Deterministic observer setup profile can force readonly state across affected routes; waivers removed; scenarios captured |

## Gap Detail

### `GAP-ABOUT-ROUTE`
- Blocking issue:
  - Required baseline capture for `/about` has not been consistently executable in runtime.
- Spec status:
  - Route and screen contract are fully specified.
- Required closure evidence:
  - executable capture for:
    - `/about` `ready`
    - `/about` `loading`
    - `/about` `error`

### `GAP-ERROR-TYPED-ROUTES`
- Blocking issue:
  - Only partial typed error route rendering has been executable.
- Spec status:
  - Error screen state contract requires `401`, `403`, `404`, `409`, `422`, `500`.
- Required closure evidence:
  - executable capture for each typed route/state:
    - `/error/401`
    - `/error/403`
    - `/error/404`
    - `/error/409`
    - `/error/422`
    - `/error/500`

### `GAP-OBSERVER-DETERMINISM`
- Blocking issue:
  - Observer-mode readonly states are not fully forceable via deterministic test/setup profiles for all routes.
- Spec status:
  - Observer read-only behavior is fully specified across domain/auth/UI contracts.
- Required closure evidence:
  - deterministic setup profile(s) that produce observer readonly state for:
    - `/courseCreation`
    - `/courseExport`
    - `/metrics`
    - `/progress`

## Waiver Lifecycle Linkage
For each gap above:
1. Gap remains `open` while corresponding waiver entries exist.
2. Gap moves to `ready-to-close` when executable capture evidence exists.
3. Gap closes only when:
- waiver entries are removed,
- required baseline scenarios are present,
- and conformance validation passes.

## Legacy Gaps Addressed
- Replaces implicit skip reasons with explicit tracked gap IDs.
- Keeps conformance debt visible without changing runtime scope in this spec track.
- Provides deterministic exit criteria for waiver removal.
