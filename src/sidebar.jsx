import React, { useState } from 'react';
import Login from './login.jsx';
import Contents from './contents.jsx';

function Sidebar() {
  return (
    <aside className="bg-gray-100 shadow-lg">
      <Login />
      <Contents />
    </aside>
  );
}

export default Sidebar;
