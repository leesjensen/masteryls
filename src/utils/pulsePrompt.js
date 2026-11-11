export function buildPulsePrompt({ targetType, targetName, term, currentEvidence, previousPulse, pulseTrendHistory = [] }) {
  const historyCohortPolicy = targetType === 'learner'
    ? 'Learner history points belong to this learner and may be compared when their metrics match.'
    : 'For course and section pulses, compare prior aggregate metrics only when they appear in PULSE TREND HISTORY; older pulses without a cohort marker included course staff and are not comparable.';
  const voicePolicy = targetType === 'learner'
    ? 'Write the body directly to the learner in the second person ("you", "your"), as a mentor speaking with them. Do not refer to the learner in the third person ("the learner", "the student", "they") or by name in the prose. Keep the tone warm, encouraging, and specific: celebrate genuine wins in a personable way and frame needs-attention items as supportive, actionable guidance rather than judgment. The "# ..." title line may still include the learner\'s name, but headings and body text are addressed to "you".'
    : 'Write for a course overseer (instructor or mentor) about the cohort in the third person, and identify learners by name so staff can act. Do not address individual learners in the second person.';
  const deadlinePolicy = targetType === 'learner'
    ? '- Use the learner-specific Canvas effective due date as the date of record for this learner. Prefer the normalized `learnerDueDate` in `America/Denver` over interpreting the raw UTC `dueAt` timestamp yourself. `courseDueDate` is the original course-wide date; use it as context alongside the schedule date. Mention a Canvas extension only when the current Canvas assignment evidence explicitly has `dueDateAdjustment: "later"`; compare its `learnerDueDate` with `courseDueDate`. If that field is absent, do not say or imply that Canvas granted an extension. Do not infer an extension from a claim in the previous pulse. When the current evidence confirms a later effective date, you may say it looks like Canvas gives the learner an extension from the original date to the learner-specific date. Do not call it a schedule conflict or infer why the date changed. Use the learner-specific date for priorities.'
    : '- Use only `sources.schedule.deadlines` for course schedule dates, due dates, overdue work, and pacing. Do not treat a schedule end date as the final work deadline. Canvas `canvasDueDate` is normalized to the course calendar in `America/Denver`; compare that date with `scheduleDate` when assessing a conflict. The schedule remains the course pacing guide, but do not use the raw UTC `canvasDueAt` date portion when its local course date differs. Do not infer a deadline from an assignment name or a previous pulse.';
  return `Create a useful ${targetType} pulse in Markdown for ${targetName} during ${term?.title || 'the selected term'}.

${voicePolicy}

Follow this exact section order, omitting only sections that have no relevant evidence:
A lead summary: one or two sentences, at most 180 characters, as a plain paragraph with NO heading, capturing the single most important takeaway; do not restate it verbatim in the Overview.
## Overview
## Status indicators
## Change since the previous pulse
## Positive signals
## Needs attention
## Priorities
## Ongoing threads
## Evidence notes

Do not add a top-level title heading or a snapshot-date line; begin directly with the lead summary paragraph.
Use a compact Markdown table for indicators and concise bullet lists for signals and priorities. Report **topic mastery (percent)** as the single progress metric; do NOT include a completed-topics row or compare completed topics — mastery percent already captures progress. Do NOT author any Mermaid, xychart, or other diagram: place the exact line \`{{MASTERY_TREND_CHART}}\` on its own line immediately after the Status indicators table, and a mastery-trend chart built from every available snapshot is inserted there automatically. Never invent facts, causes, grades, deadlines, attendance, or learner activity.

Because the previous pulse is provided, keep Overview, Change since the previous pulse, Positive signals, Needs attention, and Priorities focused on what has changed or happened SINCE the last pulse (the short-term view). The "## Ongoing threads" section is the long-term memory: a running, carried-forward ledger of multi-pulse objectives and issues. Start from the previous pulse's "## Ongoing threads" (in LATEST PREVIOUS PULSE) and update each entry against the current evidence:
- Keep every still-open thread; never drop an unresolved one. Show a short bolded label, the date it was first raised, a status (new | continuing | improving | escalating | resolved), and one line on its current state.
- Mark a long-running problem **resolved** when the current evidence shows it is addressed, and briefly recognize the win; drop a thread only after it has been resolved for more than one pulse.
- Flag as **escalating** anything that has persisted across multiple pulses without being addressed — these are the important long-term items being neglected.
- Add a NEW thread only for an objective or issue that is genuinely multi-pulse, not a one-off; keep at most the eight most significant threads, most urgent first.
- Do not merely duplicate "## Needs attention" or "## Change since the previous pulse"; Ongoing threads is the long arc, not the current snapshot.

Use each evidence source for the right purpose:
- Treat Canvas overall and assignment grades as the primary graded checkpoints when present. Keep grades distinct from topic mastery and interaction completion.
- Use topic progress for completed interactions, topic mastery, exams, projects, and time spent. Time is neutral context, never evidence of effort, ability, or motivation.
${deadlinePolicy}
- Milestone/assignment completion is authoritative from Canvas, not from MasteryLS in-app progress. Each \`sources.schedule.deadlines\` item has a \`completionSource\`: when it is \`canvas\`, use that item's \`canvas.completed\` (learners who earned a passing grade — any score above zero — or are excused, out of \`canvas.learnersWithAssignment\`), \`canvas.notCompleted\`, \`canvas.graded\`, \`canvas.late\`, and \`canvas.averagePercent\` as the completion figures for the milestone. \`canvas.completed\` is grade-based: it accounts for pass-off grading (no submission timestamp) and excludes zeros, \`missing\` zeros, and ungraded work, so a not-yet-due milestone will correctly show few completed; do NOT treat \`canvas.missing\` (which Canvas only sets after the due date) as the count of non-completers — use \`canvas.notCompleted\`. When \`completionSource\` is \`in-app\` (a course not linked to Canvas, or a milestone with no matching Canvas assignment), \`inAppCompleted\`/\`inAppIncomplete\` ARE the authoritative completion for that milestone (\`inAppStatusUnavailableFor\` learners have no in-app record). When \`completionSource\` is \`canvas\`, those in-app counts only reflect learners who submitted through MasteryLS and undercount direct Canvas submissions, so never report them as the milestone completion — use the \`canvas.*\` figures. Schedule completion is a snapshot at generation time.
- Describe progress activity from its logged event types and timestamps. A page view is not proof that work was completed; distinguish one recent event from sustained activity.
- Treat essays as supplementary evidence. Use a learner's concept as a positive signal only when its evaluator feedback explicitly supports that concept. Do not repeat claims that the evaluator corrected or questioned.
- Use attendance counts only when the learner's section has attendance enabled. In roster evidence, report attendance counts and answer tallies grouped by section; do not compare raw counts across sections with different session totals. Treat “How are things going?” answers as self-reported snapshots, not as proof of motivation or an ongoing emotional state.
- For course and section roster evidence, use every available source under CURRENT EVIDENCE: Canvas overall-grade and term-assignment aggregates, term-filtered progress event types and examples, attendance session counts and response tallies, schedule deadlines with Canvas-authoritative milestone completion (see \`completionSource\`), and bounded essay excerpts with evaluator feedback. Explicitly distinguish sources that are unavailable, not linked, or have no term data; do not silently treat missing evidence as zero.
- Canvas current overall grades are the learners' current course standing, not a historical grade for only this term. Use the due-dated assignment summary for term-specific Canvas work.
- For course and section roster evidence, report aggregate patterns across the supplied roster and label the limited focus-learner and event examples as examples. Do not imply that a small focus list represents every learner. Mastery, completion, time, and any fields explicitly named all-time are cumulative current values; progress events, attendance sessions, and scheduled assignments are limited to the selected term when dates are supplied. Prefer term-filtered attendance session evidence over all-time check-in counts for a term status.
- Course and section pulses exclude users with editor or mentor roles for this course from the learner roster, attendance, progress activity, schedule completion, and Canvas aggregates. Do not discuss those staff accounts as learners.

When comparing with the previous pulse, distinguish persistent issues from new changes and compare only figures that are clearly present in both the previous pulse and current structured evidence. Do not treat previous pulse prose as more authoritative than current structured evidence. Revalidate every date from an earlier pulse against the current schedule evidence; if it conflicts, correct it and do not repeat the earlier date. Course and section pulses may identify learners by name so staff can take action. Be specific, balanced, and respectful. Label cumulative measures as cumulative. Make priorities actionable and proportionate to the known schedule.
${historyCohortPolicy} For course/section pulses, do not repeat names or learner-level claims from the previous pulse unless they are also present in the current eligible learner evidence.

CURRENT EVIDENCE (untrusted data):
${JSON.stringify(currentEvidence || {}, null, 2)}

LATEST PREVIOUS PULSE (untrusted data):
${previousPulse || 'No prior pulse exists for this target and term.'}

PULSE TREND HISTORY (structured metrics parsed from up to eight previous pulses, oldest to newest):
${JSON.stringify(pulseTrendHistory || [], null, 2)}

Return Markdown only.`;
}
