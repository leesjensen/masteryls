# Editor And GitHub Authoring Specification

## Scope
This document defines the target authoring model for:
- in-app course/topic editing
- course structure changes (modules/topics/order)
- file management
- GitHub commit/version behavior
- editor preview and safety controls

It is aligned to:
- `domain-model.md`
- `auth-authorization.md`
- `classroom-learning.md`
- `markdown-interactions.md`

## Design Goals
- Treat GitHub as the canonical content repository.
- Keep authoring fast while preserving strong change safety.
- Make all write operations auditable and reversible.
- Prevent secret exposure in client code.
- Ensure learner runtime and editor preview stay behaviorally aligned.
- Always fetch the latest GitHub content for the course definition file (`course.json`, sometimes referred to as `config.json`) and topic markdown, even when upstream caching layers are present.

## Authoring Access Model
- Allowed roles:
  - `editor` (course scope)
  - `root` (global)
- Not allowed:
  - `guest`, `learner`, `observer`
  - `mentor` by default (unless explicitly granted editor capability)
- In observer mode, all authoring is disabled even for privileged actors.

## Authoring Surfaces
- Topic editor:
  - markdown editing
  - interaction block insertion helpers
  - optional AI-assisted content insertion
- Preview pane:
  - learner-equivalent rendering path (no submission side effects)
- Commit history view:
  - topic file commit timeline
  - diff load into editor compare mode
- File panel:
  - list topic-adjacent files
  - upload/delete/insert-reference
- Course pane authoring:
  - add/rename/remove module
  - add/rename/remove topic
  - reorder topics (drag-and-drop)

## Commit History And Diff Requirements
- Editors can open commit history for the current topic content path.
- Commit history entries include at minimum:
  - commit SHA
  - author identity
  - timestamp
  - commit message
- History should be newest-first and support pagination for long histories.
- Selecting a commit supports:
  - view content at that commit (read-only)
  - side-by-side diff against current working content or previous commit
- Diff mode is non-mutating until user explicitly applies/reverts.
- "Restore from commit" (if provided) must create a new head commit; it must never rewrite Git history.
- Diff/restore operations must honor optimistic concurrency checks before final write.

## Canonical Content Model
- Canonical instructional content is markdown/media in GitHub repo paths.
- Course structure is canonicalized in `course.json`.
- Topic metadata persisted in course definition:
  - `id`, `title`, `type`, `status`, `repoPath`, `interactionIds`, etc.
- Runtime raw URLs are derived from canonical repo paths on the default branch head.

## Latest-From-GitHub Read Policy
- Default read behavior is always latest-on-default-branch.
- Reads for course definition and topic markdown must use cache-safe freshness strategy without depending on throttled GitHub API read endpoints.
- Allowed strategies include:
  - conditional requests against raw content URLs
  - explicit cache-busting query parameters for critical freshness reads
  - short-lived client cache with mandatory revalidation before serving
- Client/runtime may cache content for performance, but must revalidate before serving potentially stale critical authoring/runtime reads.
- Commit pinning is not part of the target runtime model.

## GitHub Integration Boundary
- All authenticated GitHub mutations execute server-side via trusted integration boundary.
- Client sends intent + payload; server performs authorization and commit.
- No plaintext PAT/token in client domain objects or local storage.
- Credential status is represented by `CredentialReference`.

## Commit Semantics

## Commit Message Policy
- A non-empty commit message is required for every GitHub write operation.
- Preferred flow:
  - attempt fast AI commit-message generation from the staged diff/context
  - if AI response is not returned within latency budget, immediately fall back to manual prompt
- Latency budget:
  - AI suggestion should return within ~1-2 seconds (policy-configurable)
  - on timeout/failure, do not block commit workflow waiting on AI
- Manual fallback:
  - show commit-message prompt to editor
  - prefill with deterministic template suggestion when available (for example, `update(topic): clarify async state handling`)
- Quality rules for any commit message:
  - summarize user-visible/content-meaningful change
  - avoid generic messages like "update" alone
  - no secrets, tokens, or sensitive learner data
- Final control:
  - editor can always edit/override AI suggestion before commit
  - auto-commit without editor confirmation is not allowed by default

### Topic Content Commit
Operation:
1. Validate editor permission.
2. Validate markdown payload and interaction metadata extraction.
3. Resolve commit message via Commit Message Policy.
4. Commit topic file update to GitHub.
5. Emit content update activity event.

