import React from 'react';

export default function AppBar() {
  return (
    <header className="items-center border-b-1 bg-gray-900 border-gray-200 hidden sm:block ">
      <h1 className="font-semibold text-lg text-gray-50">
        <span className="inline-block bg-white border border-gray-300 rounded-full w-[32px] px-1.5 py-0.5  m-1">💡</span> welcome
      </h1>
    </header>
  );
}
