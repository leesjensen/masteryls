import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import CourseExportForm from './courseExportForm.jsx';

export default function CourseExportView({ courseOps }) {
  const navigate = useNavigate();

  const close = () => {
    navigate('/dashboard');
  };

  useEffect(() => {
    updateAppBar({ title: 'Export course', tools: null });
  }, []);

  return (
    <>
      <div className="flex-1 m-6 flex flex-col bg-white">
        <CourseExportForm courseOps={courseOps} onClose={close} />
      </div>
    </>
  );
}
