import React from 'react';
import { useAppBarState } from './hooks/useAppBarState';
import { useNavigate, useLocation } from 'react-router-dom';

export function AppBar({ user }) {
  const { title, subTitle, tools } = useAppBarState();
  const navigate = useNavigate();
  const location = useLocation();

  function renderTitle(title, subTitle) {
    let titleComponent = <span>{title}</span>;
    if (location.pathname.startsWith('/course/')) {
      const courseId = location.pathname.split('/')[2];
      titleComponent = (
        <span onClick={() => navigate(`/course/${courseId}`)} className="cursor-pointer hover:underline text-blue-600 hover:text-blue-800">
          {title}
        </span>
      );
    }

    return (
      <>
        {titleComponent}
        {subTitle && (
          <>
            <span className="mx-1 text-gray-400">/</span>
            <span className="text-gray-700">{subTitle}</span>
          </>
        )}
      </>
    );
  }

  function navigateHome() {
    if (user && location.pathname.startsWith('/course/')) return <img src="/favicon.png" alt="MasteryLS logo" className=" w-[20px] h-[20px] cursor-pointer" onClick={() => navigate('/dashboard')} />;
    return <img src="/favicon.png" alt="MasteryLS logo" className=" w-[20px] h-[20px]" />;
  }

  return (
    <header className="flex flex-row items-center justify-between pr-2 border-b-1 bg-gray-50 border-gray-500 h-[42px]">
      <h1 className="pl-1 font-medium text-lg text-gray-900 flex items-center min-w-0">
        <span className="hidden sm:inline-flex items-center justify-center bg-white border border-gray-300 rounded-full w-[32px] h-[32px] ml-1 mr-2">{navigateHome()}</span> <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{renderTitle(title, subTitle)}</span>
      </h1>
      <div className="whitespace-nowrap ml-2">{tools}</div>
    </header>
  );
}

export function AppBarButton({ icon: Icon, onClick, title = undefined, size = 18 }) {
  return (
    <button title={title} onClick={onClick} className="bg-transparent border border-gray-50  hover:text-amber-600 transition-all duration-200 ease-in-out">
      <Icon size={size} />
    </button>
  );
}
