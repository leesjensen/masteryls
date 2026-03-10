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

## Type-Specific Contracts And Examples

### multiple_choice
Body contract:
- prompt markdown
- checkbox-style answer list

````markdown
```masteryls
{"id":"11111111-1111-1111-1111-111111111111","type":"multiple_choice","title":"HTTP Method"}
Which HTTP method is typically used to fetch data?

- [x] GET
- [ ] POST
- [ ] DELETE
- [ ] PATCH
```
````

Submission payload:
```json
{ "selectedIndices": [0] }
```

Result contract:
- `percentCorrect`
- `feedback` (AI/system/mentor)

### multiple_select
Body contract:
- prompt markdown
- checkbox-style answer list

````markdown
```masteryls
{"id":"22222222-2222-2222-2222-222222222222","type":"multiple_select","title":"Select Stateless Traits"}
Which are properties of a stateless service?

- [x] No per-client server session required
- [x] Horizontal scaling is simpler
- [ ] Client must always use sticky sessions
- [ ] State is only stored in process memory
```
````

Submission payload:
```json
{ "selectedIndices": [0, 1] }
```

Result contract:
- `percentCorrect`
- `feedback` (AI/system/mentor)

### survey
Body contract:
- prompt markdown
- single-select or multi-select options

````markdown
```masteryls
{"id":"33333333-3333-3333-3333-333333333333","type":"survey","title":"Preferred Learning Format","multipleSelect":false}
What format helps you most?

- [ ] Video
- [ ] Text
- [ ] Interactive labs
- [ ] Group discussion
```
````

Submission payload:
```json
{ "selectedIndices": [2] }
```

Result contract:
- no correctness score required
- optional aggregate visibility by policy

### essay
Body contract:
- prompt markdown

````markdown
```masteryls
{"id":"44444444-4444-4444-4444-444444444444","type":"essay","title":"Explain CAP Tradeoffs"}
In 150-250 words, explain a practical CAP theorem tradeoff.
```
````

Submission payload:
```json
{ "text": "In practice, teams usually choose availability..." }
```

Result contract:
- `percentCorrect` optional
- `feedback` optional

### file_submission
Body contract:
- instruction markdown

````markdown
```masteryls
{"id":"55555555-5555-5555-5555-555555555555","type":"file_submission","title":"Upload Design Artifact"}
Upload your architecture diagram and short design notes.
```
````

Submission payload:
```json
{
  "files": [
    { "name": "architecture.png", "size": 83921, "mimeType": "image/png", "storageRef": "uploads/abc123" }
  ]
}
```

Result contract:
- submission receipt
- optional grading outcome

### url_submission
Body contract:
- instruction markdown

````markdown
```masteryls
{"id":"66666666-6666-6666-6666-666666666666","type":"url_submission","title":"Submit Demo URL"}
Provide the HTTPS URL to your deployed project.
```
````

Submission payload:
```json
{ "url": "https://example.app/demo" }
```

Result contract:
- submission receipt
- optional grading outcome

### teaching
Body contract:
- scenario/instruction markdown

````markdown
```masteryls
{"id":"77777777-7777-7777-7777-777777777777","type":"teaching","title":"Coach The Learner"}
Ask the learner guiding questions until they can explain the concept clearly.
```
````

Submission payload:
```json
{
  "messages": [
    { "role": "model", "content": "What does eventual consistency mean?" },
    { "role": "user", "content": "It means replicas can diverge briefly." }
  ]
}
```

Result contract:
- optional rubric/score
- mentor/AI feedback

### prompt
Body contract:
- prompt-writing instruction markdown

````markdown
```masteryls
{"id":"88888888-8888-8888-8888-888888888888","type":"prompt","title":"Write A Better Prompt"}
Write a concise prompt that asks an AI to generate a unit test plan.
```
````

Submission payload:
```json
{ "promptText": "Generate a Jest unit test plan for..." }
```

Result contract:
- generated response
- optional feedback

### Legacy Alias Example
Input accepted for compatibility:
````markdown
```masteryls
{"id":"99999999-9999-9999-9999-999999999999","type":"multiple-choice","title":"Legacy Type Name"}
Legacy aliases are accepted at parse time, then normalized.

- [x] True
- [ ] False
```
````

Normalized runtime type:
```json
{ "type": "multiple_choice" }
```

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
