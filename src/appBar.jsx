import React from 'react';
import { useAppBarState } from './hooks/useAppBarState';

export default function AppBar() {
  const { title, tools } = useAppBarState();
  return (
    <header className="flex flex-row items-center justify-between pr-2 border-b-1 bg-gray-600 border-gray-500">
      <h1 className="font-semibold text-lg text-gray-50">
        <span className="inline-block bg-white border border-gray-300 rounded-full w-[32px] px-1.5 py-0.5  m-1">💡</span> {title}
      </h1>
      {tools}
    </header>
  );
}