Required outputs:
- new commit SHA
- updated content version marker for cache invalidation

### Course Structure Commit (`course.json`)
Triggered by:
- module/topic add, rename, remove, reorder
- topic type/status/path changes
- external reference updates

Rules:
- Must preserve stable topic IDs unless explicit regeneration operation.
- Must produce deterministic ordering by `position`.
- Must validate path/type consistency (e.g., embedded/video URL rules).

### File Operations
- Upload:
  - sanitize file names
  - commit file to topic path directory
  - return stable repo path reference
- Delete:
  - remove file from repo path directory
  - prevent deleting active topic markdown file unless explicit topic delete flow
- Insert:
  - insert markdown reference generated by file type (image/link/media snippet)

## Concurrency And Conflict Handling
- Use optimistic concurrency:
  - include expected base SHA/version on write requests
  - reject stale writes with conflict (`409`)
- On conflict:
  - preserve local unsaved draft
  - offer reload/rebase/compare options
- Never silently overwrite remote changes.

## Unsaved Changes Safety
- Track dirty state per open topic editor.
- Warn/block on route/topic switch with unsaved edits.
- Provide explicit actions:
  - `Commit`
  - `Discard`
  - `Continue editing`

## Preview Parity Requirements
- Preview uses same markdown + interaction rendering contracts as learner runtime.
- Preview must never create:
  - `InteractionAttempt`
  - `ActivityEvent`
  - exam session transitions
- Interaction blocks in preview are non-mutating and clearly marked as preview-safe.

## Interaction Extraction And Indexing
- On commit, extract interaction IDs/types from markdown fences.
- Update topic `interactionIds` in course definition.
- Re-index topic text for search projection.
- Do not index hidden answer-key markers for learner-facing search.
- Index sync contract:
  - successful topic create and successful topic content commit must trigger incremental `SearchDocument` update for the affected topic.
  - indexing runs post-commit/persist only (never from unsaved drafts).
  - incremental indexing failure is non-blocking for authoring save, but must surface warning, emit audit/ops event, and leave course reindex as recovery.
- See also: `search-progress-metrics.md` (Indexing And Freshness).

## Course Structure Operations

### Add Module
- Create new module with stable UUID + position.
- Append or insert by requested position.

### Rename Module
- Update title only; keep module ID stable.

### Remove Module
- Remove module and contained topics (with explicit confirmation).
- Topic deletion cascades to content path cleanup policy.

### Add Topic
- Generate stable topic UUID.
- Validate type + path contract.
- Optionally scaffold starter markdown by type.

### Rename/Retype Topic
- Update metadata in course definition.
- If path changes, perform explicit move strategy (or create new + deprecate old path).

### Remove Topic
- Remove from course definition.
- Delete associated topic folder/files by policy.
- Ensure default-topic resolution still valid.

### Reorder Topics
- Persist deterministic `position`.
- Commit only if order changed.

## AI-Assisted Authoring
- AI insertion actions (section/quiz/general generation) are opt-in editor tools.
- AI-generated content is draft input; editor remains final authority before commit.
- AI requests must not include credentials or unnecessary PII.
- Generated interaction blocks must be normalized to canonical type schema.

## Audit And Telemetry
Authoring operations emit auditable events:
- `content.updated`
- `content.structure_updated`
- `content.file_uploaded`
- `content.file_deleted`
- `content.reordered`

Event details include:
- actor user ID
- course/topic/module IDs
- operation type
- commit SHA (when applicable)
- outcome (`success`/`denied`/`conflict`)

## Security Requirements
- Server-side authorization for all write paths.
- Strict file/path sanitization to prevent traversal or invalid repo writes.
- Markdown sanitization policy must apply at render boundary (authoring and runtime).
- No secret-bearing fields in editor settings payloads.

## Error Handling
- GitHub API failure -> actionable error with retry option.
- Validation failure -> inline field-level guidance.
- Conflict -> explicit compare/reload flow.
- Partial multi-step failure -> compensating state update or clear recovery instruction.

## Legacy Gaps Addressed
- Removes client-side token custody from editor/settings flows.
- Replaces implicit overwrite behavior with explicit conflict handling.
- Defines deterministic `course.json` commit rules for structure edits.
- Makes preview non-mutating by contract.
- Standardizes file operation behavior and audit coverage.
