import React, { useState } from 'react';

const tocItems = [
  { id: 1, label: 'Introduction', href: '#introduction' },
  { id: 2, label: 'Getting Started', href: '#getting-started' },
  { id: 3, label: 'Features', href: '#features' },
  { id: 4, label: 'FAQ', href: '#faq' },
];

function Contents() {
  return (
    <div className="w-50 mt-2 p-2 bg-white rounded shadow">
      <nav>
        <h3 className="text-lg font-semibold mb-2">Table of Contents</h3>
        <ul className="list-none p-0">
          {tocItems.map((item) => (
            <li key={item.id} className="mb-3">
              <a href={item.href} className="no-underline text-gray-800 hover:text-blue-600">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default Contents;
