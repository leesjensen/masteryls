import React from 'react';
import AttendanceCodeEntry from './attendanceCodeEntry.jsx';
import LearnerAttendanceChart from './learnerAttendanceChart.jsx';

// Learner Attendance view: check in with the class code and see attendance history.
export default function AttendanceLearner({ courseOps, course, user }) {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const sectionId = courseOps.getCurrentSectionId?.();
  const sectionName = course.sections?.find((section) => section.id === sectionId)?.title || 'Your assigned section';

  return (
    <div className="h-full w-full overflow-auto p-4">
      <div className="w-full max-w-7xl mx-auto space-y-4">
        <AttendanceCodeEntry courseOps={courseOps} courseId={course.id} sectionName={sectionName} onRecorded={() => setRefreshKey((key) => key + 1)} />
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-base font-semibold text-gray-800 mb-2">Your attendance</h2>
          <LearnerAttendanceChart courseOps={courseOps} course={course} userId={user.id} sectionId={sectionId} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
