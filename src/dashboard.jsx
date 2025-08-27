import React, { useState } from 'react';

export default function Dashboard({ service, user, setUser, loadCourse }) {
  const [enrollments, setEnrollments] = useState(service.enrollments());

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const addEnrollment = (courseInfo) => {
    if (!enrollments.has(courseInfo.id)) {
      const [, enrollments] = service.createEnrollment(courseInfo);
      setEnrollments(enrollments);
    }
  };

  const removeEnrollment = (enrollment) => {
    setEnrollments(service.removeEnrollment(enrollment.id));
  };

  return (
    <div className="max-w-4xl mx-auto mt-6 p-8 bg-white">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-bold text-3xl mb-2">Welcome {user.name}!</h1>
        </div>
        <button onClick={logout} className="px-4 py-2 bg-white text-gray-800 rounded-lg shadow hover:bg-gray-100 transition-colors">
          Logout
        </button>
      </div>
      <h2 className="border-t-2 border-gray-400 font-semibold mb-6 pt-1 text-xl text-gray-500">Your courses</h2>
      {enrollments.size > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {Array.from(enrollments.values()).map((enrollment) => {
            return <CourseCard key={enrollment.id} courseInfo={enrollment.courseInfo} enrollment={enrollment} select={() => loadCourse(enrollment)} remove={() => removeEnrollment(enrollment)} />;
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
              .courses()
              .filter((courseInfo) => !enrollments.has(courseInfo.id))
              .map((courseInfo) => (
                <CourseCard key={courseInfo.id} courseInfo={courseInfo} select={() => addEnrollment(courseInfo)} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CourseCard({ courseInfo, enrollment, select, remove }) {
  return (
    <button key={courseInfo.id} type="button" onClick={() => select(courseInfo)} className="relative flex flex-col items-center p-6 rounded-xl bg-gray-50 shadow-md min-h-[280px] transition-transform duration-200 focus:outline-none hover:scale-105 hover:shadow-lg cursor-pointer">
      <div className={`h-32 w-32 rounded-lg mb-4 flex items-center justify-center ${enrollment ? 'bg-amber-500' : 'bg-gray-300'}`}>
        <span className="text-white text-xl font-bold">{courseInfo.title[0]}</span>
      </div>
      <div className="text-lg font-semibold mb-2 text-center">{courseInfo.title}</div>
      <div className="text-gray-500 text-sm mb-3 text-center">{courseInfo.description}</div>
      {enrollment && (
        <div className="w-full mt-auto">
          <div className="text-xs text-gray-700 mb-1">Progress</div>
          <div className="bg-blue-100 rounded h-2 w-full mb-1 overflow-hidden">
            <div className="bg-blue-500 h-full" style={{ width: `${enrollment.progress.mastery}%` }} />
          </div>
          <div className="text-xs text-gray-400">{enrollment.progress.mastery}% complete</div>
        </div>
      )}
      {remove && (
        <div onClick={() => remove(enrollment)} className="absolute top-2 right-2 px-2 py-1 bg-gray-100 text-white text-xs rounded hover:bg-gray-200 flex items-center gap-1">
          <span role="img" aria-label="Delete">
            ❌
          </span>
        </div>
      )}
    </button>
  );
}
