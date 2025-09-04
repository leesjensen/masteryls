import React, { useState } from 'react';
import CourseForm from './courseForm';

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

function CourseCard({ user, catalogEntry, enrollment, select, remove }) {
  return (
    <div className="grid">
      <button key={catalogEntry.id} type="button" onClick={() => select(catalogEntry)} className="col-start-1 row-start-1 flex flex-col items-center p-6 rounded-xl bg-gray-50 shadow-md min-h-[280px] transition-transform duration-200 focus:outline-none hover:scale-102 hover:shadow-lg cursor-pointer">
        <div className={`h-32 w-32 rounded-lg mb-4 flex items-center justify-center ${enrollment ? 'bg-amber-500' : 'bg-gray-300'}`}>
          <span className="text-white text-xl font-bold">{catalogEntry.title[0]}</span>
        </div>

        <div className="text-lg font-semibold mb-2 text-center">{catalogEntry.title}</div>
        <div className="text-gray-500 text-sm mb-3 text-center overflow-hidden text-ellipsis whitespace-normal line-clamp-3">{catalogEntry.description}</div>

        {enrollment && (
          <div className="w-full mt-auto">
            <div className="text-xs text-gray-700 mb-1">Progress</div>
            <div className="bg-blue-100 rounded h-2 w-full mb-1 overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${enrollment.progress.mastery}%` }} />
            </div>
            <div className="text-xs text-gray-400">{enrollment.progress.mastery}% complete</div>
          </div>
        )}
      </button>

      {enrollment && remove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            remove(enrollment);
          }}
          aria-label="Delete"
          className="col-start-1 row-start-1 justify-self-end -translate-y-3 translate-x-3 
             inline-flex items-center justify-center w-7 h-7 rounded-full bg-white text-gray-600 text-xs shadow 
             hover:text-gray-50 hover:bg-red-500 focus:outline-none"
          title="Remove enrollment"
        >
          ✕
        </button>
      )}

      {enrollment && (enrollment.ui?.token || enrollment.catalogEntry?.ownerId === user.id) && (
        <div
          className="col-start-1 row-start-1 justify-self-end -translate-y-3 -translate-x-6 
             inline-flex items-center justify-center w-7 h-7 rounded-full bg-white text-gray-600 text-xs shadow cursor-default
            "
        >
          <span title="editor rights" className="text-lg text-yellow-400">
            {enrollment.catalogEntry?.ownerId === user.id ? '★' : '✏️'}
          </span>
        </div>
      )}
    </div>
  );
}
