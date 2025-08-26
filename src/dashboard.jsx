import React, { useState } from 'react';

export default function Dashboard({ user }) {
  const courseList = user.courses
    ? Object.entries(user.courses).map(([id, course]) => ({
        id,
        ...course,
      }))
    : [];

  return (
    <div className="max-w-4xl mx-auto mt-10 p-8 bg-white rounded-2xl shadow-lg">
      <h1 className="font-bold text-3xl mb-2">Welcome, {user.name}!</h1>
      <h2 className="font-medium text-xl text-gray-600 mb-6">Your Courses</h2>
      {courseList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {courseList.map((course) => (
            <div key={course.id} className="flex flex-col items-center p-6 rounded-xl bg-gray-50 shadow-md min-h-[280px]">
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
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-base">You are not enrolled in any courses.</div>
      )}
    </div>
  );
}
