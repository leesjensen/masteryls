# Generation Run Checklist

## Scope
This checklist defines the required execution stages and expected artifacts for generating MasteryLS from `specification/` only.

It is the executable handoff contract for generator tooling.

## Preconditions
- Generator is configured to read only `specification/` inputs.
- No runtime source files are used as generation inputs.
- `policy-defaults.json` and `schemas/course-json.schema.json` are present.

## Stage Checklist

### 1. Validate Specification Inputs
Command contract:
- `generator validate --spec specification`

Expected outputs:
- `out/reports/validate-report.json`
- `out/reports/validate-errors.json` (empty array when successful)

Required checks:
- markdown reference graph resolves
- JSON schemas parse
- API contracts include request/response schema IDs
- UI manifests link valid screen and schema contracts

### 2. Build Deterministic IR
Command contract:
- `generator build-ir --spec specification --out out/ir`

Expected outputs:
- `out/ir/domain.json`
- `out/ir/authz.json`
- `out/ir/api.json`
- `out/ir/database.json`
- `out/ir/ui.json`
- `out/ir/tests.json`
- `out/reports/ir-summary.json`

Required checks:
- stable ordering
- deterministic enum normalization
- no unresolved references

### 3. Generate Backend Layer
Command contract:
- `generator gen backend --ir out/ir --out generated/backend`

Expected outputs:
- DB migrations
- API handler skeletons/contracts
- policy evaluation modules
- integration adapters

Required checks:
- endpoint inventory matches `api-contracts.md`
- observer-mode write denials encoded
- idempotency-aware write handlers generated

### 4. Generate Frontend Layer
Command contract:
- `generator gen frontend --ir out/ir --out generated/frontend`

Expected outputs:
- route shells
- view-model mappers
- component implementations from contracts
- token-driven style layer

Required checks:
- all routes from `routing-state.md` generated
- all required screen states from manifests generated
- read-only observer UI states generated

### 5. Generate Test Artifacts
Command contract:
- `generator gen tests --ir out/ir --out generated/tests`

Expected outputs:
- unit/integration/e2e scaffolds
- security matrix tests for role/observer behavior
- UI conformance scenario fixtures

Required checks:
- required role matrix scenarios exist
- API error envelope tests exist
- visual conformance required scenarios are present

### 6. Verify Generated Build
Command contract:
- `generator verify --project generated --out out/reports`

Expected outputs:
- `out/reports/build-report.json`
- `out/reports/contract-report.json`
- `out/reports/security-report.json`
- `out/reports/conformance-report.json`

Required checks:
- generated app compiles
- generated API compiles
- DB migration set applies cleanly
- contract checks and acceptance gates pass

## Acceptance Gate
A generation run is accepted only when all stage reports are successful and there are no unresolved validation errors.

If any stage fails:
- no generated baseline is promoted
- failure report must identify source spec file(s)

## Governance
- Any new stage or required artifact must be added here before generator behavior changes.
- Changes to this checklist require updates to:
  - `generation-blueprint.md`
  - `implementation-status.md`
