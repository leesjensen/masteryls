import React, { useState } from 'react';
import config from '../config.js';
import Toolbar from './toolbar';
import Instruction from './instruction/instruction.jsx';
import Editor from './editor/editor.jsx';
import Sidebar from './sidebar';
import Course from './course.js';
import Login from './login.jsx';
import Dashboard from './dashboard.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [course, setCourse] = React.useState(null);
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [sidebarVisible, setSidebarVisible] = useState(getSidebarPreference());
  const [editorVisible, setEditorVisible] = useState(false);
  const courseRef = React.useRef(course);
  courseRef.current = course;

  React.useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    const savedCourse = localStorage.getItem('course');
    if (savedCourse) {
      const courseInfo = config.courses.find((c) => c.id === savedCourse);
      loadCourse(courseInfo);
    }
  }, []);

  function loadCourse(courseInfo) {
    Course.create(courseInfo).then((loadedCourse) => {
      setCourse(loadedCourse);

      localStorage.setItem('course', loadedCourse.id);
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
  }

  function changeCourse(newCourse) {
    setCourse(newCourse);
    if (newCourse === null) {
      localStorage.removeItem('course');
    } else {
      localStorage.setItem('course', newCourse.id);
    }
  }

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
    return <Login setUser={setUser} />;
  } else if (!course) {
    return <Dashboard config={config} user={user} setUser={setUser} loadCourse={loadCourse} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="items-center border-b-1 bg-amber-50 border-gray-200 hidden sm:block ">
        <h1 className="font-semibold text-lg text-gray-700">
          <span className="inline-block bg-white border border-gray-300 rounded-full w-[32px] px-1.5 py-0.5  m-1">💡</span> {course.title}
        </h1>
      </header>

      <Toolbar course={course} setCourse={changeCourse} sidebarVisible={sidebarVisible} manipulateSidebar={manipulateSidebar} currentTopic={topic} changeTopic={setTopic} navigateToAdjacentTopic={navigateToAdjacentTopic} editing={editorVisible} toggleEditor={toggleEditor} />

      <div className="flex flex-1 overflow-hidden">
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${sidebarVisible ? 'flex w-full sm:w-[300px] opacity-100' : 'w-0 opacity-0'}`}>
          <Sidebar course={course} currentTopic={topic} changeTopic={changeTopic} navigateToAdjacentTopic={navigateToAdjacentTopic} editorVisible={editorVisible} />
        </div>
        {editorVisible ? <Editor course={course} setCourse={changeCourse} currentTopic={topic} changeTopic={changeTopic} /> : <Instruction topic={topic} changeTopic={changeTopic} course={course} navigateToAdjacentTopic={navigateToAdjacentTopic} />}
      </div>
    </div>
  );
}

export default App;
