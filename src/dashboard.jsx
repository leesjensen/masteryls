import React, { useState } from 'react';

export default function Dashboard({ user, setUser, setCourse }) {
  const [selectedCourseId, setSelectedCourseId] = useState(null);

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const viewCourse = (courseId) => {
    setSelectedCourseId(courseId);
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-8 bg-white">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-bold text-3xl mb-2">Welcome, {user.name}!</h1>
          <h2 className="font-medium text-xl text-gray-600">Your Courses</h2>
        </div>
        <button onClick={logout} className="px-4 py-2 bg-white text-gray-800 rounded-lg shadow hover:bg-gray-100 transition-colors">
          Logout
        </button>
      </div>
      {user.courses && user.courses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {user.courses.map((course) => {
            const isSelected = selectedCourseId === course.id;
            return (
              <button key={course.id} type="button" onClick={() => viewCourse(course.id)} className={`flex flex-col items-center p-6 rounded-xl bg-gray-50 shadow-md min-h-[280px] transition-transform duration-200 focus:outline-none ${isSelected ? 'ring-4 ring-blue-400 scale-105' : 'hover:scale-105 hover:shadow-lg'}`} style={{ cursor: 'pointer' }}>
                <div className="w-full h-32 rounded-lg mb-4 flex items-center justify-center bg-amber-500">
                  <span className="text-white text-xl font-bold">{course.title[0]}</span>
                </div>
                <div className="text-lg font-semibold mb-2 text-center">{course.title}</div>
                <div className="text-gray-500 text-sm mb-3 text-center">{course.description}</div>
                <div className="w-full mt-auto">
                  <div className="text-xs text-gray-700 mb-1">Progress</div>
                  <div className="bg-blue-100 rounded h-2 w-full mb-1 overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${course.progress}%` }} />
                  </div>
                  <div className="text-xs text-gray-400">{course.progress}% complete</div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-gray-400 text-base">You are not enrolled in any courses.</div>
      )}
    </div>
  );
}
