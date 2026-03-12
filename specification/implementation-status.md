# Implementation Status

## Purpose
This file is the operational handoff/status record for the specification effort.
It tracks what is complete, what is in progress, and the exact next steps.

Last updated: 2026-03-12
Owner: Spec workflow (interactive)

## Current Snapshot
- Core specification set exists and is linked from `specification/app.md`.
- UI contract layer exists (`specification/ui/*`) with canonical `ui-contract: 1.0.0`.
- UI conformance baseline manifest exists at `specification/ui/baselines/ui-conformance-baseline.json`.
- Playwright UI conformance capture test exists at `tests/ui-conformance.spec.ts`.
- Source and test code are intentionally unchanged in this effort; this track is specification-only.

## Latest Verification Results
Date: 2026-03-12

- Command:
  - `npm run validate:ui-conformance-coverage`
  - `UI_CONFORMANCE=1 npx playwright test tests/ui-conformance.spec.ts`
- Result:
  - UI coverage validator: `pass`
  - coverage totals: `manifestStates=48 coveredStates=14 waivedStates=34 scenarios=16`
  - conformance capture: `11 passed`, `5 skipped`, `0 failed`
- Skipped scenario reasons (current codebase):
  - `/about` route is in spec but not implemented in runtime.
  - typed `/error/:code` route is in spec but not implemented in runtime.
  - observer-mode runtime controls are not implemented for deterministic capture.

## Goal Status

### 1) Match current look and feel
- Status: In progress
- Done:
  - UI principles, tokens, components, and route/screen contracts defined.
  - Initial visual capture pipeline running.
- Remaining:
  - Replace skipped scenarios with executable coverage.
  - Add stable approved visual baselines (assert mode) and review workflow.

### 2) UI derivable from specification
- Status: In progress
- Done:
  - Screen manifests created for all primary routes.
  - Baseline scenario manifest created.
  - Added automated coverage validator:
    - every required manifest state must be represented in baseline scenarios or explicitly waived.
- Remaining:
  - Define full scenario-level contract assertion catalog in specification artifacts.
  - Keep implementation/test updates out of this track until explicitly requested.

### 3) Clean, extensible, maintainable architecture
- Status: In progress
- Done:
  - Architecture spec includes phased migration away from broad `useCourseOperations`.
  - Boundary rules documented (services -> view models -> renderer/components).
- Remaining:
  - Begin implementation-phase migration tasks by capability.
  - Add guardrails/tests that prevent ad hoc cross-capability coupling.

## Next Steps (Keep This List Current)
Update rule: when a step is completed, move it to `Completed` with completion date and add the next highest-value pending step.

Pending:
1. Add a spec-only gap matrix for currently skipped conformance scenarios (`about`, typed error routes, observer runtime).
2. Define scenario-level contract assertions in spec docs (slots/components/state markers) as implementation guidance.
3. Add governance rule for waiver lifecycle (review cadence / expiration policy).
4. Define snapshot approval/review workflow in spec without changing app/test code.
5. Expand baseline scenarios toward additional required manifest states to reduce long-term waiver dependency.

Completed:
- 2026-03-12: Rolled back source and test modifications to keep this effort specification-only.
- 2026-03-11: Added manifest-to-baseline coverage validator and wired CI to fail on uncovered, unwaived states.
- 2026-03-11: Added explicit UI conformance state waiver manifest for uncovered contract states.
- 2026-03-11: Added UI conformance baseline spec and baseline manifest.
- 2026-03-11: Added manifest-driven Playwright capture runner.
- 2026-03-11: Stabilized capture run by stubbing GitHub read endpoints used by UI flows.

## Runbook Commands
- Validate manifest-state coverage (CI gate):
  - `npm run validate:ui-conformance-coverage`
- Capture-only run:
  - `UI_CONFORMANCE=1 npx playwright test tests/ui-conformance.spec.ts`
- Update snapshots (when intentional):
  - `UI_CONFORMANCE=1 UI_CONFORMANCE_ASSERT=1 npx playwright test tests/ui-conformance.spec.ts --update-snapshots`
- Validate tests are discoverable:
  - `npx playwright test tests/ui-conformance.spec.ts --list`

## Notes
- `test-results/` is ephemeral and gitignored.
- Approved durable visual baselines should come from snapshot assert mode plus review.
