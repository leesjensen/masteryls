import React from 'react';
import { useAppBarState } from './hooks/useAppBarState';

export function AppBar() {
  const { title, subTitle, tools } = useAppBarState();

  return (
    <header className="flex flex-row items-center justify-between pr-2 border-b-1 bg-gray-50 border-gray-500 h-[42px]">
      <h1 className="pl-1 font-medium text-lg text-gray-900 flex items-center min-w-0">
        <span className="hidden sm:inline-flex items-center justify-center bg-white border border-gray-300 rounded-full w-[32px] h-[32px] ml-1 mr-2">
          <img src="/favicon.png" alt="MasteryLS logo" className=" w-[20px] h-[20px]" />
        </span>{' '}
        <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{renderTitle(title, subTitle)}</span>
      </h1>
      <div className="whitespace-nowrap ml-2">{tools}</div>
    </header>
  );
}

function renderTitle(title, subTitle) {
  return (
    <>
      {title}
      {subTitle && (
        <span>
          <span className="text-sm text-gray-200 mx-1">❯</span>
          {subTitle}
        </span>
      )}
    </>
  );
}

export function AppBarButton({ icon: Icon, onClick, title = undefined, size = 18 }) {
  return (
    <button title={title} onClick={onClick} className="bg-transparent border border-gray-50  hover:text-amber-600 transition-all duration-200 ease-in-out">
      <Icon size={size} />
    </button>
  );
}
