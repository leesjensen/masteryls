# DRA Progress Tracking — Plan

## Goal

Make time-on-task and DRA outcomes show up in the learner and Mastery views the same
way other topics do, without extra queries at display time.

Requirements (from the request):

1. Context refreshed — recent changes (group chats, mobile UI, inline tutorial) don't
   affect progress reporting. Confirmed.
2. Track elapsed time consistently across **all** topics: flush on `visibilitychange`/
   `pagehide`, topic change, on each save, and roughly every minute.
3. Do **not** attribute time when the learner walked away (idle detection).
4. For DRA:
   1. Append rows to the Supabase `progress` table so history over time is visible —
      like other topics.
   2. Update `enrollment.progress` with a rolled-up summary so the learner MasteryView
      renders from the enrollment record alone (no extra queries).
   3. No new MasteryView columns. Reuse the drill-down "Interactions Completed" column,
      renamed **"Items Completed"**, to show the number of stages the learner contributed
      more than a few hundred characters to.
   4. Mastery = the DRA assessment score (already 0–100).

## Current state (findings)

- **Two stores.** DRA state (scenarios, transcripts, `stageNotes`, `evaluation`) is
  written by `courseOps.saveDraState()` to its own store on every autosave. It never
  touches `enrollment.progress`. Only two `addProgress('dra', 0, …)` rows are written —
  on generate and complete — both `duration: 0`. → no time, no current last-activity.
- **Time hook flushes only on unmount.** `instruction.jsx` wraps DRA with
  `useProgressTracking` emitting a `draView` event, but it records duration **only on
  effect cleanup**, and its `onProgress` (`addProgress`) identity is unstable so the
  effect resets frequently. Staying on the topic or closing the tab records little/nothing.
- **`draView` time is dropped at the topic level.** `_updateEnrollmentCachedInfo`
  (`useCourseOperations.jsx`) accrues per-topic `timeSpent` only for
  `instructionView`/`embeddedView`/`quizSubmit`; `draView` only bumps the global
  `totalTimeSpent` + `lastActivityAt`, not `progress[topicId].timeSpent`.
- **Score lives in the component.** The 0–100 overall score is computed inline in
  `DraEvaluation` (`src/components/instruction/dra/draEvaluation.jsx`):
  `process.score * (0.5 + 0.5 * (competency.score + disposition.score)/2/100)`, where
  each dimension score comes from `calculateDimensionScore(dimension, difficulty)`.
  Not exported → not reusable where we write progress.
- **Display already reads `enrollment.progress` directly.** The drill-down
  `learnerMasteryView.jsx` builds per-topic summaries from
  `selectedLearner.progress[topic.id]` (`completedInteractions/totalInteractions`,
  `avgPercent`, `timeSpent`, `lastInteractionAt`) — exactly the model we want (4.2).
- **Course mastery.** `_calculateEnrollmentProgress` averages per-topic percents;
  per-topic = `1` if any entry, or `interactionsCompleted/interactions` if the topic
  defines interactions.
- **Active run.** In `draInstruction.jsx`, `details` = the selected practice run or the
  final run: `practiceScenarios.find(selected) || finalScenario`. It carries `state`,
  `mode`, `difficulty`, `stages`, `stageNotes`, `evaluation`.

## Design

### F. Extract the score (shared pure function) — prerequisite
New `src/components/instruction/dra/draScore.js` exporting the pure calculation currently
inside `DraEvaluation`:
- `computeDraScore(evaluation, difficulty) -> { score /*0-100*/, level, process, competency, disposition, character }`
- `DraEvaluation` imports and uses it (no behavior change to the UI).
- Progress-writing code imports the same function → one source of truth.

### Decouple "summary" (cache) writes from "history" (row) writes
Two distinct destinations, written at different cadences:
- **`enrollment.progress` summary** — a single enrollment-row update (no new rows). Kept
  reasonably fresh so MasteryView is current. Cheap; updated on each save / flush.
- **`progress` table rows** — the audit/history trail. Kept **lean**: throttled so we
  don't accumulate too many records (see below). This applies to time rows for **all**
  topic types, not just DRA.

A shared helper `service.addProgress` (row) vs `_updateEnrollmentCachedInfo` (cache)
already exist as separate steps inside `addProgress`; we add a "cache-only" path and a
row-throttle so the two can be driven independently.

