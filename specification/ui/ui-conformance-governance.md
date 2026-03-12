# UI Conformance Governance Specification

## Scope
This document defines governance rules for:
- waiver lifecycle management
- snapshot/baseline approval
- conformance debt accountability

It is aligned to:
- `ui-conformance-baseline.md`
- `ui-conformance-gap-matrix.md`
- `baselines/ui-conformance-baseline.json`
- `baselines/ui-conformance-waivers.json`
- `ui-contract-changelog.md`

## Authority
When conformance artifacts conflict, precedence is:
1. `ui-contract-changelog.md` version policy
2. `ui-conformance-governance.md` (this document)
3. `ui-conformance-baseline.md`
4. baseline/waiver JSON manifests

## Waiver Lifecycle
Canonical states:
- `open`: waiver exists and gap is unresolved
- `ready-to-close`: deterministic evidence exists for required capture
- `closed`: waiver removed and required scenario coverage present

Lifecycle rules:
1. Every waiver entry in `baselines/ui-conformance-waivers.json` must map to one gap entry in `ui-conformance-gap-matrix.md`.
2. A waiver may remain `open` only while closure criteria in the gap matrix are unmet.
3. A waiver is eligible for `ready-to-close` only when capture evidence exists for the exact `screenId/state` pair.
4. A waiver is `closed` only when:
- the waiver entry is removed,
- baseline scenarios are present for the previously waived state,
- and conformance validation passes.

## Waiver Hygiene Rules
- Waivers are temporary debt, not permanent exclusions.
- Reasons must be specific and testable (no vague "flaky"/"later" wording).
- Waiver reasons must reference the concrete blocker category:
  - route/runtime not implemented
  - deterministic fixture missing
  - observer/read-only setup not controllable
- If a waiver reason changes, update both:
  - `baselines/ui-conformance-waivers.json`
  - `ui-conformance-gap-matrix.md`

## Snapshot Approval Policy
A baseline/snapshot update is approvable only when all are true:
1. Contract alignment:
- affected manifests/schemas/spec docs are updated first.
2. Diff review evidence:
- visual diffs reviewed for layout, tokens, typography, pane behavior, and readonly indicators.
3. Accessibility checks:
- no new accessibility regressions in affected scenarios.
4. Changelog discipline:
- UI contract/version governance records are updated when required.

Required review payload for approval:
- changed scenario IDs
- before/after diff summary
- changed manifests/schemas/docs list
- explicit statement: `intentional` or `regression-fixed`

## Required vs Recommended Scenario Policy
- `required` scenarios gate approval and must remain green (or explicitly waived).
- `recommended` scenarios may be deferred, but regressions should be tracked and scheduled.
- A `required` scenario may not be downgraded to `recommended` without an explicit governance update and rationale.

## Failure And Escalation Policy
- Unapproved baseline refreshes are invalid.
- If a required scenario is removed without waiver + gap entry, the change is invalid.
- If waivers grow without closure progress, open a governance review before additional waivers are added.

## Legacy Gaps Addressed
- Makes waiver handling explicit and auditable.
- Prevents silent baseline drift.
- Defines objective rules for moving from waived to covered states.
