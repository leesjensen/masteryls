/**
 * Resolve the term a learner pulse view is locked to, derived from the learner's enrollment section.
 * Learner pulses are scoped to the learner's enrollment term (not a free choice), so the view uses
 * this instead of a term chooser. Returns the term id, or '' when the learner has no section or the
 * section has no term (the view then shows nothing).
 */
export function resolveLearnerPulseTermId(learnerRow, sections = []) {
  const sectionId = learnerRow?.sectionId;
  if (!sectionId) return '';
  const section = (sections || []).find((s) => String(s.id) === String(sectionId));
  return section?.termId || '';
}
