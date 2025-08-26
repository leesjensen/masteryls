import React, { useState } from 'react';
import config from '../config.js';
import Toolbar from './toolbar';
import Instruction from './instruction/instruction.jsx';
import Editor from './editor/editor.jsx';
import Sidebar from './sidebar';
import Course from './course.js';

function App() {
  const [user, setUser] = useState(null);
  const [course, setCourse] = React.useState(new Course(config));
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [sidebarVisible, setSidebarVisible] = useState(getSidebarPreference());
  const [editorVisible, setEditorVisible] = useState(false);
  const courseRef = React.useRef(course);
  courseRef.current = course;

  React.useEffect(() => {
    Course.create(config).then((loadedCourse) => {
      setCourse(loadedCourse);

      const savedTopicPath = localStorage.getItem('selectedTopic');
      if (savedTopicPath) {
        setTopic(loadedCourse.topicFromPath(savedTopicPath));
      } else {
        setTopic({ title: 'Home', path: `${loadedCourse.links.gitHub.rawUrl}/README.md` });
      }
    });

    function handleBeforeUnload(e) {
      if (courseRef.current?.isDirty()) {
        e.preventDefault();
        e.returnValue = 'You have uncommitted changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  function getSidebarPreference() {
    const sidebarPref = localStorage.getItem('sidebarVisible');
    if (sidebarPref !== null) {
      return sidebarPref === 'true';
    } else {
      return true;
    }
  }

  function manipulateSidebar(visible) {
    setSidebarVisible(visible);
    localStorage.setItem('sidebarVisible', visible);
  }

  function changeTopic(newTopic) {
    localStorage.setItem('selectedTopic', newTopic.path);
    setTopic(newTopic);

    if (sidebarVisible && window.innerWidth < 768) {
      manipulateSidebar(false);
    }
  }

  function navigateToAdjacentTopic(direction = 'prev') {
    const adjacentTopic = course.adjacentTopic(topic.path, direction);
    if (adjacentTopic) {
      changeTopic(adjacentTopic);
    }
  }

  function toggleEditor() {
    setEditorVisible((prev) => !prev);
  }

  if (!user) {
    const [showSignup, setShowSignup] = useState(false);

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden max-w-3xl w-full">
          <div className="md:w-1/2 flex items-center justify-center bg-amber-100">
            <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80" alt="Hero" className="object-cover w-full h-64 md:h-full" />
          </div>
          <div className="md:w-1/2 p-8 flex flex-col justify-center">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">💡 Mastery LS</h2>
            <p className="mb-6 text-gray-600">
              {showSignup ? (
                <>
                  Create an account for <span className="font-semibold">{course.title}</span>
                </>
              ) : (
                <>
                  Sign in to continue to <span className="font-semibold">{course.title}</span>
                </>
              )}
            </p>
            <form className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-1" htmlFor="email">
                  Email
                </label>
                <input id="email" type="email" className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="you@example.com" autoComplete="username" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1" htmlFor="password">
                  Password
                </label>
                <input id="password" type="password" className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="••••••••" autoComplete={showSignup ? 'new-password' : 'current-password'} />
              </div>
              {showSignup && (
                <div>
                  <label className="block text-gray-700 mb-1" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <input id="confirmPassword" type="password" className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="••••••••" autoComplete="new-password" />
                </div>
              )}
              <button type="submit" className="w-full bg-amber-400 hover:bg-amber-500 text-white font-semibold py-2 rounded transition" disabled>
                {showSignup ? 'Create Account' : 'Log In'}
              </button>
            </form>
            <div className="mt-4 text-center">
              {showSignup ? (
                <button type="button" className="text-amber-600 hover:underline text-sm" onClick={() => setShowSignup(false)}>
                  Already have an account? Log in
                </button>
              ) : (
                <button type="button" className="text-amber-600 hover:underline text-sm" onClick={() => setShowSignup(true)}>
                  Don't have an account? Create one
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="items-center border-b-1 bg-amber-50 border-gray-200 hidden sm:block ">
        <h1 className="font-semibold text-lg text-gray-700">
          <span className="inline-block bg-white border border-gray-300 rounded-full w-[32px] px-1.5 py-0.5  m-1">💡</span> {course.title}
        </h1>
      </header>

      <Toolbar course={course} sidebarVisible={sidebarVisible} manipulateSidebar={manipulateSidebar} currentTopic={topic} changeTopic={setTopic} navigateToAdjacentTopic={navigateToAdjacentTopic} editing={editorVisible} toggleEditor={toggleEditor} />

      <div className="flex flex-1 overflow-hidden">
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${sidebarVisible ? 'flex w-full sm:w-[300px] opacity-100' : 'w-0 opacity-0'}`}>
          <Sidebar course={course} currentTopic={topic} changeTopic={changeTopic} navigateToAdjacentTopic={navigateToAdjacentTopic} editorVisible={editorVisible} />
        </div>
        {editorVisible ? <Editor course={course} setCourse={setCourse} currentTopic={topic} changeTopic={changeTopic} /> : <Instruction topic={topic} changeTopic={changeTopic} course={course} navigateToAdjacentTopic={navigateToAdjacentTopic} />}
      </div>
    </div>
  );
}

export default App;
