import React, { useState } from 'react';
import { useAlert } from '../../contexts/AlertContext.jsx';

export default function CourseLinkForm({ courseOps, onClose }) {
  const [canvasCourseId, setCanvasCourseId] = useState('');
  const [course, setCourse] = useState();
  const [selectedScheduleFileId, setSelectedScheduleFileId] = useState('');
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [onlyLinkAssignments, setOnlyLinkAssignments] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState('Linking Your Course');
  const [updateMessage, setUpdateMessage] = useState('Initializing');
  const { showAlert } = useAlert();

  async function selectCourse(courseId) {
    const course = await courseOps.getCourse(courseId);
    setCourse(course);
    const scheduleFiles = Array.isArray(course?.schedule?.files) ? course.schedule.files : [];
    const persistedScheduleId = course?.externalRefs?.canvasScheduleFileId;
    const persistedSchedule = persistedScheduleId ? scheduleFiles.find((file) => file.id === persistedScheduleId) : null;
    const defaultSchedule = scheduleFiles.find((file) => file.default) || scheduleFiles[0];
    setSelectedScheduleFileId((persistedSchedule || defaultSchedule)?.id || '');
    if (course.externalRefs?.canvasCourseId) {
      setCanvasCourseId(course.externalRefs.canvasCourseId);
    } else {
      setCanvasCourseId('');
    }
  }

  async function beginLink() {
    setLoadingTitle('Linking Your Course');
    setIsLoading(true);
    try {
      setUpdateMessage('Linking course...');
      await courseOps.linkToCanvas(course, canvasCourseId, deleteExisting, setUpdateMessage, selectedScheduleFileId || null, onlyLinkAssignments);
      showAlert({ message: `${course.title} linked successfully`, type: 'info' });
    } catch (error) {
      showAlert({ message: `Error linking course: ${error.message}`, type: 'error' });
    }
    setIsLoading(false);
  }

  async function repairRefs() {
    setLoadingTitle('Repairing Course Links');
    setIsLoading(true);
    try {
      setUpdateMessage('Repairing references...');
      await courseOps.repairCanvas(course, canvasCourseId, setUpdateMessage);
      showAlert({ message: `${course.title} repaired successfully`, type: 'info' });
    } catch (error) {
      showAlert({ message: `Error repairing course references: ${error.message}`, type: 'error' });
    }
    setIsLoading(false);
  }

  async function unlinkCourse() {
    if (!course?.externalRefs?.canvasCourseId) {
      return;
    }

    if (!window.confirm(`Unlink '${course.title}' from Canvas?`)) {
      return;
    }

    setLoadingTitle('Unlinking Your Course');
    setIsLoading(true);
    try {
      setUpdateMessage('Unlinking course...');
      await courseOps.unlinkFromCanvas(course, deleteExisting, setUpdateMessage);
      const updatedCourse = await courseOps.getCourse(course.id);
      setCourse(updatedCourse);
      setCanvasCourseId('');
      showAlert({ message: `${course.title} unlinked successfully`, type: 'info' });
    } catch (error) {
      showAlert({ message: `Error unlinking course: ${error.message}`, type: 'error' });
    }
    setIsLoading(false);
  }

  function viewCanvas() {
    const url = `https://byu.instructure.com/courses/${canvasCourseId}`;
    window.open(url, '_blank');
  }

  function viewCourse() {
    const url = `/course/${course.id}`;
    window.open(url, '_blank');
  }

  function openSchedulePage(event) {
    event.preventDefault();

    if (!course?.id) {
      return;
    }

    if (selectedScheduleFileId) {
      courseOps.saveEnrollmentUiSettings(course.id, { selectedScheduleFile: selectedScheduleFileId });
    }

    window.open(`/course/${course.id}/schedule`, '_blank');
  }

  const scheduleFiles = Array.isArray(course?.schedule?.files) ? course.schedule.files : [];
  const selectedSchedule = scheduleFiles.find((file) => file.id === selectedScheduleFileId) || scheduleFiles[0];
  const selectedScheduleTitle = selectedSchedule?.title || selectedSchedule?.path || 'No schedule selected';

  return (
    <>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
          {/* Spinner */}
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-amber-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-amber-300 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>

          {/* Loading Message */}
          <div className="space-y-2 text-center">
            <h3 className="text-2xl font-semibold text-gray-800">{loadingTitle}</h3>
            <p className="text-xl text-gray-600 animate-pulse">{updateMessage}</p>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center space-x-2 mt-4">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      )}
      <div className="px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-800">Link a Course</h2>
        <p className="text-sm text-gray-500 mt-1">Link all modules, assignments, and topics to a Canvas course.</p>
        <p className="text-sm text-gray-500 mt-2">
          <b>Note: </b>This will not create a Canvas course, only link the MasteryLS course to the Canvas course.
        </p>
      </div>

      <form className="p-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="course-title" className="block text-lg font-medium text-gray-700 mb-1">
            Course
          </label>
          <select id="course-title" name="title" required onChange={(e) => selectCourse(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
            <option value="">Select a course</option>
            {courseOps.courseCatalog().map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="course-name" className="block text-lg font-medium text-gray-700 mb-1">
            Canvas course ID
          </label>
          <input id="course-name" name="name" value={canvasCourseId} onChange={(e) => setCanvasCourseId(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="Canvas course ID (e.g. 12345)" />
          <div className="mt-3 flex items-center space-x-2">
            <input id="delete-existing" type="checkbox" checked={deleteExisting} onChange={(e) => setDeleteExisting(e.target.checked)} className="rounded border-gray-300 text-amber-500 focus:ring-amber-300" />
            <label htmlFor="delete-existing" className="text-sm text-gray-700">
              Delete existing pages, quizzes, assignments, and modules
            </label>
          </div>
          <div className="mt-3 flex items-center space-x-2">
            <input id="only-link-assignments" type="checkbox" checked={onlyLinkAssignments} onChange={(e) => setOnlyLinkAssignments(e.target.checked)} className="rounded border-gray-300 text-amber-500 focus:ring-amber-300" />
            <label htmlFor="only-link-assignments" className="text-sm text-gray-700">
              Only link assignments
            </label>
          </div>
        </div>

        {scheduleFiles.length > 0 && (
          <div>
            <label htmlFor="schedule-file" className="block text-lg font-medium text-gray-700 mb-1">
              Schedule for due dates
            </label>
            <select id="schedule-file" value={selectedScheduleFileId} onChange={(e) => setSelectedScheduleFileId(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
              {scheduleFiles.map((file) => (
                <option key={file.id || file.path} value={file.id || ''}>
                  {file.title || file.path}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
              <span>
                Due dates source:{' '}
                {course?.id ? (
                  <a href={`/course/${course.id}/schedule`} target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800" onClick={openSchedulePage}>
                    {selectedScheduleTitle}
                  </a>
                ) : (
                  <strong>{selectedScheduleTitle}</strong>
                )}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Exam and project due dates will be read from the selected schedule file.</p>
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
            Cancel
          </button>

          <button disabled={!course || !canvasCourseId} className={`px-4 py-2 rounded-md text-white font-semibold text-sm shadow bg-amber-400 hover:bg-amber-500 disabled:bg-gray-300 disabled:cursor-not-allowed`} onClick={beginLink}>
            {course?.externalRefs?.canvasCourseId ? 'Re-link course' : 'Link course'}
          </button>
          <button disabled={!course || !canvasCourseId} className={`px-4 py-2 rounded-md text-white font-semibold text-sm shadow bg-slate-400 hover:bg-slate-500 disabled:bg-gray-300 disabled:cursor-not-allowed`} onClick={repairRefs}>
            Repair
          </button>
          <button disabled={!course || !canvasCourseId} className={`px-4 py-2 rounded-md text-white font-semibold text-sm shadow bg-slate-400 hover:bg-slate-500 disabled:bg-gray-300 disabled:cursor-not-allowed`} onClick={viewCanvas}>
            View Canvas
          </button>
          <button disabled={!course || !canvasCourseId} className={`px-4 py-2 rounded-md text-white font-semibold text-sm shadow bg-slate-400 hover:bg-slate-500 disabled:bg-gray-300 disabled:cursor-not-allowed`} onClick={viewCourse}>
            View Course
          </button>
          <button disabled={!course?.externalRefs?.canvasCourseId} className={`px-4 py-2 rounded-md text-white font-semibold text-sm shadow bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed`} onClick={unlinkCourse}>
            Unlink course
          </button>
        </div>
      </form>
    </>
  );
}
