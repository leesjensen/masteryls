import React, { useRef, useState } from 'react';
import CourseCard from './courseCard.jsx';
import ConfirmDialog from '../../hooks/confirmDialog.jsx';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import { GraduationCap, BookSearch } from 'lucide-react';

const ENROLLMENT_CARD_COLORS = ['bg-cyan-700', 'bg-rose-700', 'bg-amber-600', 'bg-indigo-700', 'bg-emerald-700', 'bg-sky-700', 'bg-teal-700', 'bg-violet-700', 'bg-fuchsia-700', 'bg-orange-700', 'bg-lime-700', 'bg-pink-700'];

function pickEnrollmentCardColor(currentEnrollments) {
  const usedColors = new Set(
    Array.from(currentEnrollments.values())
      .map((enrollment) => enrollment.settings?.cardColor)
      .filter(Boolean),
  );
  return ENROLLMENT_CARD_COLORS.find((color) => !usedColors.has(color)) || ENROLLMENT_CARD_COLORS[currentEnrollments.size % ENROLLMENT_CARD_COLORS.length];
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
      const cardColor = pickEnrollmentCardColor(enrollments);
      const newEnrollment = await service.createEnrollment(user.id, catalogEntry, { cardColor });
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

  if (!enrollments) return <div></div>;

  const catalog = courseOps.courseCatalog();
  const enrolledCourses = enrollments ? Array.from(enrollments.values()) : [];
  const availableCourses = enrollments ? catalog.filter((course) => course.id && !enrollments.has(course.id)) : [];

  const query = searchTerm
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  const visibleAvailable = availableCourses.filter((course) => {
    if (!query || query.length === 0) return true;
    const courseText = `${course.title} ${course.description}`.toLowerCase();
    return query.some((term) => courseText.includes(term));
  });

  const completedCount = enrolledCourses.filter((enrollment) => enrollment.progress.mastery >= 100).length;

  return (
    <>
      <div className="flex-1 overflow-auto bg-white p-6 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xl mb-6">
              <h1 className="text-amber-500">
                <GraduationCap className="inline mr-2" />
                {`You are working on ${enrolledCourses.length} course${enrolledCourses.length > 1 ? 's' : ''}`}
              </h1>
              <div className="mt-4 grid-cols-4 gap-2 hidden sm:grid">
                <DashboardStat label="Enrolled" value={enrolledCourses.length} />
                <DashboardStat label="Completed" value={completedCount} />
              </div>
            </div>
            {enrolledCourses.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {enrolledCourses.map((enrollment) => (
                  <CourseCard user={user} key={enrollment.id} catalogEntry={enrollment.catalogEntry} enrollment={enrollment} remove={() => requestedEnrollmentRemoval(enrollment)} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">You are not enrolled in any courses yet. Join one below to get started.</div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl text-amber-500 flex items-center justify-between">
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
              <label htmlFor="course-search" className="sr-only">
                Search courses
              </label>
              <input id="course-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200" placeholder="Search by title or description" />
            </div>
            {visibleAvailable.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {visibleAvailable.map((catalogEntry) => (
                  <CourseCard user={user} key={catalogEntry.id} catalogEntry={catalogEntry} select={() => addEnrollment(catalogEntry)} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{query && query.length ? 'No available courses match your search.' : 'You are enrolled in every published course.'}</div>
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

function DashboardStat({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <p className="truncate text-xs uppercase tracking-wide text-slate-600" title={label}>
        {label}
      </p>
      <p className="shrink-0 text-xs font-semibold leading-none text-slate-800 rounded-2xl bg-slate-200 py-0.5 px-3">{value}</p>
    </div>
  );
}
