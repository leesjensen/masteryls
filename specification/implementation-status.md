# Implementation Status

## Purpose
This file is the operational handoff/status record for the specification effort.
It tracks what is complete, what is in progress, and the exact next steps.

Last updated: 2026-03-12
Owner: Spec workflow (interactive)

## Current Snapshot
- Core specification set exists and is linked from `specification/app.md`.
- UI contract layer exists (`specification/ui/*`) with canonical `ui-contract: 1.2.0`.
- UI conformance baseline manifest exists at `specification/ui/baselines/ui-conformance-baseline.json`.
- API-mediated data-access boundary is now normalized across architecture/auth/integration specs (no direct browser table access in target architecture).
- Architecture spec now includes explicit tradeoff rationale for API-mediated access vs direct browser-to-DB access.
- API response envelope rules now use direct success payloads (no top-level `data`/`meta`) and explicit top-level `error` objects for failures.
- Auth flow boundary is now explicit: Supabase Auth SDK handles OTP/session; app API handles operational domain data.
- View-model schema layer now exists with per-screen JSON schemas under `specification/ui/schemas/*`.
- UI manifests now include `viewModelSchema` pointers to per-screen schema files.
- Component contract schema layer now exists under `specification/ui/schemas/components/*`.
- Step 1 architecture-gap specs now exist:
  - `specification/api-contracts.md`
  - `specification/database-schema-migrations.md`
  - `specification/error-resilience.md`
  - `specification/security-threat-model.md`
- Source, test, CI, and package tooling are intentionally unchanged in this effort; this track is specification-only.
- Executable conformance harness artifacts are currently out of scope for this track and not required in-repo.

## Latest Verification Results
Date: 2026-03-12

- Last observed conformance run (historical reference, before harness removal from this track):
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
  - Screen view-model JSON schemas created for all primary routes/states.
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

### 4) Regenerate-From-Spec Readiness
- Status: In progress
- Done:
  - API contracts, database schema/migrations, resilience, and security threat model are now specified.
  - Strict screen view-model JSON schemas now exist for primary route/state variants.
  - Component prop/state/slot contracts now exist as machine-derivable schemas.
- Remaining:
  - Define generation blueprint and acceptance checks for end-to-end regeneration from `specification/` only.

## Next Steps (Keep This List Current)
Update rule: when a step is completed, move it to `Completed` with completion date and add the next highest-value pending step.

Pending:
1. Add `specification/generation-blueprint.md` defining target stack, generation order, and acceptance checks.
2. Add a spec-only gap matrix for currently skipped UI conformance scenarios (`about`, typed error routes, observer runtime).
3. Define governance rule for waiver lifecycle and snapshot approval policy in `specification/ui/`.

Completed:
- 2026-03-12: Added `specification/component-contract-schemas.md` and component contract schema registry under `specification/ui/schemas/components/*`.
- 2026-03-12: Added `specification/view-model-schemas.md` and per-screen JSON schemas in `specification/ui/schemas/*`, then linked them from UI screen contracts.
- 2026-03-12: Bumped UI contract to `1.2.0` in `ui-contract-changelog.md` and updated baseline/waiver manifests.
- 2026-03-12: Chose direct Supabase Auth SDK flow (OTP/session) and removed app-owned `/auth/*` endpoint contracts from `api-contracts.md`; updated architecture/auth/integration docs for boundary consistency.
- 2026-03-12: Simplified API envelope contracts: removed success `data/meta` wrappers and standardized explicit `error` object with `error.requestId` + `X-Request-Id` header.
- 2026-03-12: Added explicit architecture tradeoff record (cost/latency vs policy/security/governance) for API boundary vs direct browser DB access in `architecture-system.md`.
- 2026-03-12: Normalized spec consistency for API-only data access (browser -> API/edge -> Supabase tables) across `app.md`, `architecture-system.md`, `integrations.md`, `auth-authorization.md`, and enrollment flow diagrams.
- 2026-03-12: Added Step 1 gap-closure specs (`api-contracts.md`, `database-schema-migrations.md`, `error-resilience.md`, `security-threat-model.md`).
- 2026-03-12: Removed non-spec implementation artifacts (`scripts/`, `tests/ui-conformance.spec.ts`, `package.json` script additions, CI wiring) to preserve specification-only scope.
- 2026-03-12: Rolled back source and test modifications to keep this effort specification-only.
- 2026-03-11: Added manifest-to-baseline coverage validator and wired CI to fail on uncovered, unwaived states.
- 2026-03-11: Added explicit UI conformance state waiver manifest for uncovered contract states.
- 2026-03-11: Added UI conformance baseline spec and baseline manifest.
- 2026-03-11: Added and validated a temporary manifest-driven conformance harness (later removed for scope control).

## Canonical Artifacts
- `specification/ui/baselines/ui-conformance-baseline.json`
- `specification/ui/baselines/ui-conformance-waivers.json`
- `specification/ui/manifests/*.ui-manifest.json`
- `specification/ui/schemas/*.json`
- `specification/ui/schemas/components/*.json`

## Notes
- This file tracks specification progress; executable harness work is optional and should be done in a separate implementation-focused track if needed.
