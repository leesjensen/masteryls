import React, { useState } from 'react';
import { useAlert } from '../../contexts/AlertContext.jsx';

export default function CourseExportForm({ courseOps, onClose }) {
  const [canvasCourseId, setCanvasCourseId] = useState('');
  const [course, setCourse] = useState();
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('Initializing');
  const { showAlert } = useAlert();

  async function selectCourse(courseId) {
    const course = await courseOps.getCourse(courseId);
    setCourse(course);
    if (course.externalRefs?.canvasCourseId) {
      setCanvasCourseId(course.externalRefs.canvasCourseId);
    } else {
      setCanvasCourseId('');
    }
  }

  async function beginExport() {
    setIsLoading(true);
    try {
      setUpdateMessage('Exporting course...');
      await courseOps.exportToCanvas(course, canvasCourseId, deleteExisting, setUpdateMessage);
      showAlert({ message: `${course.title} exported successfully`, type: 'info' });
      onClose();
    } catch (error) {
      showAlert({ message: `Error exporting course: ${error.message}`, type: 'error' });
    }
    setIsLoading(false);
  }

  async function repairRefs() {
    setIsLoading(true);
    try {
      setUpdateMessage('Repairing references...');
      await courseOps.repairCanvas(course, canvasCourseId, setUpdateMessage);
      showAlert({ message: `${course.title} repaired successfully`, type: 'info' });
      //      onClose();
    } catch (error) {
      showAlert({ message: `Error exporting course: ${error.message}`, type: 'error' });
    }
    setIsLoading(false);
  }

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
            <h3 className="text-2xl font-semibold text-gray-800">Exporting Your Course</h3>
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
        <h2 className="text-xl font-semibold text-gray-800">Export a Course</h2>
        <p className="text-sm text-gray-500 mt-1">Export all modules and topics to a Canvas course.</p>
        <p className="text-sm text-gray-500 mt-2">
          <b>Note: </b>This will not create the course, only export the MasteryLS content to the Canvas course.
        </p>
      </div>

      <form className="p-6 space-y-4">
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
              Delete existing pages and modules
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
            Cancel
          </button>

          <button disabled={!course || course.externalRefs?.canvasCourseId || !canvasCourseId} className={`px-4 py-2 rounded-md text-white font-semibold text-sm shadow bg-amber-400 hover:bg-amber-500 disabled:bg-gray-300 disabled:cursor-not-allowed`} onClick={beginExport}>
            Export course
          </button>
          <button disabled={!course || !canvasCourseId} className={`px-4 py-2 rounded-md text-white font-semibold text-sm shadow bg-slate-400 hover:bg-slate-500 disabled:bg-gray-300 disabled:cursor-not-allowed`} onClick={repairRefs}>
            Repair
          </button>
        </div>
      </form>
    </>
  );
}
