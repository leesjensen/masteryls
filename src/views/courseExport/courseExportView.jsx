import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import CourseExportForm from './courseExportForm.jsx';

export default function CourseExportView({ courseOps }) {
  const navigate = useNavigate();

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
        <CourseExportForm courseOps={courseOps} onClose={close} />
      </div>
    </>
  );
}
