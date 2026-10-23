// Pure helpers for the one-time "enrollments -> sections" backfill (see the Term/Schedule/Section
// plan). Kept free of GitHub/DB access so the mapping logic is unit-tested in isolation and can be
// imported by the standalone backfill script.

/**
 * Resolve which section a legacy enrollment should be assigned to.
 *
 * Mapping precedence:
 *   1. The learner's explicitly selected schedule file (enrollment.settings.selectedScheduleFile).
 *   2. The course's default schedule file.
 *   3. If the course has exactly one section, that section.
 *   4. Otherwise unassigned (null) - left for an editor/root to assign later.
 *
 * @param {string|undefined|null} selectedFileId - legacy selectedScheduleFile id, if any.
 * @param {Array<{id: string, legacyFileId?: string|null}>} sections - sections created for the course.
 * @param {string|undefined|null} defaultFileId - the schedule file flagged `default`, if any.
 * @returns {string|null} the sectionId to assign, or null to leave unassigned.
 */
export function resolveEnrollmentSection(selectedFileId, sections, defaultFileId) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return null;
  }

  const byLegacyFile = (fileId) => {
    if (!fileId) return null;
    const match = sections.find((section) => section && section.legacyFileId && section.legacyFileId === fileId);
    return match ? match.id : null;
  };

  // 1. Explicit learner selection wins.
  const selected = byLegacyFile(selectedFileId);
  if (selected) return selected;

  // 2. Fall back to the course's default schedule file.
  const fallback = byLegacyFile(defaultFileId);
  if (fallback) return fallback;

  // 3. A single section is unambiguous.
  if (sections.length === 1) return sections[0].id;

  // 4. Ambiguous - leave for manual assignment.
  return null;
}
