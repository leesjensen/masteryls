import React, { useState } from 'react';

export default function Dashboard({ service, user, setUser, loadCourse }) {
  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const viewCourse = (enrollment) => {
    loadCourse(enrollment);
  };

  const addEnrollment = (enrollment) => {
    if (!service.isEnrolled(enrollment.courseInfo.id)) {
      const enrollments = service.saveEnrollment(enrollment);
      setEnrollments(enrollments);
    }
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
      {user.courses && user.courses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {user.courses.map((uc) => {
            const course = getCourseInfo(uc.id);
            if (!course) return null;
            return <CourseCard key={course.id} course={{ ...course, progress: uc.progress }} setSelected={viewCourse} />;
          })}
        </div>
      ) : (
        <div className="text-gray-400 text-base m-4">You are not enrolled in any courses. Select one below to get started.</div>
      )}

      {!allEnrolled() && (
        <div className="my-8">
          <h2 className="border-t-2 border-gray-400 font-semibold mb-6 pt-1 text-xl text-gray-500">Join a course</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {config.courses
              .filter((course) => !isEnrolled(course.id))
              .map((course) => (
                <CourseCard key={course.id} course={course} setSelected={addCourse} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CourseCard({ course, setSelected }) {
  const enrolled = course?.progress >= 0;
  return (
    <button key={course.id} type="button" onClick={() => setSelected(course)} className="flex flex-col items-center p-6 rounded-xl bg-gray-50 shadow-md min-h-[280px] transition-transform duration-200 focus:outline-none hover:scale-105 hover:shadow-lg" style={{ cursor: 'pointer' }}>
      <div className={`h-32 w-32 rounded-lg mb-4 flex items-center justify-center ${enrolled ? 'bg-amber-500' : 'bg-gray-300'}`}>
        <span className="text-white text-xl font-bold">{course.title[0]}</span>
      </div>
      <div className="text-lg font-semibold mb-2 text-center">{course.title}</div>
      <div className="text-gray-500 text-sm mb-3 text-center">{course.description}</div>
      {enrolled && (
        <div className="w-full mt-auto">
          <div className="text-xs text-gray-700 mb-1">Progress</div>
          <div className="bg-blue-100 rounded h-2 w-full mb-1 overflow-hidden">
            <div className="bg-blue-500 h-full" style={{ width: `${course.progress}%` }} />
          </div>
          <div className="text-xs text-gray-400">{course.progress}% complete</div>
        </div>
      )}
    </button>
  );
}
