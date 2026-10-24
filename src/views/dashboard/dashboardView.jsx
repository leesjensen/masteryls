import React, { useRef, useState } from 'react';
import CourseCard from './courseCard.jsx';
import ConfirmDialog from '../../hooks/confirmDialog.jsx';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import { GraduationCap, BookSearch, Eye, EyeOff } from 'lucide-react';
import { deriveProgressSummary } from '../../utils/progressSummary.js';
import { enrollableSections } from '../../utils/sectionEnrollment.js';

export default function DashboardView({ courseOps, service, user }) {
  if (!user) return null;

  const [enrollments, setEnrollments] = useState();
  const [pendingEnrollmentRemoval, setPendingEnrollmentRemoval] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [enrollmentSummaries, setEnrollmentSummaries] = useState(new Map());
  const dialogRef = useRef(null);
  // Section picker shown when enrolling in a course that has more than one section.
  const [sectionEnroll, setSectionEnroll] = useState(null); // { catalogEntry, sections }
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const sectionDialogRef = useRef(null);

  React.useEffect(() => {
    if (user) {
      if (user.isRoot) {
        updateAppBar({ title: `${user.name}'s Dashboard`, tools: null });
      }
      service.enrollments(user.id).then((learnerEnrollments) => {
        setEnrollments(learnerEnrollments);
      });
    }
  }, [user]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadEnrollmentSummaries() {
      if (!enrollments || !courseOps?.getCourse) {
        setEnrollmentSummaries(new Map());
        return;
      }

      const summaries = new Map();
      await Promise.all(
        Array.from(enrollments.values()).map(async (enrollment) => {
          try {
            const course = await courseOps.getCourse(enrollment.catalogId);
            summaries.set(enrollment.catalogId, deriveProgressSummary(enrollment.progress, course));
          } catch {
            summaries.set(enrollment.catalogId, deriveProgressSummary(enrollment.progress, null));
          }
        }),
      );

      if (!cancelled) {
        setEnrollmentSummaries(summaries);
      }
    }

    loadEnrollmentSummaries();

    return () => {
      cancelled = true;
    };
  }, [courseOps, enrollments]);

  const enrollInCourse = async (catalogEntry, sectionId) => {
    const cardColor = pickEnrollmentCardColor(enrollments);
    const newEnrollment = await service.createEnrollment(user.id, catalogEntry, { cardColor }, sectionId);
    if (!newEnrollment) throw new Error('Failed to create enrollment');

    setEnrollments((prev) => new Map(prev).set(catalogEntry.id, newEnrollment));
    await service.logEvent('createEnrollment', { learnerId: user.id, courseId: catalogEntry.id });
  };

  const addEnrollment = async (catalogEntry) => {
    if (enrollments.has(catalogEntry.id)) return;

    let sections = [];
    let schedules = [];
    try {
      [sections, schedules] = await Promise.all([service.getCourseSections(catalogEntry.id), service.getCourseSchedules(catalogEntry.id)]);
    } catch {
      sections = [];
      schedules = [];
    }

    // A course with no sections is schedule-less: enroll unsectioned.
    if (sections.length === 0) {
      await enrollInCourse(catalogEntry, null);
      return;
    }

    // Only offer sections whose scheduled term includes today (a section with no schedule, or an
    // undated schedule, is always open). The chosen section is fixed after enrolling.
    const open = enrollableSections(sections, schedules);

    if (open.length === 0) {
      // The course has sections but none are currently open for enrollment.
      setSectionEnroll({ catalogEntry, sections: [] });
      setSelectedSectionId('');
      sectionDialogRef.current?.showModal();
      return;
    }
    if (open.length === 1) {
      await enrollInCourse(catalogEntry, open[0].id);
      return;
    }
    setSectionEnroll({ catalogEntry, sections: open });
    setSelectedSectionId(open[0].id);
    sectionDialogRef.current?.showModal();
  };

  const confirmSectionEnroll = async () => {
    const pending = sectionEnroll;
    sectionDialogRef.current?.close();
    setSectionEnroll(null);
    if (pending && selectedSectionId) {
      await enrollInCourse(pending.catalogEntry, selectedSectionId);
    }
  };

  const cancelSectionEnroll = () => {
    sectionDialogRef.current?.close();
    setSectionEnroll(null);
  };

  const requestedEnrollmentRemoval = async (enrollment) => {
    setPendingEnrollmentRemoval(enrollment);
    dialogRef.current.showModal();
  };

  const confirmedEnrollmentRemoval = async () => {
    dialogRef.current.close();
    const summary = enrollmentSummaries.get(pendingEnrollmentRemoval.catalogId) || deriveProgressSummary(pendingEnrollmentRemoval.progress, null);
    await service.deleteEnrollment(pendingEnrollmentRemoval);
    await service.logEvent('deleteEnrollment', {
      learnerId: user.id,
      courseId: pendingEnrollmentRemoval.catalogId,
      mastery: summary.mastery,
      lastActivityAt: summary.lastActivityAt,
      totalTimeSpent: summary.totalTimeSpent,
    });
    setEnrollments((prev) => {
      const newEnrollments = new Map(prev);
      newEnrollments.delete(pendingEnrollmentRemoval.catalogId);
      return newEnrollments;
    });
    setPendingEnrollmentRemoval(null);
  };

  const getEnrollmentsByType = () => {
    let activeEnrollmentCount = 0;
    let completedEnrollmentCount = 0;
    const visibleEnrollments = Array.from(enrollments.values()).filter((enrollment) => {
      const summary = enrollmentSummaries.get(enrollment.catalogId) || deriveProgressSummary(enrollment.progress, null);
      if (summary.mastery >= 100) {
        completedEnrollmentCount++;
      } else {
        activeEnrollmentCount++;
      }

      if (summary.mastery >= 100) {
        return showCompleted;
      }
      return !showCompleted;
    });

    return [activeEnrollmentCount, completedEnrollmentCount, visibleEnrollments];
  };

  const getVisibleUnenrolledCourses = (catalog) => {
    const unenrolledCourses = catalog.filter((course) => course.id && !enrollments.has(course.id));

    const searchTerms = userSearch
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    return unenrolledCourses.filter((course) => {
      if (!searchTerms || searchTerms.length === 0) return true;

      const courseText = `${course.title} ${course.description}`.toLowerCase();
      return searchTerms.some((term) => courseText.includes(term));
    });
  };

  const toggleCompleted = () => {
    setShowCompleted((prev) => !prev);
  };

  // If we haven't loaded enrollments yet, show nothing
  if (!enrollments) return <div></div>;

  // Figure out which courses to show based on enrollment and search term
  const catalog = courseOps.courseCatalog();
  const [activeEnrollmentCount, completedEnrollmentCount, visibleEnrollments] = getEnrollmentsByType();
  const visibleAvailable = getVisibleUnenrolledCourses(catalog);

  return (
    <>
      <div className="flex-1 overflow-auto bg-white p-6 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xl mb-6">
              <h1 className="text-slate-800">
                <GraduationCap className="inline mr-2" />
                {`You are enrolled in ${enrollments.size} course${enrollments.size > 1 ? 's' : ''}`}
              </h1>
              <div className="mt-4 grid-cols-4 gap-2 hidden sm:grid">
                <DashboardStat label="Active" value={activeEnrollmentCount} />
                {completedEnrollmentCount > 0 && <DashboardStat label="Completed" value={completedEnrollmentCount} active={showCompleted} action={toggleCompleted} />}
              </div>
            </div>
            {visibleEnrollments.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {visibleEnrollments.map((enrollment) => (
                  <CourseCard user={user} key={enrollment.id} catalogEntry={enrollment.catalogEntry} enrollment={enrollment} masteryPercent={enrollmentSummaries.get(enrollment.catalogId)?.mastery} remove={() => requestedEnrollmentRemoval(enrollment)} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">You are not enrolled in any courses yet. Join one below to get started.</div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl text-slate-800 flex items-center justify-between">
              <span>
                <BookSearch className="inline mr-2" />
                Find a new course
              </span>
            </h1>
            <div className="mt-4 grid-cols-4 gap-2 hidden sm:grid">
              <DashboardStat label="Unenrolled" value={visibleAvailable.length} />
              <DashboardStat label="Catalog" value={catalog.length} />
            </div>
            <div className="my-5">
              <input id="course-search" type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200" placeholder="Search by title or description" />
            </div>
            {visibleAvailable.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {visibleAvailable.map((catalogEntry) => (
                  <CourseCard user={user} key={catalogEntry.id} catalogEntry={catalogEntry} select={() => addEnrollment(catalogEntry)} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{userSearch?.length ? 'No available courses match your search.' : 'You are enrolled in every published course.'}</div>
            )}
          </section>
        </div>
      </div>
      <ConfirmDialog
        dialogRef={dialogRef}
        title="Delete enrollment"
        confirmed={confirmedEnrollmentRemoval}
        message={
          <p>
            Are you sure you want to delete your enrollment to <b>{pendingEnrollmentRemoval?.catalogEntry.name}</b>?
          </p>
        }
      />
      <dialog ref={sectionDialogRef} className="rounded-lg p-0 shadow-lg mx-auto mt-24 backdrop:bg-black/40" onCancel={cancelSectionEnroll}>
        <div className="p-5 w-80 max-w-[90vw]">
          {(sectionEnroll?.sections?.length || 0) === 0 ? (
            <>
              <h2 className="text-base font-semibold text-gray-800 mb-1">No open sections</h2>
              <p className="text-sm text-gray-600 mb-4">
                <b>{sectionEnroll?.catalogEntry?.title || sectionEnroll?.catalogEntry?.name}</b> has no sections currently open for enrollment. Please check back when a section’s schedule is active.
              </p>
              <div className="flex justify-end">
                <button type="button" onClick={cancelSectionEnroll} className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Choose a section</h2>
              <p className="text-sm text-gray-600 mb-3">
                <b>{sectionEnroll?.catalogEntry?.title || sectionEnroll?.catalogEntry?.name}</b> has more than one section. Pick the one you are taking — this can’t be changed after you enroll.
              </p>
              <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-4">
                {(sectionEnroll?.sections || []).map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title || 'Section'}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={cancelSectionEnroll} className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={confirmSectionEnroll} disabled={!selectedSectionId} className="px-3 py-1.5 rounded-md bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:bg-gray-300">
                  Enroll
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

function DashboardStat({ label, value, active = false, action = null }) {
  return (
    <div className="flex select-none items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2" onClick={action}>
      <p className="flex items-center justify-between gap-1 truncate text-xs uppercase tracking-wide text-slate-600" title={label}>
        {action ? active ? <Eye className="h-4 w-4 pr-1" /> : <EyeOff className="h-4 w-4 pr-1" /> : null}
        {label}
      </p>
      <p className="shrink-0 text-xs font-semibold leading-none text-slate-800 rounded-2xl bg-slate-200 py-0.5 px-3">{value}</p>
    </div>
  );
}

const ENROLLMENT_CARD_COLORS = ['bg-cyan-700', 'bg-rose-700', 'bg-amber-600', 'bg-indigo-700', 'bg-emerald-700', 'bg-sky-700', 'bg-teal-700', 'bg-violet-700', 'bg-fuchsia-700', 'bg-orange-700', 'bg-lime-700', 'bg-pink-700'];

function pickEnrollmentCardColor(currentEnrollments) {
  const usedColors = new Set(
    Array.from(currentEnrollments.values())
      .map((enrollment) => enrollment.settings?.cardColor)
      .filter(Boolean),
  );
  return ENROLLMENT_CARD_COLORS.find((color) => !usedColors.has(color)) || ENROLLMENT_CARD_COLORS[currentEnrollments.size % ENROLLMENT_CARD_COLORS.length];
}
