import React, { useState } from 'react';

const tocItems = [
  { id: 1, label: 'Introduction', href: '#introduction' },
  { id: 2, label: 'Getting Started', href: '#getting-started' },
  { id: 3, label: 'Features', href: '#features' },
  { id: 4, label: 'FAQ', href: '#faq' },
  { id: 5, label: 'FAQ', href: '#faq' },
  { id: 6, label: 'FAQ', href: '#faq' },
  { id: 7, label: 'FAQ', href: '#faq' },
  { id: 8, label: 'FAQ', href: '#faq' },
];

function Contents({ modules }) {
  return (
    <div id="content" className="h-full overflow-auto bg-white">
      <nav>
        <h3 className="text-lg font-semibold mb-2">Table of Contents</h3>
        <ul className="list-none p-0">
          {modules.map((item, i) => (
            <li key={i} className="mb-3">
              <a href={item.path} className="no-underline text-gray-800 font-bold hover:text-blue-600">
                {item.title}
              </a>
              <ul className="list-none p-0">
                {item.topics.map((item, i) => (
                  <li key={i} className="mb-3">
                    <a href={item.path} className="no-underline text-green-600 hover:text-blue-600">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default Contents;
