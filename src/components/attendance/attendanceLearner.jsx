import React from 'react';
import AttendanceCodeEntry from './attendanceCodeEntry.jsx';
import LearnerAttendanceChart from './learnerAttendanceChart.jsx';

// Learner Attendance view: check in with the class code and see attendance history.
export default function AttendanceLearner({ courseOps, course, user }) {
  const [refreshKey, setRefreshKey] = React.useState(0);

  return (
    <div className="h-full w-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <AttendanceCodeEntry courseOps={courseOps} courseId={course.id} onRecorded={() => setRefreshKey((key) => key + 1)} />
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Your attendance</div>
          <LearnerAttendanceChart courseOps={courseOps} course={course} userId={user.id} sectionId={courseOps.getCurrentSectionId?.()} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
