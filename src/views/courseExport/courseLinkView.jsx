import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import CourseLinkForm from './courseLinkForm.jsx';

export default function CourseLinkView({ courseOps }) {
  const navigate = useNavigate();

  const close = () => {
    navigate('/dashboard');
  };

  useEffect(() => {
    updateAppBar({ title: 'Link course', tools: null });
  }, []);

  return (
    <>
      <div className="flex-1 m-6 flex flex-col bg-white">
        <CourseLinkForm courseOps={courseOps} onClose={close} />
      </div>
    </>
  );
}
