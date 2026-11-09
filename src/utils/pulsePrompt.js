import { MERMAID_PROMPT_GUIDELINES } from './mermaidPromptGuidelines.js';

export function buildPulsePrompt({ targetType, targetName, term, currentEvidence, previousPulse, pulseTrendHistory = [] }) {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const historyCohortPolicy = targetType === 'learner'
    ? 'Learner history points belong to this learner and may be compared when their metrics match.'
    : 'For course and section pulses, compare prior aggregate metrics only when they appear in PULSE TREND HISTORY; older pulses without a cohort marker included course staff and are not comparable.';
  const voicePolicy = targetType === 'learner'
    ? 'Write the body directly to the learner in the second person ("you", "your"), as a mentor speaking with them. Do not refer to the learner in the third person ("the learner", "the student", "they") or by name in the prose. Keep the tone warm, encouraging, and specific: celebrate genuine wins in a personable way and frame needs-attention items as supportive, actionable guidance rather than judgment. The "# ..." title line may still include the learner\'s name, but headings and body text are addressed to "you".'
    : 'Write for a course overseer (instructor or mentor) about the cohort in the third person, and identify learners by name so staff can act. Do not address individual learners in the second person.';
  return `Create a useful ${targetType} pulse in Markdown for ${targetName} during ${term?.title || 'the selected term'}.

${voicePolicy}

Follow this exact section order, omitting only sections that have no relevant evidence:
# ${term?.title || 'Term'} | ${targetName} Pulse
\n\n**Snapshot date:** ${snapshotDate}
## Overview
## Status indicators
## Change since the previous pulse
## Positive signals
## Needs attention
## Priorities
## Evidence notes

Use a compact Markdown table for indicators and concise bullet lists for signals and priorities. Include a Mermaid chart when comparable trend points are available. Use every comparable point in PULSE TREND HISTORY, in chronological order, plus the current evidence; do not make a two-point chart if older comparable snapshots are provided. Label every point with its actual snapshot date. If a prior pulse has the same snapshot date as the current pulse, use the current evidence for that date and do not plot it twice. If mastery (percent) and completed topics (count) are both charted, put them in separate charts with appropriate independent axes; never mix different units on one axis. ${MERMAID_PROMPT_GUIDELINES} Never invent facts, causes, grades, deadlines, attendance, or learner activity.

Use each evidence source for the right purpose:
- Treat Canvas overall and assignment grades as the primary graded checkpoints when present. Keep grades distinct from topic mastery and interaction completion.
- Use topic progress for completed interactions, topic mastery, exams, projects, and time spent. Time is neutral context, never evidence of effort, ability, or motivation.
- Use only \`sources.schedule.deadlines\` for course schedule dates, due dates, overdue work, and pacing. Do not treat a schedule end date as the final work deadline. In Canvas assignment evidence, \`canvasDueAt\` is gradebook metadata, not the authoritative course schedule date; when \`scheduleDate\` is present, use that date and never substitute the Canvas date. If \`scheduleCanvasDateConflict\` is true, identify the mismatch briefly and treat the schedule date as authoritative. Do not infer a deadline from an assignment name or a previous pulse.
- Schedule completion counts are a snapshot at generation time; do not claim that work was completed by its due date unless the evidence includes a submission timestamp that establishes that.
- Describe progress activity from its logged event types and timestamps. A page view is not proof that work was completed; distinguish one recent event from sustained activity.
- Treat essays as supplementary evidence. Use a learner's concept as a positive signal only when its evaluator feedback explicitly supports that concept. Do not repeat claims that the evaluator corrected or questioned.
- Use attendance counts only when the learner's section has attendance enabled. In roster evidence, report attendance counts and answer tallies grouped by section; do not compare raw counts across sections with different session totals. Treat “How are things going?” answers as self-reported snapshots, not as proof of motivation or an ongoing emotional state.
- For course and section roster evidence, use every available source under CURRENT EVIDENCE: Canvas overall-grade and term-assignment aggregates, term-filtered progress event types and examples, attendance session counts and response tallies, schedule deadlines with completion counts, and bounded essay excerpts with evaluator feedback. Explicitly distinguish sources that are unavailable, not linked, or have no term data; do not silently treat missing evidence as zero.
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
