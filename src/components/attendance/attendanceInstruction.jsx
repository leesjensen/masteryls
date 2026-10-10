import React from 'react';
import AttendanceAdmin from './attendanceAdmin.jsx';
import AttendanceLearner from './attendanceLearner.jsx';

export default function AttendanceInstruction({ courseOps, learningSession, user }) {
  const course = learningSession.course;
  if (!user || !course) return null;

  if (user.canOverseeCourse(course.id)) {
    return <AttendanceAdmin courseOps={courseOps} course={course} />;
  }
  return <AttendanceLearner courseOps={courseOps} course={course} user={user} />;
}
