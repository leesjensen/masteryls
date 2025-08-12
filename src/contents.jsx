import React, { useState } from 'react';

function Contents({ setTopicUrl, modules }) {
  return (
    <div id="content" className="h-full overflow-auto bg-white">
      <nav>
        <h3 className="text-lg font-semibold mb-2">Table of Contents</h3>
        <ul className="list-none p-0">
          {modules.map((item, i) => (
            <li key={i} className="mb-3">
              <a className="no-underline text-gray-800 font-bold hover:text-blue-600">{item.title}</a>
              <ul className="list-none p-0">
                {item.topics.map((item, i) => (
                  <li key={i} className="mb-3">
                    <a onClick={() => setTopicUrl(item.path)} className="no-underline text-green-600 hover:text-blue-600">
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
