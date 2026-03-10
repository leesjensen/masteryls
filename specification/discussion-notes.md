# Discussion And Notes Specification

## Scope
This document defines the target behavior for:
- AI-assisted topic discussion
- learner notes
- section-scoped context
- observer-mode behavior

It is aligned to:
- `domain-model.md`
- `auth-authorization.md`
- `classroom-learning.md`

## Design Goals
- Keep discussion fast and contextual for learning.
- Treat notes as canonical learner artifacts.
- Separate ephemeral chat state from durable learning records.
- Enforce strict read-only behavior in observer mode.

## Concepts

### Discussion
- Purpose: conversational AI assistance tied to current topic/section.
- Persistence class: user-local, optional, non-canonical.
- Storage: namespaced local storage/session cache scoped by authenticated actor user ID (for example `masteryls.discussion.<userId>.<courseId>.<topicId>`).
- Not used as source-of-truth for mastery or grading.

### Note
- Purpose: durable learner-authored study artifact.
- Persistence class: canonical domain entity (`Note`).
- Scope:
  - topic-level
  - optional section-level (`sectionKey`).
- Visible in learner progress context and note indicators.

## Context Model
- Actor context: authenticated user operating the UI.
- Subject context:
  - normal mode: actor = subject.
  - observer mode: subject = observed user (read-only).
- Discussion prompt context can include:
  - course/topic title
  - current section
  - limited prior discussion messages (windowed).

## Discussion Behavior
- Available to authenticated users in classroom learning view.
- Supports two modes in one pane:
  - `Discuss` (AI chat)
  - `Notes` (note authoring/list).
- Section filter can be set from heading actions.
- “Clear discussion” removes local discussion history only.
- AI failures must show non-blocking error messages and allow retry.
- Local/session discussion history must be isolated by `userId` so multiple users sharing one device never see each other's stored messages.

## AI Request Context Contract
Each AI discussion request must be built from explicit context inputs.

### Context Inputs
- `topicTitle`: current topic title.
- `topicContent`: current topic content (sanitized/normalized markdown text).
- `activeSection`: nullable heading filter currently in focus.
- `conversationMessages`: ordered message history for this user+course+topic context.
- `noteContext`: optional saved notes relevant to topic and active section.

### Conversation Message Selection
- Include only roles used by the model conversation API (`user`, `model`).
- Exclude `error` messages from model input.
- Preserve chronological ordering.
- Apply bounded history window (policy-configurable) to control token usage.

### Section Context
- If `activeSection` is set, include explicit section hint in system instruction.
- If unset, do not infer section from stale messages.

### Notes Context
- Include saved notes relevant to `(courseId, topicId, sectionKey?)` when available.
- Pass note text as contextual reference, not as authoritative facts.
- Bound note context size to avoid prompt overgrowth.

### Output Guidance
System instruction should require:
- concise educational response
- markdown-safe output
- topic relevance
- supportive tutoring tone

Baseline instruction profile (from current implementation intent):
- include full topic title/content context in system prompt
- if section is active, include explicit section sentence
- prefer short responses (target: under ~200 words)
- direct answers to learner question/comment
- encourage clarity, additional examples, and critical thinking
- redirect gently when question is off-topic

### Request Safety
- Do not include secrets or credential values in any prompt.
- Minimize personally identifiable data.
- Enforce per-user context isolation so another user’s local history/notes are never included.

## Notes Behavior
- Create note:
  - requires authenticated subject with write permission.
  - persists canonical `Note` record.
  - emits `note.created` activity event.
- Update note:
  - owner edit allowed; privileged moderation optional by policy.
  - emits `note.updated` activity event.
- Save AI response as note:
  - allowed when user has note write permission.
  - saved note content should capture enough context (question + response) for later recall.

## Observer Mode Rules
- Discussion pane may remain visible for context.
- All writes are denied:
  - cannot send AI discussion prompts
  - cannot create/edit notes
  - cannot save AI responses as notes
- UI must clearly show read-only proxy state.
- Accesses remain auditable with actor + observed user IDs.

## Role Behavior
- Learner:
  - full discussion use + note create/update for own subject context.
- Observer:
  - read-only view in delegated subject context.
- Mentor:
  - can view learner notes in scoped context; write behavior by policy.
  - can assume observer mode (read-only) for any user.
- Editor:
  - same as mentor for learner-note visibility in scoped context.
  - can assume observer mode (read-only) for any user.
- Root:
  - administrative visibility; observer-mode still read-only while active.

## Data Contracts

### Local Discussion Message (Ephemeral)
- `id`
- `userId` (actor user ID used for local/session scoping)
- `courseId`
- `topicId`
- `sectionKey` (nullable)
- `role` (`user`, `model`, `error`)
- `content`
- `createdAt`

Message role rules:
- `user`: learner-authored prompt
- `model`: AI response
- `error`: local system error display only (never sent back as model context)

### Canonical Note (Durable)
- `id`
- `courseId`
- `topicId`
- `enrollmentId`
- `userId`
- `sectionKey` (nullable)
- `content`
- `createdAt`
- `updatedAt`

## Privacy And Security
- Discussion history is treated as potentially sensitive user content.
- Do not send unnecessary personal data in AI prompts.
- Do not store provider secrets in discussion/note payloads.
- Any client-stored discussion data (and unsent note drafts, if cached) must be keyed by `userId` and isolated across accounts on shared devices.
- Note rendering follows markdown sanitization policy.
- Observer-mode read-only enforcement must be server-side for note APIs.

## UX Requirements
- Pane is resizable/collapsible consistent with classroom pane model.
- Clear mode labeling (`Discuss` vs `Notes`).
- Empty states:
  - no messages yet
  - no notes yet.
- Section filter badge with one-click clear.
- Visible status when a message is saved as note.

## Legacy Gaps Addressed
- Separates non-canonical AI chat history from canonical learner notes.
- Makes note events explicit in activity/audit stream.
- Prevents accidental writes in observer mode.
- Standardizes section-scoped note/discussion behavior.
- Requires explicit AI context assembly (topic, section, filtered message history, optional notes) so behavior is deterministic.
- Closes current implementation gap where note context may be prepared by the AI utility but not always included by the discussion caller.
