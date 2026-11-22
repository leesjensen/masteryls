import React, { useRef, useState } from 'react';
import CourseCard from './courseCard.jsx';
import ConfirmDialog from '../../hooks/confirmDialog.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import Select from '../../components/ui/Select.jsx';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import { GraduationCap, BookSearch, Eye, EyeOff } from 'lucide-react';
import { deriveProgressSummary } from '../../utils/progressSummary.js';
import { enrollableSections } from '../../utils/sectionEnrollment.js';
import { resolveLearnerSchedule } from '../../utils/scheduleResolution.js';

function formatOfflineSize(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function offlineEnrollmentFromPackage(coursePackage, user) {
  const courseId = coursePackage.courseId;
  const savedEnrollment = coursePackage.enrollment || {};
  const catalogEntry = coursePackage.catalogEntry || {
    id: courseId,
    title: coursePackage.course?.title || 'Downloaded course',
    description: coursePackage.course?.description || '',
    settings: coursePackage.course?.settings || {},
  };
  return {
    ...savedEnrollment,
    id: savedEnrollment.id || `offline-${courseId}`,
    catalogId: courseId,
    learnerId: savedEnrollment.learnerId || user.id,
    sectionId: savedEnrollment.sectionId ?? coursePackage.sectionId ?? null,
    progress: savedEnrollment.progress || {},
    settings: savedEnrollment.settings || {},
    catalogEntry,
  };
}

export default function DashboardView({ courseOps, service, user }) {
  if (!user) return null;

  const [enrollments, setEnrollments] = useState();
  const [pendingEnrollmentRemoval, setPendingEnrollmentRemoval] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [enrollmentSummaries, setEnrollmentSummaries] = useState(new Map());
  // catalogId -> boolean: does the learner's section resolve to a schedule? Gates the card's schedule
  // icon so it only appears once resolved (never flickers on then off).
  const [enrollmentHasSchedule, setEnrollmentHasSchedule] = useState(new Map());
  const [enrollmentPulses, setEnrollmentPulses] = useState(new Map());
  const [offlineCourses, setOfflineCourses] = useState([]);
  const [dashboardOffline, setDashboardOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
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
      const loadEnrollments = () => service.enrollments(user.id).then((learnerEnrollments) => {
        setEnrollments(learnerEnrollments);
        setDashboardOffline(false);
      }).catch(() => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          void loadOfflineDashboard();
          return;
        }
        setDashboardOffline(true);
        setEnrollments(new Map());
      });
      const loadOfflineDashboard = async () => {
        setDashboardOffline(true);
        try {
          const items = await courseOps.getOfflineCourses?.() || [];
          setOfflineCourses(items);
          setEnrollments(new Map(items.map((item) => {
            const enrollment = offlineEnrollmentFromPackage(item, user);
            return [enrollment.catalogId, enrollment];
          })));
        } catch {
          setOfflineCourses([]);
          setEnrollments(new Map());
        }
      };
      if (typeof navigator === 'undefined' || navigator.onLine) loadEnrollments();
      else void loadOfflineDashboard();
      const refreshOfflineCourses = () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) void loadOfflineDashboard();
        else courseOps.getOfflineCourses?.().then(setOfflineCourses).catch(() => setOfflineCourses([]));
      };
      const handleOffline = () => { void loadOfflineDashboard(); };
      const handleOnline = () => loadEnrollments();
      courseOps.getOfflineCourses?.().then(setOfflineCourses).catch(() => setOfflineCourses([]));
      window.addEventListener('masteryls-offline-courses-changed', refreshOfflineCourses);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);
      return () => {
        window.removeEventListener('masteryls-offline-courses-changed', refreshOfflineCourses);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      };
    }
  }, [user]);

  React.useEffect(() => {
    if (dashboardOffline || !enrollments || !courseOps?.updateOfflineEnrollmentSnapshot) return;
    for (const coursePackage of offlineCourses) {
      const enrollment = enrollments.get(coursePackage.courseId);
      if (enrollment) {
        courseOps.updateOfflineEnrollmentSnapshot(coursePackage.courseId, enrollment).catch(() => {});
      }
    }
  // The operation API object is recreated on render; package and enrollment snapshots are the
  // meaningful inputs, and the update itself does not emit a package-change event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardOffline, enrollments, offlineCourses]);

  async function removeOfflineCourse(courseId) {
    await courseOps.deleteOfflineCourse(courseId);
    setOfflineCourses((items) => items.filter((item) => item.courseId !== courseId));
  }

  React.useEffect(() => {
    let cancelled = false;

    async function loadEnrollmentSummaries() {
      if (!enrollments || !courseOps?.getCourse) {
        setEnrollmentSummaries(new Map());
        setEnrollmentHasSchedule(new Map());
        return;
      }

      const summaries = new Map();
      const hasSchedule = new Map();
      await Promise.all(
        Array.from(enrollments.values()).map(async (enrollment) => {
          try {
            const course = await courseOps.getCourse(enrollment.catalogId);
            summaries.set(enrollment.catalogId, deriveProgressSummary(enrollment.progress, course));
            // The schedule icon shows only when the learner's section resolves to a schedule. The full
            // course (with its DB sections/schedules) is already loaded here for the progress summary.
            hasSchedule.set(enrollment.catalogId, Boolean(resolveLearnerSchedule({ sectionId: enrollment.sectionId, sections: course.sections || [], schedules: course.schedules || [] })));
          } catch {
            summaries.set(enrollment.catalogId, deriveProgressSummary(enrollment.progress, null));
            hasSchedule.set(enrollment.catalogId, false);
          }
        }),
      );

      if (!cancelled) {
        setEnrollmentSummaries(summaries);
        setEnrollmentHasSchedule(dashboardOffline ? new Map() : hasSchedule);
      }
    }

    loadEnrollmentSummaries();

    return () => {
      cancelled = true;
    };
  // `courseOps` is a freshly composed API object on each render. Enrollment changes are the
  // meaningful trigger; including that object here re-ran course loading on every state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, dashboardOffline]);

  // Surface each enrollment's most recent learner pulse on its card (replacing the course blurb). A
  // single query fetches the latest per enrollment; failures are non-fatal (cards fall back to the
  // description) so a pulse hiccup never blocks the dashboard.
  React.useEffect(() => {
    let cancelled = false;

    async function loadEnrollmentPulses() {
      const ids = enrollments ? Array.from(enrollments.values()).map((enrollment) => enrollment.id) : [];
      if (dashboardOffline || ids.length === 0) {
        setEnrollmentPulses(new Map());
        return;
      }
      try {
        const pulses = await service.getLatestLearnerPulses(ids);
        if (!cancelled) setEnrollmentPulses(pulses);
      } catch {
        if (!cancelled) setEnrollmentPulses(new Map());
      }
    }

    loadEnrollmentPulses();

    return () => {
      cancelled = true;
    };
  }, [service, enrollments, dashboardOffline]);

  const enrollInCourse = async (catalogEntry, sectionId) => {
    const cardColor = pickEnrollmentCardColor(enrollments);
    const newEnrollment = await service.createEnrollment(user.id, catalogEntry, { cardColor }, sectionId);
    if (!newEnrollment) throw new Error('Failed to create enrollment');

    setEnrollments((prev) => new Map(prev).set(catalogEntry.id, newEnrollment));
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
    // Pass the course-derived summary (accurate mastery) for the unenroll telemetry; the service
    // layer alone would fall back to the often-stale cached progress.mastery.
    await service.deleteEnrollment(pendingEnrollmentRemoval, enrollmentSummaries.get(pendingEnrollmentRemoval.catalogId));
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

      if (dashboardOffline) {
        return !showCompleted || summary.mastery >= 100;
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
  const offlineManagerCourses = offlineCourses.filter((item) => !Array.from(enrollments.values()).some((enrollment) => enrollment.catalogId === item.courseId));

  return (
    <>
      <div className="flex-1 overflow-auto bg-white p-6 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {offlineManagerCourses.length > 0 && <section aria-labelledby="offline-courses-heading" className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h2 id="offline-courses-heading" className="font-semibold text-slate-900">Available offline</h2><p className="text-sm text-slate-600">Downloaded reading stays on this device until you remove it.</p></div>
              <span className="text-xs text-slate-500">{offlineManagerCourses.length} course{offlineManagerCourses.length === 1 ? '' : 's'}</span>
            </div>
            <ul className="divide-y divide-blue-100">
              {offlineManagerCourses.map((item) => {
                const title = item.catalogEntry?.title || item.course?.title || 'Downloaded course';
                const firstTopic = item.course?.modules?.flatMap((module) => module.topics || [])[0];
                const openHref = firstTopic ? `/course/${item.courseId}/topic/${firstTopic.id}` : `/course/${item.courseId}/schedule`;
                return <li key={item.courseId} className="flex items-center justify-between gap-3 py-2">
                  <a href={openHref} className="min-w-0 truncate font-medium text-blue-700 hover:underline">{title}</a>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500"><span>{formatOfflineSize(item.sizeBytes)}</span><button type="button" onClick={() => removeOfflineCourse(item.courseId)} className="font-medium text-slate-600 underline hover:text-rose-700">Remove</button></div>
                </li>;
              })}
            </ul>
          </section>}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xl mb-6">
              <h1 className="text-slate-800">
                <GraduationCap className="inline mr-2" />
                {dashboardOffline ? 'Your saved course downloads' : `You are enrolled in ${enrollments.size} course${enrollments.size > 1 ? 's' : ''}`}
              </h1>
              <div className="mt-4 grid-cols-4 gap-2 hidden sm:grid">
                <DashboardStat label="Active" value={activeEnrollmentCount} />
                {completedEnrollmentCount > 0 && <DashboardStat label="Completed" value={completedEnrollmentCount} active={showCompleted} action={toggleCompleted} />}
              </div>
            </div>
            {visibleEnrollments.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {visibleEnrollments.map((enrollment) => (
                  <CourseCard user={user} courseOps={courseOps} key={enrollment.id} catalogEntry={enrollment.catalogEntry} enrollment={enrollment} masteryPercent={enrollmentSummaries.get(enrollment.catalogId)?.mastery} pulse={enrollmentPulses.get(enrollment.id) || null} hasSchedule={enrollmentHasSchedule.get(enrollment.catalogId) || false} remove={dashboardOffline ? null : () => requestedEnrollmentRemoval(enrollment)} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{dashboardOffline ? 'No enrolled courses are saved for offline use. Connect to the internet to load your courses.' : 'You are not enrolled in any courses yet. Join one below to get started.'}</div>
            )}
          </section>

          {!dashboardOffline && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
              <input id="course-search" type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="Search by title or description" />
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
          </section>}
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
      <Modal dialogRef={sectionDialogRef} size="sm" onCancel={cancelSectionEnroll}>
        {(sectionEnroll?.sections?.length || 0) === 0 ? (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-1">No open sections</h2>
            <p className="text-sm text-gray-600 mb-4">
              <b>{sectionEnroll?.catalogEntry?.title || sectionEnroll?.catalogEntry?.name}</b> has no sections currently open for enrollment. Please check back when a section’s schedule is active.
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={cancelSectionEnroll}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Choose a section</h2>
            <p className="text-sm text-gray-600 mb-3">
              <b>{sectionEnroll?.catalogEntry?.title || sectionEnroll?.catalogEntry?.name}</b> has more than one section. Pick the one you are taking — this can’t be changed after you enroll.
            </p>
            <Select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="mb-4">
              {(sectionEnroll?.sections || []).map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title || 'Section'}
                </option>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={cancelSectionEnroll}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={confirmSectionEnroll} disabled={!selectedSectionId}>
                Enroll
              </Button>
            </div>
          </>
        )}
      </Modal>
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