### A. Universal active-time tracking (reqs 2 & 3)
Enhance `useProgressTracking.jsx` (used by all topic types via `instruction.jsx`) so it
records incrementally instead of only on unmount:
- **Accrue** active time continuously; **flush** (update cache + maybe write a row) on
  `visibilitychange → hidden`, `pagehide`, topic change / unmount, and on a **periodic
  timer**. The periodic timer no longer needs to be frequent — a **row** is written at
  most every **15 min** per topic (see §throttle), so a long single-topic session yields
  ~1 row / 15 min plus a final row on leave.
- **Idle detection:** accrue only while the learner is active. Reset an idle timer on
  `keydown`/`pointerdown`/`mousemove`/`scroll`; if no input for **90s**, pause accrual
  until the next input, so time isn't attributed to a topic left open.
- **Stabilize `onProgress`** (wrap `addProgress` in `useCallback`/ref) so the effect
  doesn't reset every render and drop the accumulator.
- Expose `flush()` so DRA can push accrued time on save/leave.

Each flush rolls duration into `totalTimeSpent` + `lastActivityAt`; add `draView`
(generalize `*View`) to the **per-topic** `timeSpent` branch in
`_updateEnrollmentCachedInfo` so DRA time accrues on the topic.

### Row throttle (all topics) — 15 minutes
Time-view rows (`instructionView`/`embeddedView`/`draView`/…) and DRA snapshot (`dra`)
rows are written at most once per **15 min per topic**, plus a final flush on leave.
Discrete, meaningful events are **never** throttled and always write a row:
`quizSubmit`, `exam` start/submit, and DRA **generate**/**complete**. Implemented as a
per-(topic,type) "last row written at" guard in `courseOps`; the enrollment-cache update
is **not** throttled, so accrued time/last-activity/summary stay current between rows.

### B. DRA progress history rows (req 4.1)
- **Summary (cache):** on each DRA save, update `enrollment.progress[topicId]` (score,
  items, state, time, lastActivity) — no new row.
- **History (rows):** append a `dra` snapshot row on **generate**/**complete** (always)
  and otherwise at most once per **15 min**, carrying
  `{ state, mode, scenarioRunId, score, itemsCompleted, totalItems }`.
- Time history is the throttled `draView` rows from §A. Together this mirrors other topics
  (`instructionView` for time + `quizSubmit` for outcomes).

### C. `enrollment.progress` DRA summary (req 4.2)
On DRA save/complete, update `enrollment.progress[topicId]` via a small addition to
`_updateEnrollmentCachedInfo` (new `dra` handling that runs on any `dra` progress, not
only completion):
```
enrollment.progress[topicId] = {
  ...existing,
  draState: 'inProgress' | 'completed',
  mode: 'practice' | 'final',
  itemsCompleted,          // stages with > threshold chars (see E)
  totalItems,              // number of stages in the run
  masteryScore,            // 0-100 (see D); null until first evaluation
  timeSpent,               // accrued via §A
  lastInteractionAt,
}
```
Root `totalTimeSpent` and `lastActivityAt` continue to update as today.

### D. Mastery = DRA score (req 4.4)
- Store `masteryScore` (0–100) per DRA topic (§C).
- In `_calculateEnrollmentProgress`, when `progress[topic.id].masteryScore` is a number,
  use `masteryScore/100` as that topic's percent (else current binary/interaction logic).
  DRA thus contributes its assessment score to the course mastery average; a single-DRA
  course's Mastery == the DRA score.
- **Which run's score:** proposed — use the **final** run's score once a final exists;
  otherwise the most recently evaluated run's score (so practice progress is reflected).

### E. "Items Completed" reuse/rename (req 4.3)
- In `learnerMasteryView.jsx`, rename the drill-down column label
  `"Interactions Completed"` → `"Items Completed"` (and sort key aria-label).
- Per-topic summary: for `topic.type === 'dra'`, source `completedInteractions`/
  `totalInteractions` from the stored `itemsCompleted`/`totalItems` instead of the
  interaction arrays. `avgPercent` for a DRA row uses `masteryScore`.
- **Items definition:** count a stage as "contributed to" when
  `stageNotes[stage].length > ITEM_CHAR_THRESHOLD` (proposed 300). `totalItems` = number
  of stages in the run.

