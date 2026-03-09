# Markdown And Interaction Engine Specification

## Scope
This document defines the target markdown rendering and interaction execution model for classroom and editor preview.

It standardizes:
- markdown parsing and sanitization
- custom interaction block schema
- submission/grading contracts
- role-aware runtime behavior

## Design Goals
- Author-friendly markdown with predictable rendering.
- Secure-by-default content handling.
- Strongly-typed interaction definitions and payloads.
- Consistent behavior across learner view, observer mode, and editor preview.
- Auditable submissions and grading results.

## Content Sources
- Canonical topic content is markdown from GitHub-backed course content.
- Renderer input is plain markdown string plus topic/course context.
- Runtime-generated HTML is never persisted as canonical content.

## Markdown Rendering Pipeline (Target)
1. Load markdown content.
2. Parse markdown with approved extensions (GFM, tables, task lists, emoji, alerts).
3. Extract and validate custom interaction blocks.
4. Sanitize rendered output using strict allowlist schema.
5. Render React view with controlled component overrides.

Rules:
- Default mode is no unsafe HTML execution.
- Any raw HTML support must pass explicit allowlist sanitization.
- Only approved URI protocols are allowed (`https`, `mailto`, `tel` where applicable).

## Custom Interaction Block Format
Interaction blocks use fenced code with language `masteryls`.

Example:
````markdown
```masteryls
{"id":"uuid", "type":"multiple_choice", "title":"Question title"}
Question body markdown

- [x] Correct
- [ ] Incorrect
```
````

Parsing contract:
- First non-empty line of block body is JSON metadata.
- Remaining content is interaction body.
- Invalid metadata or unsupported type renders a safe error placeholder.

## Interaction Metadata Schema

Common fields:
- `id` (required, UUID)
- `type` (required)
- `title` (optional)
- `version` (optional, default `1`)
- `required` (optional boolean, default `false`)
- `gradingPolicy` (optional: `auto`, `manual`, `mixed`, `none`)
- `maxAttempts` (optional integer, default policy-driven)
- `allowRetry` (optional boolean)

Type values:
- `multiple_choice`
- `multiple_select`
- `survey`
- `essay`
- `file_submission`
- `url_submission`
- `teaching`
- `prompt`

Compatibility aliases (input only):
- `multiple-choice` -> `multiple_choice`
- `multiple-select` -> `multiple_select`
- `file-submission` -> `file_submission`
- `url-submission` -> `url_submission`

## Type-Specific Body/Payload Contracts

### multiple_choice / multiple_select
Body:
- prompt markdown
- checkbox-style answer list in markdown

Submission payload:
- `selectedIndices: number[]`

Result:
- `percentCorrect` (policy-defined scoring)
- `feedback` (AI/system/mentor)

### survey
Body:
- prompt markdown
- single-select or multi-select options

Submission payload:
- `selectedIndices: number[]`

Result:
- no correctness score required
- optional aggregate visibility by role/policy

### essay
Body:
- prompt markdown

Submission payload:
- `text: string`

Result:
- `percentCorrect` optional
- `feedback` optional

### file_submission
Body:
- instructions markdown

Submission payload:
- file references/metadata (not raw blob in event payload)

Result:
- receipt + optional grading outcome

### url_submission
Body:
- instructions markdown

Submission payload:
- `url: string` (validated `https` preferred)

Result:
- receipt + optional grading outcome

### teaching
Body:
- initial scenario/instruction markdown

Submission payload:
- conversation transcript/message list

Result:
- optional rubric/score and mentor/AI feedback

### prompt
Body:
- prompt-writing instruction markdown

Submission payload:
- `promptText: string`

Result:
- generated response + optional feedback

## Runtime Role Behavior
- Guest:
  - interactions visible when topic visible
  - submissions disabled
- Learner:
  - can submit attempts under enrollment context
- Observer mode:
  - interactions visible in observed-user context
  - all submission actions disabled (strict read-only)
- Mentor:
  - can review attempts and add mentor feedback where policy allows
- Editor:
  - in classroom view behaves per effective role/context
  - in editor preview, interaction rendering must not create attempts/events
- Root:
  - full administrative visibility; observer-mode rules still enforce read-only while active

## Submission And Grading Flow
1. Validate metadata + payload server-side.
2. Authorize submit action in current subject context.
3. Create immutable `InteractionAttempt`.
4. Execute grading/feedback path (`auto`, `manual`, `mixed`, `none`).
5. Persist result and emit canonical activity event.

Required records:
- `InteractionAttempt` (immutable)
- `ActivityEvent` (`interaction.submitted`)

## Feedback Model
- Feedback source is explicit:
  - `ai`
  - `system`
  - `mentor`
  - `none`
- Learner-facing feedback is policy-controlled by interaction/exam mode.
- Mentor feedback is additive and auditable.

## Exam Context Rules
- In exam mode, interactions follow `ExamSession` gating.
- Learner cannot resubmit once exam is submitted unless policy allows retake.
- Post-submit classroom exam view is read-only.

## Markdown Linking And Embeds
- Internal course links resolve by topic identity, not raw URL text.
- Relative media paths resolve against topic content root.
- Iframes require `https` and sandbox defaults.
- Unsafe protocols and scriptable URLs are blocked.

## Sanitization Policy
- Allow only approved tags/attributes/protocols.
- Strip or neutralize unsafe inline styles.
- Disallow script execution vectors (`javascript:`, event handlers, unsafe CSS patterns).
- Treat all course markdown as untrusted input at render boundary.

## Search Indexing Interaction Rules
- Interaction blocks are indexable by prompt text where appropriate.
- Do not index hidden correctness markers/answer keys for learner-visible search paths.
- Index pipeline must sanitize and normalize markdown text before storage.

## Error Handling
- Invalid interaction schema -> render non-breaking inline error card.
- Failed submission -> preserve user input, show actionable error, allow retry per policy.
- Partial AI failure -> fallback safe feedback path.

## Accessibility Requirements
- Keyboard-operable interaction controls and submit actions.
- Proper labels/fieldset legends for question groups.
- Clear status messaging for submitted/graded/read-only states.
- High-contrast focus and error states.

## Legacy Gaps Addressed
- Replaces ad-hoc parsing with explicit metadata schema and alias mapping.
- Eliminates ambiguous interaction type naming.
- Prevents interaction submissions in observer mode and editor preview.
- Standardizes immutable attempts + canonical event emission.
- Tightens markdown/HTML sanitization expectations.

