import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import CourseExportForm from './courseExportForm.jsx';
import { useAlert } from '../../contexts/AlertContext.jsx';

export default function CourseExportView({ courseOps }) {
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  const create = async (courseId, canvasCourseId, setUpdateMessage) => {
    try {
      const course = await courseOps.getCourse(courseId);
      await courseOps.exportToCanvas(course, canvasCourseId, setUpdateMessage);
      navigate('/dashboard');
      showAlert({ message: `${course.title} exported successfully`, type: 'info' });
    } catch (error) {
      showAlert({ message: `Error exporting course: ${error.message}`, type: 'error' });
    }
  };

  const close = () => {
    navigate('/dashboard');
  };

  const appBarTools = (
    <button title="Close course export" onClick={close} className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-xs bg-white border border-gray-300 filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out">
      ❌
    </button>
  );

  useEffect(() => {
    updateAppBar({ title: 'Export course', tools: appBarTools });
  }, []);

  return (
    <>
      <div className="flex-1 m-6 flex flex-col bg-white">
        <CourseExportForm courseOps={courseOps} onClose={close} onCreate={create} />
      </div>
    </>
  );
}
