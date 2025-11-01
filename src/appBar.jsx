import React from 'react';
import { useAppBarState } from './hooks/useAppBarState';

export default function AppBar() {
  const { title, tools } = useAppBarState();
  return (
    <header className="flex flex-row items-center justify-between pr-2 border-b-1 bg-gray-600 border-gray-500 h-[42px]">
      <h1 className="pl-2 font-medium text-lg text-gray-50 flex items-center min-w-0">
        <span className="hidden sm:inline-block bg-white border border-gray-300 rounded-full w-[32px] px-1.5 py-0.5  m-1">💡</span> <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{title}</span>
      </h1>
      <div className="whitespace-nowrap ml-2">{tools}</div>
    </header>
  );
}
