# DRA Implementation State (resume context)

Working notes for the **Disciplinary Reasoning Assessment (DRA)** feature — a new
instruction `type: 'dra'` parallel to instruction/exam/project/embedded. Spec lives in
`design/disciplinaryReasoningAssessment.md` (kept in sync; look for `> Implementation
status:` callouts that mark what is actually built vs. designed).

Last updated after the **coaching agent** slice. Working tree clean; all phases below are committed.

## Status by phase

- [x] **P1 Skeleton** — `dra` type registered end-to-end (model, form, icon, dispatch, storage).
- [x] **P2 Authoring** — instructor publishes parameters only (no scenario authored).
- [x] **P3 Learner runtime** — runtime scenario generation + lifecycle + save/resume.
- [x] **P3.1 Difficulty disclosure** — difficulty gates how much is revealed up front.
- [x] **P3.2 Constraints** — third scenario category alongside stakeholders/resources.
- [x] **P3.3 Mode checkboxes** — practice/final are independent booleans (≥1 required).
- [x] **P4 Investigation** — stage selector, stakeholder/resource chat, reasoning record.
- [x] **P5 Evaluation** — observation agent + radar chart + drill-down tables.
- [x] **P5.1 Coaching** — practice-only on-demand coach (feedback/hints/suggestions).
- [ ] **P6 Portfolio + PDF export** — NOT STARTED (next major phase).

### Deferred refinements (not yet built)
- Continuous auto-evaluation after each interaction (currently on-demand / at completion).
- Instability events (the `instability` param is stored but does nothing yet).

### Target discovery (implemented)
Every generated scenario reveals at least one **primary stakeholder** (`details.identified[0]`,
seeded in `generateScenario`). Additional withheld stakeholders/resources are **auto-surfaced**
when named in an interview reply — see `detectNewTargets` in `draInstruction.jsx` (exact
name match against the generated cast, appended to `details.identified`). There is no manual
"identify by name" affordance (an earlier attempt was reverted).
- Canvas gradebook sync for `dra` (falls through to the default Canvas "page" target).

## Key concepts

**Authoring vs runtime split.** The author publishes only *parameters*; the scenario,
stakeholders, resources, constraints, and stage interpretations are generated **per
learner at runtime** and live in the learner's progress record — NOT in the topic file.

**Backing file** = single markdown at `instruction/<slug>/<slug>.md` (same storage as
instruction topics, via `courseOps.getTopic`/`updateTopic`). Source of truth is a JSON
object in a fenced ```json block under a `## Assessment Definition` heading; a readable
body is regenerated each serialize. See `src/utils/draMarkdown.js`.

Authoring params (model): `title, discipline, problemType, difficulty (1-5),
practiceMode (bool), finalMode (bool), instability (bool), learningOutcomes`.
`normalizeModel` migrates the legacy single `mode: 'practice'|'final'` to the booleans
and enforces ≥1 mode enabled.

