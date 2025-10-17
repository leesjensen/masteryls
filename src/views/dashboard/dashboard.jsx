import React, { useState, useRef } from 'react';
import CourseCreationForm from './courseCreationForm.jsx';
import CourseCard from './courseCard';
import ConfirmDialog from '../../hooks/confirmDialog.jsx';
import Metrics from '../metrics/metrics.jsx';
import { useAlert } from '../../contexts/AlertContext.jsx';

export default function Dashboard({ courseOps, service, user }) {
  const [enrollments, setEnrollments] = useState();
  const [displayCourseCreationForm, setDisplayCourseCreationForm] = useState(false);
  const [displayMetrics, setDisplayMetrics] = useState(false);
  const [pendingEnrollmentRemoval, setPendingEnrollmentRemoval] = useState(null);
  const [showUser, setShowUser] = useState(false);
  const dialogRef = useRef(null);
  const { showAlert } = useAlert();

  React.useEffect(() => {
    if (user) {
      service.enrollments(user.id).then(setEnrollments);
    }
  }, [user]);

  const addEnrollment = async (catalogEntry) => {
    if (!enrollments.has(catalogEntry.id)) {
      const newEnrollment = await service.createEnrollment(user.id, catalogEntry);
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

  const createCourse = async (generateWithAi, sourceAccount, sourceRepo, catalogEntry, gitHubToken, setUpdateMessage) => {
    try {
      if (await service.verifyGitHubAccount(gitHubToken)) {
        const enrollment = await courseOps.createCourse(generateWithAi, sourceAccount, sourceRepo, catalogEntry, gitHubToken, setUpdateMessage);
        setEnrollments((prev) => new Map(prev).set(enrollment.catalogEntry.id, enrollment));
        setDisplayCourseCreationForm(false);
      } else {
        showAlert({ message: 'The provided GitHub token does not have the necessary permissions to create a course.', type: 'error' });
      }
    } catch (error) {
      showAlert({ message: `Error creating course: ${error.message}`, type: 'error' });
    }
  };

  if (displayCourseCreationForm) {
    return <CourseCreationForm service={service} onClose={() => setDisplayCourseCreationForm(false)} onCreate={createCourse} />;
  }

  if (displayMetrics) {
    return <Metrics courseOps={courseOps} setDisplayMetrics={setDisplayMetrics} />;
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen">
        <div className="m-auto text-gray-400">Please log in to access your dashboard.</div>
      </div>
    );
  }

  if (!enrollments) {
    return (
      <div className="flex flex-col h-screen">
        <div className="m-auto text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-6 p-8 bg-white">
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
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div>
          <h1 className="font-bold text-3xl mb-2 flex items-center justify-left">
            {user.isRoot() && (
              <span title="root rights" className="text-lg text-yellow-400 mr-1">
                ★
              </span>
            )}
            <a onClick={() => setShowUser(!showUser)}>{user.name}'s dashboard</a>
          </h1>
        </div>
        <div className="flex justify-between mb-6">
          {user.isRoot() && (
            <>
              <button onClick={() => setDisplayCourseCreationForm(true)} className="mx-2 px-4 py-2 bg-white text-gray-800 rounded-lg shadow hover:bg-gray-100 transition-colors">
                <span className="font-semibold text-amber-600">+</span> Course
              </button>
              <button onClick={() => setDisplayMetrics(true)} className="mx-2 px-4 py-2 bg-white text-gray-800 rounded-lg shadow hover:bg-gray-100 transition-colors">
                Metrics
              </button>
            </>
          )}
          <button onClick={courseOps.logout} className="mx-2 px-4 py-2 bg-white text-gray-800 rounded-lg shadow hover:bg-gray-100 transition-colors">
            Logout
          </button>
        </div>
      </div>
      {showUser && <pre className="text-gray-400 text-[12px]">{JSON.stringify(user, null, 2)}</pre>}
      <h2 className="border-t-2 border-gray-400 font-semibold mb- pt-1 text-xl text-gray-500">Your courses</h2>
      {enrollments.size > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {Array.from(enrollments.values()).map((enrollment) => {
            return <CourseCard user={user} key={enrollment.id} catalogEntry={enrollment.catalogEntry} enrollment={enrollment} select={() => courseOps.loadCourse(enrollment)} remove={() => requestedEnrollmentRemoval(enrollment)} />;
          })}
        </div>
      ) : (
        <div className="text-gray-400 text-base m-4">You are not enrolled in any courses. Select one below to get started.</div>
      )}

      {!service.allEnrolled(enrollments) && (
        <div className="my-8">
          <h2 className="border-t-2 border-gray-400 font-semibold mb-6 pt-1 text-xl text-gray-500">Join a course</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {service
              .courseCatalog()
              .filter((catalogEntry) => !enrollments.has(catalogEntry.id))
              .map((catalogEntry) => (
                <CourseCard user={user} key={catalogEntry.id} catalogEntry={catalogEntry} select={() => addEnrollment(catalogEntry)} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
