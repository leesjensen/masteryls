import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { AppBarButton } from '../../appBar.jsx';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import CourseExportForm from './courseExportForm.jsx';

export default function CourseExportView({ courseOps }) {
  const navigate = useNavigate();

  const close = () => {
    navigate('/dashboard');
  };

  const appBarTools = <AppBarButton icon={X} onClick={close} title="Close" />;

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
