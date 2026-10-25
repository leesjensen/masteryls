import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';

// Editor/root management of a course's terms and sections. Rendered in the classroom content pane
// (as the synthetic `sections` topic) so it reads as part of the course, reachable from the TOC, the
// toolbar, and course settings. Sections are shown nested under their term so the relationship is
// clear: every section belongs to a term, and a term is always created with its first section.
// Adding uses distinct, highlighted forms so it never blends in with the existing items. (Assigning
// individual learners to sections is intentionally NOT here - it belongs with the roster/cohorts.)
export default function SectionsAdminView({ courseOps }) {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const user = courseOps?.user;

  const [terms, setTerms] = React.useState([]);
  const [schedules, setSchedules] = React.useState([]);
  const [sections, setSections] = React.useState([]);
  const [sectionCounts, setSectionCounts] = React.useState(new Map()); // sectionId -> learner count
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const [addingTerm, setAddingTerm] = React.useState(false);
  const [newTerm, setNewTerm] = React.useState({ title: '', startDate: '', endDate: '', sectionTitle: '', scheduleId: '' });
  const [addSectionTermId, setAddSectionTermId] = React.useState(null);
  const [newSection, setNewSection] = React.useState({ title: '', scheduleId: '' });
  const [addingSchedule, setAddingSchedule] = React.useState(false);
  const [newSchedule, setNewSchedule] = React.useState({ title: '', startDate: '', endDate: '' });
  const [busy, setBusy] = React.useState(false);

  const canEdit = Boolean(user?.isRoot?.() || user?.isEditor?.(courseId));

  const reload = React.useCallback(async () => {
    setError(null);
    try {
      const [bundle, enrollments] = await Promise.all([courseOps.getCourseSectionsAndSchedules(courseId), courseOps.service.allEnrollments(courseId)]);
      const counts = new Map();
      (enrollments || []).forEach((e) => {
        if (e.sectionId) counts.set(e.sectionId, (counts.get(e.sectionId) || 0) + 1);
      });
      setTerms(bundle.terms || []);
      setSchedules(bundle.schedules || []);
      setSections(bundle.sections || []);
      setSectionCounts(counts);
    } catch (ex) {
      setError(ex.message || String(ex));
    }
    setLoading(false);
  }, [courseId, courseOps]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function run(fn) {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (ex) {
      setError(ex.message || String(ex));
    }
  }

  const sectionsForTerm = (termId) => sections.filter((s) => s.termId === termId);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (!canEdit) return <div className="p-6 text-sm text-red-600">You do not have permission to manage this course's sections.</div>;

  function renderSectionRow(sec) {
    const count = sectionCounts.get(sec.id) || 0;
    // A term always keeps at least one section, so the last section in a term isn't individually
    // deletable - you delete the whole term instead. Sections with learners are never deletable.
    const isLastInTerm = sectionsForTerm(sec.termId).length <= 1;
    const canDelete = count === 0 && !isLastInTerm;
    return (
      <div key={sec.id} className="flex flex-wrap items-center gap-2 text-sm rounded-md border border-gray-200 bg-white px-3 py-2">
        <input defaultValue={sec.title || ''} onBlur={(e) => e.target.value !== (sec.title || '') && run(() => courseOps.updateSection(sec.id, { title: e.target.value }))} placeholder="Section title" className="border border-gray-300 rounded px-2 py-1 w-44 font-medium" />
        <label className="flex items-center gap-1 text-gray-600">
          Schedule
          <select value={sec.scheduleId || ''} onChange={(e) => run(() => courseOps.updateSection(sec.id, { scheduleId: e.target.value || null }))} className="border border-gray-300 rounded px-2 py-1">
            <option value="">None</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || 'Schedule'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-gray-700">
          <input type="checkbox" checked={!!sec.attendanceEnabled} onChange={(e) => run(() => courseOps.updateSection(sec.id, { attendanceEnabled: e.target.checked }))} /> Attendance
        </label>
        <span className="ml-auto text-xs text-gray-500">
          {count} learner{count === 1 ? '' : 's'}
        </span>
        {canDelete && (
          <button
            type="button"
            title="Delete section"
            aria-label={`Delete section ${sec.title || ''}`}
            onClick={() => window.confirm(`Delete section "${sec.title || 'Untitled'}"?`) && run(() => courseOps.deleteSection(sec.id))}
            className="text-gray-400 hover:text-red-600"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  }

  function renderAddSection(termId) {
    const open = addSectionTermId === termId;
    if (!open) {
      return (
        <button type="button" onClick={() => { setAddSectionTermId(termId); setNewSection({ title: '', scheduleId: '' }); }} className="text-sm text-blue-700 border border-dashed border-blue-300 rounded-md px-3 py-1.5 hover:bg-blue-50">
          + Add section
        </button>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm rounded-md border border-blue-300 bg-blue-50 px-3 py-2">
        <input autoFocus value={newSection.title} onChange={(e) => setNewSection({ ...newSection, title: e.target.value })} placeholder="New section title" className="border border-gray-300 rounded px-2 py-1 w-44" />
        <select value={newSection.scheduleId} onChange={(e) => setNewSection({ ...newSection, scheduleId: e.target.value })} className="border border-gray-300 rounded px-2 py-1">
          <option value="">Schedule…</option>
          {schedules.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title || 'Schedule'}
            </option>
          ))}
        </select>
        <button type="button" disabled={!newSection.title.trim()} onClick={() => run(async () => { await courseOps.createSection(courseId, { title: newSection.title.trim(), scheduleId: newSection.scheduleId || null, termId }); setAddSectionTermId(null); })} className="px-3 py-1 rounded bg-blue-600 text-white disabled:bg-gray-300">
          Create
        </button>
        <button type="button" onClick={() => setAddSectionTermId(null)} className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-white">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 p-6 flex flex-col gap-5 overflow-auto">
      <h2 className="text-xl font-semibold text-gray-800">Terms &amp; Sections</h2>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Terms, each with its sections nested underneath. */}
      <div className="space-y-4">
        {terms.map((t) => {
          const termSections = sectionsForTerm(t.id);
          const termHasLearners = termSections.some((s) => (sectionCounts.get(s.id) || 0) > 0);
          return (
          <div key={t.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input defaultValue={t.title || ''} onBlur={(e) => e.target.value !== (t.title || '') && run(() => courseOps.updateTerm(t.id, { title: e.target.value }))} placeholder="Term title" className="border border-gray-300 rounded px-2 py-1 w-56 text-base font-semibold" />
              <label className="flex items-center gap-1 text-sm text-gray-600">
                Start
                <input type="date" defaultValue={t.startDate || ''} onBlur={(e) => e.target.value !== (t.startDate || '') && run(() => courseOps.updateTerm(t.id, { startDate: e.target.value || null }))} className="border border-gray-300 rounded px-2 py-1" />
              </label>
              <label className="flex items-center gap-1 text-sm text-gray-600">
                End
                <input type="date" defaultValue={t.endDate || ''} onBlur={(e) => e.target.value !== (t.endDate || '') && run(() => courseOps.updateTerm(t.id, { endDate: e.target.value || null }))} className="border border-gray-300 rounded px-2 py-1" />
              </label>
              {!termHasLearners && (
                <button
                  type="button"
                  title="Delete term"
                  aria-label={`Delete term ${t.title || ''}`}
                  onClick={() => window.confirm(`Delete term "${t.title || 'Untitled'}" and its ${termSections.length} section${termSections.length === 1 ? '' : 's'}? Schedules are kept.`) && run(() => courseOps.deleteTerm(t.id))}
                  className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                >
                  <Trash2 size={14} /> Delete term
                </button>
              )}
            </div>
            <div className="space-y-2 pl-3 border-l-2 border-gray-200">
              {sectionsForTerm(t.id).map(renderSectionRow)}
              {sectionsForTerm(t.id).length === 0 && <div className="text-sm text-gray-400">No sections in this term yet.</div>}
              <div>{renderAddSection(t.id)}</div>
            </div>
          </div>
          );
        })}
        {terms.length === 0 && <div className="text-sm text-gray-500">No terms yet. Create a term and its first section to get started.</div>}
      </div>

      {/* Add term (with its first section) — a distinct, highlighted form. */}
      {addingTerm ? (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-700">New term</div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input autoFocus value={newTerm.title} onChange={(e) => setNewTerm({ ...newTerm, title: e.target.value })} placeholder="Term title" className="border border-gray-300 rounded px-2 py-1 w-56" />
            <label className="flex items-center gap-1 text-gray-600">
              Start
              <input type="date" value={newTerm.startDate} onChange={(e) => setNewTerm({ ...newTerm, startDate: e.target.value })} className="border border-gray-300 rounded px-2 py-1" />
            </label>
            <label className="flex items-center gap-1 text-gray-600">
              End
              <input type="date" value={newTerm.endDate} onChange={(e) => setNewTerm({ ...newTerm, endDate: e.target.value })} className="border border-gray-300 rounded px-2 py-1" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">First section</span>
            <input value={newTerm.sectionTitle} onChange={(e) => setNewTerm({ ...newTerm, sectionTitle: e.target.value })} placeholder="Section title" className="border border-gray-300 rounded px-2 py-1 w-44" />
            <select value={newTerm.scheduleId} onChange={(e) => setNewTerm({ ...newTerm, scheduleId: e.target.value })} className="border border-gray-300 rounded px-2 py-1">
              <option value="">Schedule…</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || 'Schedule'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!newTerm.title.trim() || !newTerm.sectionTitle.trim()} onClick={() => run(async () => { const term = await courseOps.createTerm(courseId, { title: newTerm.title.trim(), startDate: newTerm.startDate || null, endDate: newTerm.endDate || null }); await courseOps.createSection(courseId, { title: newTerm.sectionTitle.trim(), scheduleId: newTerm.scheduleId || null, termId: term.id }); setAddingTerm(false); })} className="px-3 py-1 rounded bg-blue-600 text-white disabled:bg-gray-300">
              Create term &amp; section
            </button>
            <button type="button" onClick={() => setAddingTerm(false)} className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-white">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => { setAddingTerm(true); setNewTerm({ title: '', startDate: '', endDate: '', sectionTitle: '', scheduleId: '' }); }} className="text-sm text-blue-700 border border-dashed border-blue-300 rounded-md px-4 py-2 hover:bg-blue-50">
            + New term
          </button>
        </div>
      )}

      {/* Schedules are peer items to terms; editing their content is done in the schedule editor. */}
      <div className="space-y-4">
        <div className="text-xl font-semibold text-gray-800">Schedules</div>
        {schedules.map((s) => (
          <div key={s.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input defaultValue={s.title || ''} onBlur={(e) => e.target.value !== (s.title || '') && run(() => courseOps.updateSchedule(s.id, { title: e.target.value }))} placeholder="Schedule title" className="border border-gray-300 rounded px-2 py-1 w-56 text-base font-semibold" />
              <label className="flex items-center gap-1 text-sm text-gray-600">
                Start
                <input type="date" defaultValue={s.startDate || ''} onBlur={(e) => e.target.value !== (s.startDate || '') && run(() => courseOps.updateSchedule(s.id, { startDate: e.target.value || null }))} className="border border-gray-300 rounded px-2 py-1" />
              </label>
              <label className="flex items-center gap-1 text-sm text-gray-600">
                End
                <input type="date" defaultValue={s.endDate || ''} onBlur={(e) => e.target.value !== (s.endDate || '') && run(() => courseOps.updateSchedule(s.id, { endDate: e.target.value || null }))} className="border border-gray-300 rounded px-2 py-1" />
              </label>
              <button type="button" onClick={() => { courseOps.saveEnrollmentUiSettings(courseId, { selectedScheduleFile: s.id }); navigate(`/course/${courseId}/schedule`); }} className="ml-auto text-xs text-blue-700 hover:underline" title="Open this schedule">
                View
              </button>
              <button type="button" disabled={busy} onClick={async () => { setBusy(true); await run(() => courseOps.copyCourseSchedule(courseId, s.id, {})); setBusy(false); }} className="text-xs text-blue-700 hover:underline disabled:text-gray-400">
                Copy
              </button>
            </div>
          </div>
        ))}
        {schedules.length === 0 && <div className="text-sm text-gray-500">No schedules yet.</div>}
        {addingSchedule ? (
          <div className="flex flex-wrap items-center gap-2 text-sm rounded-md border border-blue-300 bg-blue-50 px-3 py-2">
            <input autoFocus value={newSchedule.title} onChange={(e) => setNewSchedule({ ...newSchedule, title: e.target.value })} placeholder="New schedule title" className="border border-gray-300 rounded px-2 py-1 w-56" />
            <label className="flex items-center gap-1 text-gray-600">
              Start
              <input type="date" value={newSchedule.startDate} onChange={(e) => setNewSchedule({ ...newSchedule, startDate: e.target.value })} className="border border-gray-300 rounded px-2 py-1" />
            </label>
            <label className="flex items-center gap-1 text-gray-600">
              End
              <input type="date" value={newSchedule.endDate} onChange={(e) => setNewSchedule({ ...newSchedule, endDate: e.target.value })} className="border border-gray-300 rounded px-2 py-1" />
            </label>
            <button type="button" disabled={!newSchedule.title.trim() || busy} onClick={async () => { setBusy(true); await run(async () => { await courseOps.createCourseSchedule(courseId, { title: newSchedule.title.trim(), startDate: newSchedule.startDate || null, endDate: newSchedule.endDate || null }); setAddingSchedule(false); }); setBusy(false); }} className="px-3 py-1 rounded bg-blue-600 text-white disabled:bg-gray-300">
              {busy ? 'Creating…' : 'Create schedule'}
            </button>
            <button type="button" onClick={() => setAddingSchedule(false)} className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-white">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => { setAddingSchedule(true); setNewSchedule({ title: '', startDate: '', endDate: '' }); }} className="text-sm text-blue-700 border border-dashed border-blue-300 rounded-md px-4 py-2 hover:bg-blue-50">
            + New schedule
          </button>
        )}
      </div>
    </div>
  );
}
