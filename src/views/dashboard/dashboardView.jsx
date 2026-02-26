import React, { useState, useRef } from 'react';
import CourseCard from './courseCard.jsx';
import ConfirmDialog from '../../hooks/confirmDialog.jsx';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';

export default function DashboardView({ courseOps, service, user }) {
  if (!user) return null;

  const [enrollments, setEnrollments] = useState();
  const [pendingEnrollmentRemoval, setPendingEnrollmentRemoval] = useState(null);
  const dialogRef = useRef(null);

  React.useEffect(() => {
    if (user) {
      if (user.isRoot) {
        updateAppBar({ title: `${user.name}'s Dashboard`, tools: null });
      }
      service.enrollments(user.id).then((learnerEnrollments) => {
        const filteredEnrollments = new Map(
          Array.from(learnerEnrollments.entries()).filter(([catalogId, entry]) => {
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

  const allEnrolled = (enrollments) => {
    return (
      courseOps.courseCatalog().filter((course) => {
        if (course.id) {
          return !enrollments.has(course.id);
        }
        return false;
      }).length === 0
    );
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

  if (!enrollments) {
    return (
      <div className="flex flex-col h-screen">
        <div className="m-auto text-gray-400" />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-auto p-8 bg-white">
        <h2 className="border-t-2 border-gray-400 font-semibold mb- pt-1 text-xl text-gray-500">Your courses</h2>
        {enrollments.size > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {Array.from(enrollments.values()).map((enrollment) => {
              return <CourseCard user={user} key={enrollment.id} catalogEntry={enrollment.catalogEntry} enrollment={enrollment} remove={() => requestedEnrollmentRemoval(enrollment)} />;
            })}
          </div>
        ) : (
          <div className="text-gray-400 text-base m-4">You are not enrolled in any courses. Select one below to get started.</div>
        )}

        {!allEnrolled(enrollments) && (
          <div className="my-8">
            <h2 className="border-t-2 border-gray-400 font-semibold mb-6 pt-1 text-xl text-gray-500">Join a course</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {courseOps
                .courseCatalog()
                .filter((catalogEntry) => !enrollments.has(catalogEntry.id))
                .map((catalogEntry) => (
                  <CourseCard user={user} key={catalogEntry.id} catalogEntry={catalogEntry} select={() => addEnrollment(catalogEntry)} />
                ))}
            </div>
          </div>
        )}
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
