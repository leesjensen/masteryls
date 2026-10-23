// Dual-read resolution of which schedule a learner should see, during (and after) the migration
// from GitHub-`course.json` schedule files to DB-backed Term/Schedule/Section entities.
//
// Preference order:
//   1. The learner's SECTION's schedule (the new source of truth), when the enrollment has a
//      sectionId whose section points at a schedule row we loaded.
//   2. The legacy course.json schedule file, chosen by the learner's saved selectedScheduleFile,
//      else the file flagged `default`, else the first file. This keeps schedule-less courses and
//      any not-yet-migrated enrollment working exactly as before.
//
// Kept pure (no network/DB) so the fallback logic is unit-tested in isolation and callers can
// supply already-loaded data.

/**
 * @param {Object} args
 * @param {string|null} [args.sectionId] - enrollment.sectionId, if any.
 * @param {Array<{id: string, scheduleId?: string|null}>} [args.sections] - the course's sections (DB).
 * @param {Array<{id: string, contentPath?: string|null}>} [args.schedules] - the course's schedules (DB).
 * @param {Array<{id: string, path?: string, default?: boolean}>} [args.legacyFiles] - course.json schedule files.
 * @param {string|null} [args.selectedScheduleFileId] - enrollment.settings.selectedScheduleFile.
 * @returns {null | {source: 'section', sectionId: string, scheduleId: string, schedule: object, contentPath: string|null}
 *                 | {source: 'legacy', legacyFile: object, scheduleId: null, contentPath: string|null}}
 */
export function resolveLearnerSchedule({ sectionId = null, sections = [], schedules = [], legacyFiles = [], selectedScheduleFileId = null } = {}) {
  // 1. Section-derived schedule (preferred).
  if (sectionId && Array.isArray(sections) && Array.isArray(schedules)) {
    const section = sections.find((s) => s && s.id === sectionId);
    if (section && section.scheduleId) {
      const schedule = schedules.find((sc) => sc && sc.id === section.scheduleId);
      if (schedule) {
        return {
          source: 'section',
          sectionId,
          scheduleId: schedule.id,
          schedule,
          contentPath: schedule.contentPath || null,
        };
      }
    }
  }

  // 2. Legacy course.json fallback.
  if (Array.isArray(legacyFiles) && legacyFiles.length) {
    const file =
      (selectedScheduleFileId && legacyFiles.find((f) => f && f.id === selectedScheduleFileId)) ||
      legacyFiles.find((f) => f && f.default) ||
      legacyFiles[0];
    if (file) {
      return { source: 'legacy', legacyFile: file, scheduleId: null, contentPath: file.path || null };
    }
  }

  // 3. No schedule (schedule-less course).
  return null;
}
