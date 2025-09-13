import React, { useState } from 'react';
import Toolbar from './toolbar';
import Instruction from './views/instruction/instruction.jsx';
import Editor from './views/editor/editor.jsx';
import Sidebar from './sidebar';
import Course from './course.js';
import Start from './start.jsx';
import Dashboard from './views/dashboard/dashboard.jsx';
import service from './service/service.js';

function App() {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [course, setCourse] = React.useState(null);
  const [enrollment, setEnrollment] = React.useState(null);
  const [topic, setTopic] = React.useState({ title: '', path: '' });
  const [editorVisible, setEditorVisible] = useState(false);
  const courseRef = React.useRef(course);
  courseRef.current = course;

  React.useEffect(() => {
    (async () => {
      const savedUser = await service.currentUser();
      if (savedUser) {
        setUser(savedUser);

        const enrollment = await service.currentEnrollment(savedUser.id);
        if (enrollment) {
          loadCourse(enrollment);
        }
      }

      setLoaded(true);
    })();
  }, []);

  function loadCourse(loadingEnrollment) {
    Course.create(loadingEnrollment.catalogEntry).then((loadedCourse) => {
      service.setCurrentCourse(loadedCourse.id);
      setCourse(loadedCourse);
      setEnrollment(loadingEnrollment);

      if (loadingEnrollment.settings.currentTopic) {
        setTopic(loadedCourse.topicFromPath(loadingEnrollment.settings.currentTopic));
      } else {
        setTopic({ title: 'Home', path: `${loadedCourse.links.gitHub.rawUrl}/README.md` });
      }
    });

    function handleBeforeUnload(e) {
      if (courseRef.current?.stagedCount()) {
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

  function closeCourse() {
    setCourse(null);
    service.removeCurrentCourse();
  }

  const sidebarVisible = enrollment?.settings.sidebarVisible ?? false;

  function manipulateSidebar(visible) {
    setEnrollment((previous) => {
      const next = { ...previous, settings: { ...previous.settings, sidebarVisible: visible } };
      service.saveEnrollment(next);
      return next;
    });
  }

  function changeTopic(newTopic) {
    // Remember what the current topic is for when they return in a new session
    if (newTopic.path !== topic.path) {
      setEnrollment((previous) => {
        const next = { ...previous, settings: { ...previous.settings, currentTopic: newTopic.path } };
        service.saveEnrollment(next);
        return next;
      });
    }

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

  // What to show before we know who the user is
  if (!loaded) {
    return (
      <div className="flex flex-col h-screen">
        <div className="m-auto text-gray-400">Loading...</div>
      </div>
    );
  } else if (!user) {
    return <Start setUser={setUser} />;
  } else if (!course) {
    return <Dashboard service={service} user={user} setUser={setUser} loadCourse={loadCourse} />;
  }

  // What to show in the main content area
  let content = <Instruction topic={topic} changeTopic={changeTopic} course={course} navigateToAdjacentTopic={navigateToAdjacentTopic} />;
  if (editorVisible) {
    content = <Editor service={service} user={user} course={course} setCourse={setCourse} currentTopic={topic} changeTopic={changeTopic} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="items-center border-b-1 bg-amber-50 border-gray-200 hidden sm:block ">
        <h1 className="font-semibold text-lg text-gray-700">
          <span className="inline-block bg-white border border-gray-300 rounded-full w-[32px] px-1.5 py-0.5  m-1">💡</span> {course.title}
        </h1>
      </header>

      <Toolbar user={user} course={course} closeCourse={closeCourse} sidebarVisible={sidebarVisible} manipulateSidebar={manipulateSidebar} currentTopic={topic} changeTopic={setTopic} navigateToAdjacentTopic={navigateToAdjacentTopic} editing={editorVisible} toggleEditor={toggleEditor} />

      <div className="flex flex-1 overflow-hidden">
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${sidebarVisible ? 'flex w-full sm:w-[300px] opacity-100' : 'w-0 opacity-0'}`}>
          <Sidebar service={service} user={user} enrollment={enrollment} setCourse={setCourse} course={course} currentTopic={topic} changeTopic={changeTopic} navigateToAdjacentTopic={navigateToAdjacentTopic} />
        </div>
        {content}
      </div>
    </div>
  );
}

export default App;
