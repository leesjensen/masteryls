import React from 'react';

export default function Toolbar({ courseOps, user, course, settings, topic, editing, toggleEditor }) {
  function gitHubUrl(url) {
    return url.replace(course.links.gitHub.rawUrl, course.links.gitHub.url);
  }

  function displaySchedule() {
    courseOps.setSidebarVisible('start');
    courseOps.changeTopic({ name: 'Schedule', path: course.schedule });
  }

  function getNextWindowState() {
    if (window.innerWidth < 400) {
      return settings.sidebarVisible === 'end' ? 'start' : 'end';
    }
    return settings.sidebarVisible === 'start' ? 'split' : settings.sidebarVisible === 'end' ? 'split' : 'start';
  }

  const nextSidebarState = getNextWindowState();

  return (
    <div className="flex flex-row justify-between border-b-1 border-gray-200">
      <div className="flex flex-row justify-start">
        <div className="sm:hidden flex justify-center items-center w-[48px] bg-amber-100 ">
          <span className="bg-white border border-gray-300 rounded-full px-1 m-1">💡</span>
        </div>
        <button className="w-12 m-1 p-1.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0  hover:text-amber-600 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={() => courseOps.setSidebarVisible(nextSidebarState)}>
          {settings.sidebarVisible !== 'start' ? '☰ ◀' : '☰ ▶'}
        </button>
      </div>
      <div className="flex flex-row justify-end">
        <button title="generate data" className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={() => courseOps.generateRandomData()}>
          🐮
        </button>
        {user && user.isEditor(course.id) && (
          <button title="Edit topic" className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={() => toggleEditor()}>
            {editing ? '📘' : '✏️'}
          </button>
        )}
        {course.schedule && (
          <button title="View schedule" className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={() => displaySchedule()}>
            📅
          </button>
        )}
        {course.links?.chat && (
          <button title="Course chat server" className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={() => window.open(course.links.chat, '_blank')}>
            💬
          </button>
        )}
        {course.links?.canvas && (
          <button title="Canvas course site" className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out flex items-center justify-center" onClick={() => window.open(course.links.canvas, '_blank')}>
            <svg width="16" height="16" x="0px" y="0px" viewBox="298 -66.2 217 244.4" xmlns="http://www.w3.org/2000/svg">
              <g>
                <g>
                  <polygon fill="#2A7BA0" points="298,117.1 406.5,56 515,117.1 406.5,178.1"></polygon>
                  <polygon fill="#FDCC10" points="352.2,-35.7 298,-5.1 352.3,25.4 406.5,-5.1"></polygon>
                  <polygon fill="#F78F20" points="406.5,-66.2 352.3,-35.7 406.5,-5.1 460.7,-35.7"></polygon>
                  <polygon fill="#EB2227" points="460.7,-35.7 406.5,-5.1 460.7,25.4 515,-5.1"></polygon>
                </g>
              </g>
            </svg>
          </button>
        )}
        <button title="GitHub repository" className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out flex items-center justify-center" onClick={() => window.open(gitHubUrl(topic.path), '_blank')}>
          <svg width="16" height="16" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" transform="scale(64)" fill="#1B1F23" />
          </svg>
        </button>
        <button title="Previous topic" className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:text-amber-600 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={() => courseOps.navigateToAdjacentTopic('prev')}>
          ◀
        </button>
        <button title="Next topic" className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0  hover:text-amber-600 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={() => courseOps.navigateToAdjacentTopic('next')}>
          ▶
        </button>
        <button title="Close course" className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={() => courseOps.closeCourse()}>
          ❌
        </button>
      </div>
    </div>
  );
}
