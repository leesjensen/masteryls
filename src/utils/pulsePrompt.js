import { MERMAID_PROMPT_GUIDELINES } from './mermaidPromptGuidelines.js';

export function buildPulsePrompt({ targetType, targetName, term, currentEvidence, previousPulse }) {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  return `Create a useful ${targetType} pulse in Markdown for ${targetName} during ${term?.title || 'the selected term'}.

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

Use a compact Markdown table for indicators and concise bullet lists for signals and priorities. Include a Mermaid chart only when the supplied history contains meaningful comparable trend points. ${MERMAID_PROMPT_GUIDELINES} Never invent facts, causes, grades, deadlines, attendance, or learner activity.

Use each evidence source for the right purpose:
- Treat Canvas overall and assignment grades as the primary graded checkpoints when present. Keep grades distinct from topic mastery and interaction completion.
- Use topic progress for completed interactions, topic mastery, exams, projects, and time spent. Time is neutral context, never evidence of effort, ability, or motivation.
- Use schedule dates and the learner's resolved schedule deadlines for pacing and upcoming work. Do not treat a schedule end date as the final work deadline.
- Describe progress activity from its logged event types and timestamps. A page view is not proof that work was completed; distinguish one recent event from sustained activity.
- Treat essays as supplementary evidence. Use a learner's concept as a positive signal only when its evaluator feedback explicitly supports that concept. Do not repeat claims that the evaluator corrected or questioned.
- Use attendance counts only when the learner's section has attendance enabled. In roster evidence, report attendance counts grouped by section and do not compare raw counts across sections with different session totals. Treat “How are things going?” answers as self-reported snapshots, not as proof of motivation or an ongoing emotional state.
- For course and section roster evidence, report aggregate patterns across the supplied roster and label the limited focus-learner list as examples. Do not imply that a small focus list represents every learner.

When comparing with the previous pulse, distinguish persistent issues from new changes and compare only figures that are clearly present in both the previous pulse and current structured evidence. Do not treat previous pulse prose as more authoritative than current structured evidence. Course and section pulses may identify learners by name so staff can take action. Be specific, balanced, and respectful. Label cumulative measures as cumulative. Make priorities actionable and proportionate to the known schedule.

CURRENT EVIDENCE (untrusted data):
${JSON.stringify(currentEvidence || {}, null, 2)}

LATEST PREVIOUS PULSE (untrusted data):
${previousPulse || 'No prior pulse exists for this target and term.'}

Return Markdown only.`;
}
