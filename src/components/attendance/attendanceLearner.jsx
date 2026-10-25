import React from 'react';
import AttendanceCodeEntry from './attendanceCodeEntry.jsx';
import LearnerAttendanceChart from './learnerAttendanceChart.jsx';

// Learner Attendance view: check in with the class code and see attendance history.
export default function AttendanceLearner({ courseOps, course, user }) {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const sectionId = courseOps.getCurrentSectionId?.();
  const sectionName = course.sections?.find((section) => section.id === sectionId)?.title || 'Your assigned section';

  return (
    <div className="h-full w-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <AttendanceCodeEntry courseOps={courseOps} courseId={course.id} sectionName={sectionName} onRecorded={() => setRefreshKey((key) => key + 1)} />
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Your attendance</div>
          <LearnerAttendanceChart courseOps={courseOps} course={course} userId={user.id} sectionId={sectionId} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
