import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import AttendanceResponses from './attendanceResponses.jsx';
import { formatSessionDate } from './attendanceUtils.js';

// Attendance sessions, newest first. Selecting one shows who checked in and their answers.
export default function AttendanceSessionList({ courseOps, courseId, sessions }) {
  const [selectedId, setSelectedId] = React.useState(null);
  const ordered = [...sessions].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));

  if (ordered.length === 0) return null;

  return (
    <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md bg-white" data-testid="attendance-session-list">
      {ordered.map((session) => {
        const selected = session.id === selectedId;
        return (
          <li key={session.id}>
            <button type="button" onClick={() => setSelectedId(selected ? null : session.id)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50">
              <span className="flex items-center gap-2 text-gray-800">
                {selected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {formatSessionDate(session.openedAt)}
                {!session.closedAt && <span className="text-xs font-semibold text-emerald-600">Open</span>}
              </span>
              <span className="text-gray-600">
                {session.attendeeCount} present
              </span>
            </button>
            {selected && (
              <div className="px-3 pb-3">
                <AttendanceResponses courseOps={courseOps} courseId={courseId} session={session} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
