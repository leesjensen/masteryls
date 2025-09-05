import React, { useState } from 'react';
import CourseForm from './courseForm';
import CourseCard from './courseCard';

export default function Dashboard({ service, user, setUser, loadCourse }) {
  const [enrollments, setEnrollments] = useState();
  const [createCourse, setCreateCourse] = useState(false);

  React.useEffect(() => {
    service.enrollments(user.id).then(setEnrollments);
  }, [user.id]);

  const logout = () => {
    setUser(null);
    service.logout();
  };

  const addEnrollment = async (catalogEntry) => {
    if (!enrollments.has(catalogEntry.id)) {
      const newEnrollment = await service.createEnrollment(user.id, catalogEntry);
      setEnrollments((prev) => new Map(prev).set(catalogEntry.id, newEnrollment));
    }
  };

  const removeEnrollment = async (enrollment) => {
    // if (enrollment.catalogEntry?.ownerId === user.id) {
    //   await service.removeCourse(enrollment.catalogId);
    //   await service.removeGitHubRepo(enrollment.catalogEntry.gitHub);
    // } else {
    await service.removeEnrollment(enrollment);
    // }
    setEnrollments((prev) => {
      const newEnrollments = new Map(prev);
      newEnrollments.delete(enrollment.catalogId);
      return newEnrollments;
    });
  };

  const onCreateCourse = async (catalogEntry, gitHubToken) => {
    try {
      const newCourse = await service.createCourse(catalogEntry, gitHubToken);
      const newEnrollment = await service.createEnrollment(user.id, newCourse, gitHubToken);

      setEnrollments((prev) => new Map(prev).set(newCourse.id, newEnrollment));

      setCreateCourse(false);
    } catch (error) {
      alert(`Error creating course: ${error.message}`);
    }
  };

  if (createCourse) {
    return (
      <CourseForm onClose={() => setCreateCourse(false)} onCreate={onCreateCourse}>
        create a course!
      </CourseForm>
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
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div>
          <h1 className="font-bold text-3xl mb-2">Welcome {user.name}!</h1>
        </div>
        <div className="flex justify-between mb-6">
          <button onClick={() => setCreateCourse(true)} className="mx-2 px-4 py-2 bg-white text-gray-800 rounded-lg shadow hover:bg-gray-100 transition-colors">
            <span className="font-semibold text-amber-600">+</span> Course
          </button>
          <button onClick={logout} className="mx-2 px-4 py-2 bg-white text-gray-800 rounded-lg shadow hover:bg-gray-100 transition-colors">
            Logout
          </button>
        </div>
      </div>
      <h2 className="border-t-2 border-gray-400 font-semibold mb-6 pt-1 text-xl text-gray-500">Your courses</h2>
      {enrollments.size > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {Array.from(enrollments.values()).map((enrollment) => {
            return <CourseCard user={user} key={enrollment.id} catalogEntry={enrollment.catalogEntry} enrollment={enrollment} select={() => loadCourse(enrollment)} remove={() => removeEnrollment(enrollment)} />;
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
