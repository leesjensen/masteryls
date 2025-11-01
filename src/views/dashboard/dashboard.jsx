import React, { useState, useRef } from 'react';
import CourseCreationForm from './courseCreationForm.jsx';
import CourseCard from './courseCard';
import ConfirmDialog from '../../hooks/confirmDialog.jsx';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../../contexts/AlertContext.jsx';
import { updateAppBar } from '../../hooks/useAppBarState';

export default function Dashboard({ courseOps, service, user }) {
  const [enrollments, setEnrollments] = useState();
  const [displayCourseCreationForm, setDisplayCourseCreationForm] = useState(false);
  const [pendingEnrollmentRemoval, setPendingEnrollmentRemoval] = useState(null);
  const dialogRef = useRef(null);
  const { showAlert } = useAlert();
  const navigate = useNavigate();

  const appBarTools = (
    <div>
      <button title="New course" onClick={() => navigate('/create-course')} className="w-6 m-0.5 p-0.5 text-xs font-bold rounded-xs bg-white border border-gray-300 filter grayscale hover:text-blue-400 hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out">
        +
      </button>
      <button title="Progress" onClick={() => navigate('/progress')} className="w-6 m-0.5 p-0.5 text-xs font-bold rounded-xs bg-white border border-gray-300 filter grayscale hover:text-blue-400 hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out">
        🏅
      </button>
      <button title="Metrics" onClick={() => navigate('/metrics')} className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-xs bg-white border border-gray-300 filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out">
        📊
      </button>
      <button title="Logout" onClick={courseOps.logout} className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-xs bg-white border border-gray-300 filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out">
        ⏻
      </button>
    </div>
  );

  React.useEffect(() => {
    if (user) {
      updateAppBar(`${user.name}'s Dashboard`, appBarTools);
      service.enrollments(user.id).then(setEnrollments);
    } else {
      navigate('/');
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

  if (!user || !enrollments) {
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
