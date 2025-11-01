import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState';

export default function ProgressView({ courseOps }) {
  const navigate = useNavigate();

  const appBarTools = (
    <button title="Close metrics dashboard" onClick={() => navigate('/dashboard')} className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-xs bg-white border border-gray-300 filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out">
      ❌
    </button>
  );

  useEffect(() => {
    updateAppBar('Progress', appBarTools);
  }, []);

  return (
    <>
      <div className="flex-1 m-6 flex flex-col bg-white">
        <main className="flex-1 overflow-auto p-2 border border-gray-200">View your progress here.</main>
      </div>
    </>
  );
}