**Runtime state** lives in the progress record (`type: 'dra'`), mirroring exams.
`courseOps.getDraState()` returns the latest row's `details`; `courseOps.addProgress(null,
null, 'dra', 0, details)` writes a new row. `details` shape:
`{ state: 'notStarted'|'inProgress'|'completed', mode: 'practice'|'final' (active run),
difficulty, scenario: {title,summary,description}, constraints[], stakeholders[],
resources[], stages: [{stage,interpretation}], activeStage, conversations: { '<type>:<idx>':
[{role,text,stage}] }, reasoningRecord: {understanding,assumptions,unknowns,hypotheses,
decisions,evidence,confidence}, evaluation, coaching, completedAt }`.

**Lifecycle:** notStarted → (practice: Generate / Cancel / Start-new-after-complete |
final: confirm → generate-once → locked) → inProgress → completed. Both modes can be
enabled; the learner may enter final from the start, while practicing, or after a
completed practice run. A completed *final* run is terminal.

**Difficulty disclosure** — `scenarioDisclosure(difficulty)` (exported from
`draInstruction.jsx`): detail full≤3 else summary; showConstraints≤3; showStakeholders≤2;
showResources≤1. Withheld items are still generated and saved.

**Persistence pattern:** `setLocalDetails()` updates UI without a server write (in-flight
typing); `persist()` writes to the progress record on meaningful events (scenario
generated, each chat exchange, reasoning-field blur, stage change, evaluate, coach,
complete).

## File map

- `src/model.ts` — `'dra'` in the `Topic.type` union.
- `src/components/TopicForm.jsx` — "Disciplinary Reasoning" option.
- `src/utils/Icons.jsx` — `Telescope` icon for `dra`.
- `src/utils/draMarkdown.js` — parse/serialize/createInitial/createEmpty + normalize/migrate.
- `src/utils/draMarkdown.test.js` — 6 unit tests (round-trip, migration, clamping).
- `src/hooks/useCourseOperations.jsx` — `getDraState`, `generateDraScenario`,
  `getDraStakeholderResponse`, `getDraEvaluation`, `getDraCoaching`; `generateTopicContent`
  case `'dra'` → `createInitialDraMarkdown`. (`_generateTopicPath` does NOT special-case
  dra — stored under `instruction/`.)
- `src/components/editor/editor.jsx` — `case 'dra'` → `DraEditor`.
- `src/components/editor/dra/draEditor.jsx` — single full-width param form (no preview pane).
- `src/components/instruction/instruction.jsx` — `case 'dra'` → `DraInstruction`.
- `src/components/instruction/dra/draInstruction.jsx` — runtime orchestrator (state machine,
  persistence, `scenarioDisclosure`, ScenarioView, handlers for generate/cancel/complete/
  send/reasoning/stage/evaluate/coach).
- `src/components/instruction/dra/draInvestigation.jsx` — stage pills + interpretation,
  target list, per-target chat, reasoning record (textareas have `aria-label`s).
- `src/components/instruction/dra/draEvaluation.jsx` — Chart.js `Radar` (registers
  `RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend`) + per-dimension
  attribute tables with drill-down. Exports `confidenceToScore`.
- `src/components/instruction/dra/draCoach.jsx` — coaching panel (practice only).
- `src/ai/aiContentGenerator.js` — agents (below).
- `tests/dra.spec.ts` — 11 e2e tests.

## AI agents (all in `src/ai/aiContentGenerator.js`)

All go through Gemini (`service.makeGeminiApiRequest`). Use `makeSimpleAiRequest(prompt)`
for one-shot JSON (no `system_instruction`) and `makeAiRequest(instructions, contents)`
for the chat agent (has `system_instruction`). `parseJsonResponse` tolerates fenced/extra text.

- `aiDraScenarioGenerator(params)` → `{scenario:{title,summary,description}, stakeholders[],
  resources[], constraints[], stages[]}`.
- `aiDraStakeholderResponseGenerator(scenario, target, messages)` → in-character text;
  uses `system_instruction`.
- `aiDraEvaluationGenerator(scenario, transcripts, reasoningRecord)` → Process/Competency/
  Disposition evaluation. Prompt contains the phrase **"observation and assessment agent"**.
- `aiDraCoachGenerator(scenario, transcripts, reasoningRecord, activeStage)` →
  `{feedback,hints[],suggestions[]}`. Prompt contains the phrase **"encouraging coach"**.

Confidence levels: Beginning, Emerging, Developing, Proficient, Exemplary (→ 1..5).

## Tests

- Unit: `node --test --test-reporter=spec src/utils/draMarkdown.test.js`
- E2E: `npx playwright test tests/dra.spec.ts --reporter=line`
- Build check: `npx vite build`

**Gemini mock branching** in `tests/dra.spec.ts` `installScenarioGemini()` (order matters):
1. `body.system_instruction` present → stakeholder chat reply.
2. prompt matches `/observation and assessment agent/i` → evaluation JSON.
3. prompt matches `/encouraging coach/i` → coaching JSON.
4. else → scenario JSON.

If you add another `makeSimpleAiRequest` agent, give its prompt a unique phrase and add a
mock branch BEFORE the scenario fallback. The progress REST route is mocked by
`testInit.ts` (handles the `dra` type automatically). `installDraRoutes` mocks the raw GET
+ contents GET/PUT for `instruction/reasoning-lab/...`. Seed markdown via the `draMarkdown()`
helper; override params like `draMarkdown({ practiceMode:true, finalMode:false, difficulty:1 })`.

Gotcha: stakeholders/resources appear both in the scenario list AND as investigation target
buttons — assert on text unique to one (e.g. objectives text, or scope by heading) to avoid
strict-mode locator violations.

## Next step when resuming

Phase 6 — **Portfolio + PDF export**: cumulative summary across completed scenarios
(table of Scenario / Confidence / Summary) and per-scenario PDF export. See the
"# Portfolio" section of `design/disciplinaryReasoningAssessment.md`. Completed runs are
stored as `dra` progress rows (one per completion) and already carry `scenario`,
`evaluation`, `completedAt` — the portfolio reads across them.
