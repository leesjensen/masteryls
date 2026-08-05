// Pure scoring for an interview run. Mirrors draScore.js so the same 0-100 score can be
// computed where progress/mastery is recorded (no React) as is shown in InterviewEvaluation.

import { calculateAttributeScore, calculateDimensionScore, scoreToRatingLevel } from '../dra/draScore';

/**
 * Computes the overall 0-100 assessment score from an interview evaluation.
 * Sessions are the primary driver; Character (Competency + Disposition) scales how much of
 * the session score counts.
 *
 * @returns {null | { rawScore: number, score: number, level: string, sessions, competency, disposition, characterScore: number, processMultiplier: number }}
 */
export function computeInterviewScore(evaluation, difficulty = 3) {
  if (!evaluation) return null;

  const rawSessions = evaluation.sessions || [];
  const sessionAttrs = rawSessions.map((s) => ({
    name: s.title || s.sessionId || 'Session',
    summary: s.summary || '',
    rating: s.rating || 'Beginning',
    evidence: s.evidence || [],
    calculation: calculateAttributeScore(s, 'Beginning', difficulty),
  }));

  const sessionScore = sessionAttrs.length > 0 ? sessionAttrs.reduce((sum, s) => sum + s.calculation.supportedScore, 0) / sessionAttrs.length : 0;

  const sessionEvidence = sessionAttrs.reduce(
    (acc, s) => {
      const st = s.calculation.evidenceStats;
      return { count: acc.count + st.count, positiveSupport: acc.positiveSupport + st.positiveSupport, negativeSupport: acc.negativeSupport + st.negativeSupport };
    },
    { count: 0, positiveSupport: 0, negativeSupport: 0 },
  );
  sessionEvidence.netSupport = Math.max(0, sessionEvidence.positiveSupport - sessionEvidence.negativeSupport);

  const sessions = {
    score: sessionScore,
    displayedLevel: scoreToRatingLevel(sessionScore),
    summary: `${rawSessions.length} interview session${rawSessions.length !== 1 ? 's' : ''} evaluated`,
    attributes: sessionAttrs,
    evidenceStats: sessionEvidence,
  };

  const competency = calculateDimensionScore(evaluation.competency, difficulty);
  const disposition = calculateDimensionScore(evaluation.disposition, difficulty);
  const characterScore = (competency.score + disposition.score) / 2;
  const processMultiplier = 0.5 + 0.5 * (characterScore / 100);
  const rawScore = sessionScore * processMultiplier;

  return { rawScore, score: Math.round(rawScore), level: scoreToRatingLevel(rawScore), sessions, competency, disposition, characterScore, processMultiplier };
}

/**
 * Rolls a single interview run's details into the compact summary stored in
 * enrollment.progress[topicId] and used by the learner MasteryView.
 */
export function summarizeInterviewRun(run, difficulty) {
  const sessions = Array.isArray(run?.sessions) ? run.sessions : [];
  const totalSessions = sessions.length;
  const sessionsCompleted = sessions.filter((s) => s?.state === 'completed').length;
  const scored = run?.evaluation ? computeInterviewScore(run.evaluation, difficulty ?? run?.difficulty) : null;

  return {
    score: scored ? scored.score : null,
    level: scored ? scored.level : null,
    sessionsCompleted,
    totalSessions,
  };
}

/**
 * Builds a compact markdown summary of an interview evaluation, suitable for posting as
 * Canvas submission feedback (see courseOps.addProgress's interview Canvas-sync branch).
 */
export function formatInterviewFeedbackForCanvas(evaluation, difficulty = 3) {
  if (!evaluation) return '';
  const scored = computeInterviewScore(evaluation, difficulty);
  const lines = [];
  if (scored) lines.push(`**Overall: ${scored.score}/100 (${scored.level})**`);
  if (scored?.sessions?.summary) lines.push(`\n**Sessions:** ${scored.sessions.summary}`);
  if (scored?.competency?.summary) lines.push(`\n**Competency:** ${scored.competency.summary}`);
  if (scored?.disposition?.summary) lines.push(`\n**Disposition:** ${scored.disposition.summary}`);

  const concerns = Array.isArray(evaluation.concerns) ? evaluation.concerns : [];
  if (concerns.length > 0) {
    lines.push('\n**Concerns:**');
    concerns.forEach((c) => lines.push(`- ${c.name} (${c.severity}): ${c.description}`));
  }

  return lines.join('\n');
}
