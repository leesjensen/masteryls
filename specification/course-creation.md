# Course Creation Specification

## Scope
This document defines the target end-to-end workflow for creating a new course, including:
- metadata capture
- source-template or AI-generated structure
- GitHub repository provisioning
- initial course definition commit
- initial access/enrollment setup

It is aligned to:
- `domain-model.md`
- `auth-authorization.md`
- `editor-github-authoring.md`

## Design Goals
- Create a usable course quickly with safe defaults.
- Keep GitHub as canonical source of course content.
- Remove client-side secret handling from creation flows.
- Provide clear progress feedback for long-running steps.
- Produce deterministic, valid `course.json` output.

## Access Control
- Allowed:
  - `editor` (course creation capability by policy)
  - `root`
- Denied:
  - `guest`, `learner`, `observer`
  - `mentor` unless explicitly granted creation capability
- Observer mode: creation is always denied.

## Creation Inputs
Required:
- `name`
- `title`
- `description`
- target GitHub owner/account
- target repository name

Optional:
- generation mode:
  - `template`
  - `ai_generated`
- template source owner/repository (when `template` mode)

Derived defaults:
- initial course `state`: `draft`
- `visibility`: policy default (typically `authenticated` or `private`)
- `deleteProtected`: policy default

## Credential Model
- No raw GitHub token entry in client form.
- Course creation uses server-custodied `CredentialReference(provider=github)`.
- If credential missing/invalid, user must complete credential setup flow before creation.

## Creation Modes

### Mode A: Template-Based
1. Validate source template repository eligibility.
2. Provision target repo from template.
3. Wait for repository readiness.
4. Load existing `course.json` from target repo:
   - if present, normalize/validate and persist.
   - if absent, attempt fallback generation from `instruction/modules.md`.
5. Commit normalized `course.json` if needed.

### Mode B: AI-Generated
1. Generate draft course structure from title/description prompt.
2. Validate and normalize generated structure:
   - stable topic IDs
   - valid module/topic ordering
   - valid topic paths/types
3. Provision target repo from base template.
4. Wait for repository readiness.
5. Commit generated `course.json`.
6. Optionally generate initial overview README content.

## Repository Provisioning Contract
- Repository creation/provisioning executes server-side.
- Provisioning must return:
  - repository identifier
  - default branch
  - readiness status
- Readiness check should tolerate eventual consistency without blocking indefinitely.
- Timeout/failure paths must return actionable recovery guidance.

## Course Definition Normalization
`course.json` normalization rules:
- preserve stable IDs once assigned
- enforce canonical topic schema (`id`, `title`, `type`, `status`, `repoPath`, `position`)
- convert legacy type aliases to canonical interaction/topic types where needed
- set deterministic module/topic ordering
- ensure a valid default topic exists when publishable content is present

Fallback from `instruction/modules.md` (legacy support):
- parse module headings and topic links
- synthesize topic IDs and canonical topic records
- prepend/ensure overview/home topic where policy requires

## Persistence And Post-Create Actions
On successful create:
1. Persist `Course` metadata in app data store.
2. Persist initial `CourseDefinition`.
3. Grant course-scoped `editor` role to creator (unless already covered by policy).
4. Create creator `Enrollment` (policy-configurable; default true).
5. Refresh caller's effective permissions/session state.

## Progress UX For Long Operations
- Creation UI must display step-by-step progress states:
  - validating inputs
  - provisioning repo
  - waiting for readiness
  - generating/normalizing definition
  - committing content
  - finalizing permissions/enrollment
- If cancellation is supported:
  - cancel should stop remaining non-started steps
  - partial side effects must be reported clearly

## Error Handling
Validation errors:
- field-level messages (missing/invalid values).

Provisioning/integration errors:
- clear message + retry path.
- include whether repo was created to avoid duplicate attempts.

AI generation errors:
- allow fallback to template mode without losing form data.

Commit conflicts/failures:
- preserve generated definition in client memory for retry/export.

## Audit And Telemetry
Must emit auditable events:
- `course.create_started`
- `course.create_succeeded`
- `course.create_failed`
- `content.structure_updated` (initial definition commit)
- role grant/enrollment events resulting from creation

Audit payload includes:
- actor user ID
- target course ID/name
- creation mode
- repository reference
- outcome and error category (if failed)

## Security Requirements
- Server-side authorization for all creation/provisioning actions.
- Strict validation/sanitization of repo identifiers and generated paths.
- No secret tokens in request/response payloads.
- AI prompts must avoid sending sensitive operational secrets.

## Legacy Gaps Addressed
- Replaces client-supplied token workflow with credential references.
- Formalizes deterministic `course.json` normalization.
- Defines clear fallback when template lacks `course.json`.
- Adds explicit progress + recovery behavior for long-running creation steps.

