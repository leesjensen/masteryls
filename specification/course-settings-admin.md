# Course Settings And Administration Specification

## Scope
This document defines target behavior for course-level administration:
- course metadata/settings edits
- role and delegation management
- maintenance operations
- destructive/guarded operations

It is aligned to:
- `domain-model.md`
- `auth-authorization.md`
- `editor-github-authoring.md`
- `policy-defaults.md`

## Design Goals
- Keep operational controls explicit and auditable.
- Enforce least privilege and policy-driven admin actions.
- Prevent accidental destructive changes.
- Keep non-secret settings editable while secrets remain server-custodied.

## Settings Surface (Course Pane > Settings)
The course settings surface should present:
- Overview:
  - course ID/slug
  - module/topic counts
  - enrollment counts
- Information:
  - `name`, `title`, `description`
  - source repository reference
  - publication state and visibility
  - delete protection status
- Integrations:
  - Canvas external references/status
  - credential status indicators (never raw secret values)
- Operations:
  - save changes
  - maintenance actions
  - role/delegation management
  - guarded destructive actions (if authorized)

## Editable Settings Contract
Editable fields (authorized roles only):
- `name`
- `title`
- `description`
- `state` (`draft`, `published`, `archived`)
- `visibility` (`public`, `authenticated`, `private`)
- `deleteProtected`
- allowed non-secret `externalRefs`

Non-editable or separately managed:
- IDs/slugs
- raw credential material
- immutable audit fields

Validation rules:
- title and name required
- state transitions follow lifecycle rules
- visibility changes must respect policy and active enrollments where applicable

## Save Behavior
On save:
1. Validate field-level constraints.
2. Authorize action by role/scope.
3. Persist metadata changes.
4. Emit auditable admin/content events.
5. Refresh runtime course state without requiring full app reload.

Dirty-state behavior:
- Save button enabled only when a meaningful change is detected.
- On save success, clear dirty state and show confirmation.

## Role Management

## Supported course-scoped roles
- `mentor`
- `editor`

## Management rules
- `root` can grant/revoke all course roles.
- course-scoped admin policy may allow `editor` to manage selected course roles when `policy-defaults.json.authz.editorCanManageCourseRoles` is true.
- each non-archived course must always retain at least one active `editor`.
- role changes are immediate and auditable.

## User search and selection
- user search by name/email with bounded results.
- explicit add/remove actions.
- prevent accidental self-lockout by editor floor constraint.

## Observer Delegation Management
- Observer delegation is user-to-user (not course-scoped) and is managed separately from course settings.
- Delegation maps:
  - `observerUserId` -> `observedUserId` (global/user scope).
- Course settings may display observer-mode status indicators, but delegation assignment belongs in user administration surfaces.

## Integration Settings
- Show integration health/status for GitHub/Canvas/AI credentials via `CredentialReference`.
- Allow revalidation/refresh of credential status.
- Never render or persist raw token/secret values in settings forms.

## Maintenance Operations

### Search Reindex
- Rebuild `SearchDocument` projection from current topic content.
- Operation is idempotent and progress-reportable.
- Emits maintenance event with actor and scope.

### Content Freshness Refresh
- Force refresh/revalidation of latest branch-head course definition and topic content reads.
- Intended for stale-cache recovery without using commit pinning.
- Requires explicit confirmation and audit event.

### Canvas Reference Repair
- Reconcile course/topic external Canvas references with current Canvas state.
- Non-destructive by default; destructive options require explicit confirmation.

## Destructive Operations

### Course Delete
Allowed roles:
- root (and optionally explicitly authorized course admin policy)

Hard guards:
- blocked when `deleteProtected == true` unless policy override allows root override
- default root override flag is `policy-defaults.json.admin.rootCanOverrideDeleteProtection`
- explicit confirmation dialog with impact summary
- second-step confirmation phrase for irreversible delete

Delete behavior:
- remove catalog/course metadata per policy
- handle enrollments/progress according to retention policy
- optionally delete backing GitHub repository when configured and authorized
- default `deleteRepository` behavior is `policy-defaults.json.admin.defaultDeleteRepositoryOnCourseDelete`
- emit terminal audit event with actor, scope, and outcome

## Authorization And Observer Mode
- In observer mode, all settings/admin writes are denied.
- Settings page may display read-only data in observer mode, but no controls are actionable.
- All write endpoints enforce authorization server-side regardless of UI state.

## Auditing Requirements
Must emit auditable events for:
- course settings updated
- state/visibility transitions
- role grants/revokes
- observer delegation grants/revokes
- maintenance operations started/completed/failed
- delete attempts/success/failure

Audit payload includes:
- actor user ID
- course ID
- operation
- before/after summary where applicable
- outcome (`success`, `denied`, `failed`)

## Error Handling
- Permission denied: clear `403` feedback with no partial writes.
- Validation error: field-level messages + no commit.
- Integration failure: actionable retry guidance.
- Partial multi-step failures: explicit recovery instructions.

## Legacy Gaps Addressed
- Removes token-in-settings pattern in favor of credential references.
- Formalizes observer delegation management as first-class admin workflow.
- Adds explicit delete guards and irreversible-action friction.
- Makes maintenance actions auditable and policy-governed.