## Files to change

- `src/components/instruction/dra/draScore.js` — **new** pure score module (§F).
- `src/components/instruction/dra/draEvaluation.jsx` — use `computeDraScore`.
- `src/components/instruction/dra/draInstruction.jsx` — on save/complete: compute
  `{ score, itemsCompleted, totalItems }`, call the new progress-summary op, append the
  throttled `dra` history row, and `flush()` the time tracker.
- `src/hooks/useProgressTracking.jsx` — periodic/visibility/pagehide flush + idle (§A).
- `src/components/instruction/instruction.jsx` — stabilize `onProgress`; pass through.
- `src/hooks/useCourseOperations.jsx` — `_updateEnrollmentCachedInfo` (`draView` per-topic
  time + `dra` summary), `_calculateEnrollmentProgress` (`masteryScore`), and a helper
  like `updateDraProgress({ score, itemsCompleted, totalItems, state, mode, duration })`.
- `src/views/masteryView/learnerMasteryView.jsx` — rename label + DRA summary sourcing.
- Constants: `ITEM_CHAR_THRESHOLD`, `IDLE_LIMIT_MS`, `TIME_FLUSH_INTERVAL_MS`.

No new MasteryView columns; the `masteryoverview` edge function is unchanged (it already
derives `masteryPercent`, `totalTimeSpent`, `lastActivityAt` from `enrollment.progress`).

## Decisions (resolved)

1. **Which run is "the grade"** (§D/E): the **final** run when present, else the
   latest-evaluated run.
2. **Idle limit** 90s no input → pause accrual.
3. **Row throttle = 15 min per topic**, for **all** topic types (time-view rows and DRA
   snapshot rows). Discrete events (`quizSubmit`, `exam`, DRA generate/complete) always
   write a row. The `enrollment.progress` summary is updated more often (not throttled),
   so MasteryView stays current between rows.
4. **Items threshold:** stage counts once `stageNotes[stage].length > 300`. Stage notes
   only (authored chat not counted).
5. **"Completed Topics" semantics:** left as-is — a DRA with activity counts as a touched
   topic, consistent with instruction topics counting on first view.
6. **Close-time reliability:** periodic + `visibilitychange(hidden)`/`pagehide` flush (no
   `sendBeacon`); a hard tab-kill may lose the final <60s. Accepted.
7. **Blast radius:** §A changes shared time tracking for every topic type (intended). Run
   the full test suite once the feature works.

## Implementation notes (as built)

- **Score** extracted to `src/components/instruction/dra/draScore.js`
  (`computeDraScore`, `summarizeDraRun`, `countDraItemsCompleted`,
  `DRA_ITEM_CHAR_THRESHOLD = 300`); `DraEvaluation` now imports it (no UI change).
- **Time hook** (`useProgressTracking`) rewritten: idle-aware accrual (90s), periodic
  flush (60s), flush on `visibilitychange(hidden)`/`pagehide`/unmount, stable
  `onProgress` via ref. Applies to all topics through `instruction.jsx` (unchanged).
- **Row throttle** lives in `courseOps.addProgress` (`options.throttleRowMs`, auto 15 min
  for `*View` types); the enrollment-cache update is never throttled.
- **DRA**: `syncDraProgress` runs on every save (`autoSaveState`/`handleSave`), forced on
  generate/complete; grade run = final-then-latest. `updateDraProgress` in courseOps
  merges the summary into `enrollment.progress[topicId]` and appends a throttled `dra` row.
- **Time-flush-on-save was intentionally not wired.** `lastActivityAt` already updates on
  every save via the summary path (`updateDraProgress` → `_updateEnrollmentCachedInfo`),
  and topic time comes from the `draView` periodic/visibility flushes — so the "last used
  date" is current without threading the tracker's `flush()` into the DRA component.
- `test:unit` glob broadened to `src/**/*.test.js` to include the new dra test.

## Verification

- Unit: `draScore` (score for known evaluations), items counter (threshold), idle/flush
  logic where feasible.
- E2E: DRA run records a `draView` duration + `dra` summary; `enrollment.progress[topic]`
  gains `itemsCompleted/totalItems/masteryScore/timeSpent`; drill-down shows "Items
  Completed" and the score; Mastery reflects the DRA score. Existing `editing.spec` still
  green (shared time-tracking change).
