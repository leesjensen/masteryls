import React, { useEffect } from 'react';
import Login from './login.jsx';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from './hooks/useAppBarState';

const Start = ({ courseOps }) => {
  const navigate = useNavigate();

  useEffect(() => {
    updateAppBar({ title: 'Get started', tools: null });
  }, []);

  return (
    <main className="min-h-full flex items-center justify-center bg-gray-100 px-4 py-8 sm:px-8 lg:px-12">
      <section className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-3 mb-2">
            <img src="/favicon.png" alt="Mastery LS Logo" className="w-16 h-auto" />
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
              <span className="text-[#20508b]">Mastery</span>
              <span className="text-[#3dbcab]">LS</span>
            </h1>
          </div>
          <p className="text-lg sm:text-xl text-gray-600 mt-3 max-w-xl">Log in or create an account to continue.</p>
        </div>

        <div className="flex flex-col items-center md:items-end w-full">
          <div className="w-full max-w-md">
            <Login courseOps={courseOps} />
          </div>
          <div className="mt-5 text-center w-full max-w-md">
            <button onClick={() => navigate('/about')} className="text-amber-700 font-semibold hover:text-amber-600 hover:underline">
              Learn more about Mastery LS
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Start;
