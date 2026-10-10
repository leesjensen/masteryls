import React, { useState } from 'react';
import { DEFAULT_ATTENDANCE_POINTS_PER_SESSION, DEFAULT_ATTENDANCE_POINTS_POSSIBLE } from '../../hooks/canvas/attendanceCanvasSync.js';

// Course link section for the Canvas "Attendance" assignment. Shown only when attendance is enabled
// in the course settings. Learners earn pointsPerSession for each class attended, up to pointsPossible.
export default function AttendanceAssignmentSection({ course, onCreate }) {
  const [pointsPerSession, setPointsPerSession] = useState(DEFAULT_ATTENDANCE_POINTS_PER_SESSION);
  const [pointsPossible, setPointsPossible] = useState(DEFAULT_ATTENDANCE_POINTS_POSSIBLE);

  if (!course?.settings?.attendance) {
    return null;
  }

  const canvasCourseId = course.externalRefs?.canvasCourseId;
  const attendanceRefs = course.externalRefs?.attendance;
  const assignmentUrl = canvasCourseId && attendanceRefs?.canvasAssignmentId ? `https://byu.instructure.com/courses/${canvasCourseId}/assignments/${attendanceRefs.canvasAssignmentId}` : null;
  const validPoints = Number(pointsPerSession) > 0 && Number(pointsPossible) > 0;

  return (
    <div>
      <label className="block text-lg font-medium text-gray-700 mb-1">Attendance assignment</label>
      {attendanceRefs?.canvasAssignmentId ? (
        <>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 text-gray-500">Assignment</span>
              <input readOnly value="Attendance" className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 text-gray-500">Points</span>
              <input readOnly value={`${attendanceRefs.pointsPerSession} per class, ${attendanceRefs.pointsPossible} possible`} className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
            <span>
              Linked assignment:{' '}
              {assignmentUrl ? (
                <a href={assignmentUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800">
                  Attendance
                </a>
              ) : (
                <strong>Attendance</strong>
              )}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Learners' attendance points are posted to this assignment each time they check in to class.</p>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-2">Create a Canvas assignment that awards points each time a learner checks in to class.</p>
          <div className="flex flex-wrap items-center gap-3 mb-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-gray-600">Points per class</span>
              <input type="number" min="1" aria-label="Points per class" value={pointsPerSession} onChange={(e) => setPointsPerSession(e.target.value)} className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-gray-600">Points possible</span>
              <input type="number" min="1" aria-label="Points possible" value={pointsPossible} onChange={(e) => setPointsPossible(e.target.value)} className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm" />
            </label>
          </div>
          <button
            type="button"
            disabled={!canvasCourseId || !validPoints}
            onClick={() =>
              onCreate({
                pointsPerSession: Number(pointsPerSession),
                pointsPossible: Number(pointsPossible),
              })
            }
            className="px-4 py-2 rounded-md text-white font-semibold text-sm shadow bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Create attendance assignment
          </button>
          {!canvasCourseId && <p className="text-xs text-gray-400 mt-1">Link the course to Canvas first.</p>}
        </>
      )}
    </div>
  );
}
