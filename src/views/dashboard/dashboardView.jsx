import React, { useRef, useState } from 'react';
import CourseCard from './courseCard.jsx';
import ConfirmDialog from '../../hooks/confirmDialog.jsx';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';

function DashboardStat({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-cyan-100 bg-white px-2.5 py-2">
      <p className="truncate text-[11px] uppercase tracking-wide text-slate-500" title={label}>
        {label}
      </p>
      <p className="shrink-0 text-base font-semibold leading-none text-slate-900">{value}</p>
    </div>
  );
}

export default function DashboardView({ courseOps, service, user }) {
  if (!user) return null;

  const [enrollments, setEnrollments] = useState();
  const [pendingEnrollmentRemoval, setPendingEnrollmentRemoval] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const dialogRef = useRef(null);

  React.useEffect(() => {
    if (user) {
      if (user.isRoot) {
        updateAppBar({ title: `${user.name}'s Dashboard`, tools: null });
      }
      service.enrollments(user.id).then((learnerEnrollments) => {
        const filteredEnrollments = new Map(
          Array.from(learnerEnrollments.entries()).filter(([, entry]) => {
            return entry.catalogEntry.settings?.state === 'published' || user.isEditor();
          }),
        );
        setEnrollments(filteredEnrollments);
      });
    }
  }, [user]);

  const addEnrollment = async (catalogEntry) => {
    if (!enrollments.has(catalogEntry.id)) {
      const newEnrollment = await service.createEnrollment(user.id, catalogEntry);
      if (!newEnrollment) throw new Error('Failed to create enrollment');

      setEnrollments((prev) => new Map(prev).set(catalogEntry.id, newEnrollment));
    }
  };

  const requestedEnrollmentRemoval = async (enrollment) => {
    setPendingEnrollmentRemoval(enrollment);
    dialogRef.current.showModal();
  };

  const confirmedEnrollmentRemoval = async () => {
    dialogRef.current.close();
    await service.deleteEnrollment(pendingEnrollmentRemoval);
    setEnrollments((prev) => {
      const newEnrollments = new Map(prev);
      newEnrollments.delete(pendingEnrollmentRemoval.catalogId);
      return newEnrollments;
    });
    setPendingEnrollmentRemoval(null);
  };

  const catalog = courseOps.courseCatalog();
  const enrolledCourses = enrollments ? Array.from(enrollments.values()) : [];
  const availableCourses = enrollments ? catalog.filter((course) => course.id && !enrollments.has(course.id)) : [];

  const query = searchTerm.trim().toLowerCase();
  const visibleEnrolled = enrolledCourses.filter((enrollment) => {
    if (!query) return true;
    return [enrollment.catalogEntry.title, enrollment.catalogEntry.description].some((value) => value?.toLowerCase().includes(query));
  });

  const visibleAvailable = availableCourses.filter((course) => {
    if (!query) return true;
    return [course.title, course.description].some((value) => value?.toLowerCase().includes(query));
  });

  const completedCount = enrolledCourses.filter((enrollment) => enrollment.progress.mastery >= 100).length;
  const inProgressCount = enrolledCourses.filter((enrollment) => enrollment.progress.mastery > 0 && enrollment.progress.mastery < 100).length;

  if (!enrollments) {
    return (
      <div className="flex-1 overflow-auto bg-slate-50 p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-6 shadow-sm">
            <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-slate-200" />
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row">
              <div className="h-10 flex-1 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100 md:w-80" />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-[280px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-auto bg-slate-50 p-6 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-6 shadow-sm">
            <p className="mt-2 text-sm text-slate-600">Pick up where you left off or join a new course.</p>
            <div className="mt-5">
              <label htmlFor="course-search" className="sr-only">
                Search courses
              </label>
              <input id="course-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200" placeholder="Search by title or description" />
            </div>
            <div className="mt-4 grid-cols-4 gap-2 hidden sm:grid">
              <DashboardStat label="Catalog" value={catalog.length} />
              <DashboardStat label="Enrolled" value={enrolledCourses.length} />
              <DashboardStat label="In progress" value={inProgressCount} />
              <DashboardStat label="Completed" value={completedCount} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Your courses</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{visibleEnrolled.length}</span>
            </div>
            {visibleEnrolled.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {visibleEnrolled.map((enrollment) => (
                  <CourseCard user={user} key={enrollment.id} catalogEntry={enrollment.catalogEntry} enrollment={enrollment} remove={() => requestedEnrollmentRemoval(enrollment)} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{query ? 'No enrolled courses match your search.' : 'You are not enrolled in any courses yet. Join one below to get started.'}</div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Join a course</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{visibleAvailable.length}</span>
            </div>
            {visibleAvailable.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {visibleAvailable.map((catalogEntry) => (
                  <CourseCard user={user} key={catalogEntry.id} catalogEntry={catalogEntry} select={() => addEnrollment(catalogEntry)} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{query ? 'No available courses match your search.' : 'You are enrolled in every published course.'}</div>
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
    </>
  );
}
