# Canvas Export Specification

## Scope
This document defines the target workflow for exporting MasteryLS course content to Canvas LMS, including:
- full-course export
- incremental topic updates
- reference repair/reconciliation
- safety and audit requirements

It is aligned to:
- `domain-model.md`
- `auth-authorization.md`
- `editor-github-authoring.md`
- `classroom-learning.md`

## Design Goals
- Keep Canvas representation synchronized with course structure/content.
- Preserve clear mappings between MasteryLS entities and Canvas objects.
- Support safe re-export and repair without unintended destructive actions.
- Provide transparent progress and recoverable failure handling.

## Access Control
- Allowed:
  - `editor` (course scope)
  - `root`
- Denied:
  - `guest`, `learner`, `observer`
  - `mentor` unless explicitly granted export capability
- Observer mode: all export actions denied.

## Credential And Integration Model
- Canvas API calls execute server-side through trusted integration boundary.
- Credential material is server-custodied (`CredentialReference(provider=canvas)`).
- UI exposes integration status/health only (no raw secrets).

## Mapping Model

MasteryLS -> Canvas:
- Course -> Canvas course (`canvasCourseId`)
- Module -> Canvas module (`canvasModuleId`)
- Topic -> Canvas page (`canvasPageId`)

Mapping persistence:
- External refs are stored as non-secret metadata (`externalRefs`) on course/module/topic entities.
- Mappings are updated on successful create/repair operations.

## Export Modes

### Full Export
Use when first connecting a course or intentionally rebuilding.

Flow:
1. Validate permissions and Canvas course target.
2. Optional cleanup of existing Canvas pages/modules (if explicitly requested).
3. Create Canvas modules from course modules.
4. Create Canvas pages for topics and associate to modules.
5. Render and push topic content into pages.
6. Publish modules/pages as configured.
7. Persist external reference mappings.
8. Emit export completion events.

### Incremental Topic Export
Use when updating one topic from classroom toolbar/settings.

Flow:
1. Validate permissions and existing mapping.
2. Render current topic content to Canvas-compatible HTML.
3. Update mapped Canvas page.
4. Emit topic export event.

### Reference Repair
Use when mappings drift.

Flow:
1. Validate permissions and Canvas target.
2. Enumerate Canvas pages/modules.
3. Match known topics/modules by deterministic policy (title + existing refs).
4. Update missing/outdated `externalRefs`.
5. Emit repair event with summary.

## Content Transformation Rules

### Markdown to Canvas HTML
- Render markdown via static-safe renderer path.
- Preserve headings, lists, tables, code blocks, media where supported.
- Enforce sanitization before outbound publish.

### Interaction Blocks
- MasteryLS-only interactive blocks are not executable in Canvas.
- Export behavior:
  - render non-interactive fallback/explanatory content
  - preserve links back to MasteryLS topic where appropriate

### Internal Links
- Resolve intra-course topic links to Canvas page links when mapped.
- Fallback to MasteryLS URL when target mapping is unavailable.

### Embedded/Video Topics
- Export as validated embedded iframe/link content compatible with Canvas constraints.

## Deletion/Cleanup Behavior
- Cleanup is opt-in and explicit.
- Cleanup may remove existing Canvas modules/pages before re-export.
- Must show impact warning and require confirmation.
- Cleanup actions are auditable and recoverable only via re-export.

## Progress And UX
- Export UI should provide stepwise progress:
  - validate target
  - optional cleanup
  - create modules/pages
  - push content
  - persist mappings
  - finalize
- Long operations should stream/update status messages.
- Failures should surface partial completion summary and retry guidance.

## Error Handling
- Permission failure: immediate `403` with no side effects.
- Credential/Canvas auth failure: actionable revalidation path.
- Mapping mismatch: recommend repair flow.
- Partial export failure:
  - persist completed mappings where valid
  - report failed entities explicitly
  - allow targeted retry.

## Idempotency And Concurrency
- Full export operations should be safe to rerun.
- Incremental topic export should update in place using stored mapping.
- Concurrent exports on same course should be serialized or locked by policy.

## Audit And Telemetry
Must emit auditable events:
- `content.exported_canvas` (full/incremental)
- `content.export_repair_canvas`
- `content.export_cleanup_canvas` (when cleanup enabled)
- `content.export_failed_canvas`

Event payload includes:
- actor user ID
- course ID
- canvas course ID
- mode (`full`, `incremental`, `repair`)
- counts (modules/pages updated/created/failed)
- outcome and error category

## Security Requirements
- Server-side authorization on all export operations.
- No secret leakage in logs/events/UI.
- Outbound content sanitized and protocol-restricted.
- Observer-mode hard deny on export endpoints.

## Legacy Gaps Addressed
- Formalizes full vs incremental export semantics.
- Makes MasteryLS interaction fallback explicit for Canvas.
- Defines deterministic mapping persistence and repair behavior.
- Adds robust progress, retry, and partial-failure handling.

