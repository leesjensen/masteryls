import React, { useState, useEffect } from 'react';
import useHotkeys from './hooks/useHotKeys';

function Contents({ service, changeTopic, currentTopic, course, enrollment, navigateToAdjacentTopic, user, setCourse }) {
  const [openModuleIndexes, setOpenModuleIndexes] = useState([]);
  const [showTopicForm, setShowTopicForm] = useState(null); // { moduleIndex: number, afterTopicIndex?: number }
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicType, setNewTopicType] = useState('instruction');

  useHotkeys(
    {
      'ALT+ArrowRight': (e) => {
        navigateToAdjacentTopic('next');
      },
      'ALT+ArrowLeft': (e) => {
        navigateToAdjacentTopic('prev');
      },
    },
    { target: undefined }
  );

  const toggleModule = (index) => {
    setOpenModuleIndexes((prev) => {
      const newIndexes = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];

      enrollment.settings.tocIndexes = newIndexes;
      service.saveEnrollment(enrollment);

      return newIndexes;
    });
  };

  useEffect(() => {
    if (currentTopic?.path) {
      const moduleIndex = course.moduleIndexOf(currentTopic.path);
      if (moduleIndex !== -1 && !enrollment.settings.tocIndexes.includes(moduleIndex)) {
        enrollment.settings.tocIndexes.push(moduleIndex);
        service.saveEnrollment(enrollment);
      }
    }
    setOpenModuleIndexes(enrollment.settings.tocIndexes);
  }, [currentTopic]);

  function topicIcon(topic) {
    switch (topic.type) {
      case 'video':
        return '🎥';
      case 'quiz':
        return '⏱';
      case 'project':
        return '⚙️';
      default:
        return '-';
    }
  }

  function isEditor() {
    return user && course && user.isEditor(course.id);
  }

  function generateTopicId() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)).replace(/-/g, '');
  }

  function generateTopicPath(title, type) {
    const slugTitle = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim('-');
    const extension = 'md'; // All topics are markdown files
    return `instruction/${slugTitle}/${slugTitle}.${extension}`;
  }

  async function addTopic(moduleIndex, afterTopicIndex) {
    if (!newTopicTitle.trim() || !isEditor()) return;

    try {
      const updatedCourse = course.constructor._copy(course);
      const module = updatedCourse.modules[moduleIndex];

      const newTopic = {
        id: generateTopicId(),
        title: newTopicTitle.trim(),
        type: newTopicType,
        path: `${course.links.gitHub.rawUrl}/${generateTopicPath(newTopicTitle.trim(), newTopicType)}`,
      };

      if (afterTopicIndex !== undefined) {
        module.topics.splice(afterTopicIndex + 1, 0, newTopic);
      } else {
        module.topics.push(newTopic);
      }

      // Update allTopics array
      updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

      setCourse(updatedCourse);
      setShowTopicForm(null);
      setNewTopicTitle('');
      setNewTopicType('instruction');

      // Create a basic markdown file for the new topic
      let basicContent = `# ${newTopic.title}\n\n`;

      switch (newTopic.type) {
        case 'video':
          basicContent += `## Video Content\n\n[Add video link or embed here]\n\n## Summary\n\nSummary of the video content goes here.\n`;
          break;
        case 'quiz':
          basicContent += `## Quiz\n\n### Question 1\n\nYour question here?\n\n- [ ] Option A\n- [ ] Option B\n- [ ] Option C\n- [ ] Option D\n\n### Answer\n\nCorrect answer and explanation.\n`;
          break;
        case 'project':
          basicContent += `## Project: ${newTopic.title}\n\n### Objectives\n\n- Objective 1\n- Objective 2\n\n### Instructions\n\n1. Step 1\n2. Step 2\n3. Step 3\n\n### Deliverables\n\n- Deliverable 1\n- Deliverable 2\n`;
          break;
        default:
          basicContent += `## Overview\n\nContent for ${newTopic.title} goes here.\n\n## Key Concepts\n\n- Concept 1\n- Concept 2\n- Concept 3\n`;
      }

      // Create the GitHub file path
      const topicPath = generateTopicPath(newTopic.title, newTopic.type);
      const gitHubUrl = `${course.links.gitHub.apiUrl}/${topicPath}`;
      const token = user.gitHubToken(course.id);

      if (token) {
        // Create the topic file on GitHub
        await service.commitTopicMarkdown(gitHubUrl, basicContent, token, `add(${newTopic.title}): create new topic`);

        // Commit the course structure changes
        await updatedCourse.commitCourseStructure(user, service, `add(${newTopic.title}): update course structure`);
      }

      // Update the local cache
      const [savedCourse, savedTopic] = await updatedCourse.saveTopicMarkdown(newTopic, basicContent);
      setCourse(savedCourse);
    } catch (error) {
      console.error('Error adding topic:', error);
      alert('Failed to add topic. Please try again.');
    }
  }

  async function removeTopic(moduleIndex, topicIndex) {
    if (!isEditor()) return;

    const topic = course.modules[moduleIndex].topics[topicIndex];
    if (!confirm(`Are you sure you want to remove "${topic.title}"?`)) return;

    try {
      const updatedCourse = course.constructor._copy(course);
      updatedCourse.modules[moduleIndex].topics.splice(topicIndex, 1);

      // Update allTopics array
      updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

      setCourse(updatedCourse);

      // Commit the course structure changes
      const token = user.gitHubToken(course.id);
      if (token) {
        await updatedCourse.commitCourseStructure(user, service, `remove(${topic.title}): update course structure`);
      }

      // If the removed topic was the current topic, navigate to the first topic
      if (currentTopic && currentTopic.path === topic.path) {
        const firstTopic = updatedCourse.allTopics[0];
        if (firstTopic) {
          changeTopic(firstTopic);
        }
      }
    } catch (error) {
      console.error('Error removing topic:', error);
      alert('Failed to remove topic. Please try again.');
    }
  }

  function cancelTopicForm() {
    setShowTopicForm(null);
    setNewTopicTitle('');
    setNewTopicType('instruction');
  }

  if (!course) {
    return <div className="p-4 text-gray-500"></div>;
  }

  return (
    <div id="content" className="h-full overflow-auto p-4 text-sm">
      <nav>
        <ul className="list-none p-0">
          {course.map((item, i) => (
            <li key={i} className="mb-1">
              <button onClick={() => toggleModule(i)} className="no-underline text-gray-500 font-semibold bg-transparent border-none cursor-pointer p-0 truncate max-w-full flex whitespace-nowrap overflow-hidden text-ellipsis items-center" aria-expanded={openModuleIndexes.includes(i)} title={item.title}>
                <span className="mr-2">{openModuleIndexes.includes(i) ? '▼' : '▶'}</span>
                {item.title}
              </button>
              {openModuleIndexes.includes(i) && (
                <ul className="list-none p-0 ml-4">
                  {item.topics.map((topic, topicIndex) => (
                    <li key={topic.path} className="mb-0.5 flex items-center group">
                      <span className="mr-2">{topicIcon(topic)}</span>
                      <a onClick={() => changeTopic(topic)} className={`no-underline cursor-pointer truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${topic.path === currentTopic?.path ? 'text-amber-500 font-semibold' : 'text-gray-500 hover:text-amber-500'}`} title={topic.title}>
                        {topic.title}
                      </a>
                      <span className="text-sm align-super text-amber-600">{topic.lastUpdated ? '*' : ''}</span>
                      {isEditor() && (
                        <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                          <button onClick={() => setShowTopicForm({ moduleIndex: i, afterTopicIndex: topicIndex })} className="text-gray-400 hover:text-green-600 mr-1 p-1 text-xs" title="Add topic after this one">
                            ➕
                          </button>
                          <button onClick={() => removeTopic(i, topicIndex)} className="text-gray-400 hover:text-red-600 p-1 text-xs" title="Remove this topic">
                            ❌
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                  {showTopicForm && showTopicForm.moduleIndex === i && showTopicForm.afterTopicIndex !== undefined && (
                    <li className="mb-0.5 ml-4 p-2 bg-gray-50 border rounded">
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Topic title"
                          value={newTopicTitle}
                          onChange={(e) => setNewTopicTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              addTopic(i, showTopicForm.afterTopicIndex);
                            } else if (e.key === 'Escape') {
                              cancelTopicForm();
                            }
                          }}
                          className="px-2 py-1 border rounded text-sm"
                          autoFocus
                        />
                        <select value={newTopicType} onChange={(e) => setNewTopicType(e.target.value)} className="px-2 py-1 border rounded text-sm">
                          <option value="instruction">Instruction</option>
                          <option value="video">Video</option>
                          <option value="quiz">Quiz</option>
                          <option value="project">Project</option>
                        </select>
                        <div className="flex gap-2">
                          <button onClick={() => addTopic(i, showTopicForm.afterTopicIndex)} className="px-2 py-1 bg-green-600 text-white rounded text-xs" disabled={!newTopicTitle.trim()}>
                            Add
                          </button>
                          <button onClick={cancelTopicForm} className="px-2 py-1 bg-gray-600 text-white rounded text-xs">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </li>
                  )}
                  {isEditor() && (
                    <li className="mb-0.5 flex items-center">
                      <button onClick={() => setShowTopicForm({ moduleIndex: i })} className="text-gray-400 hover:text-green-600 ml-4 text-sm py-1" title="Add new topic to this module">
                        + Add topic
                      </button>
                    </li>
                  )}
                  {showTopicForm && showTopicForm.moduleIndex === i && showTopicForm.afterTopicIndex === undefined && (
                    <li className="mb-0.5 ml-4 p-2 bg-gray-50 border rounded">
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Topic title"
                          value={newTopicTitle}
                          onChange={(e) => setNewTopicTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              addTopic(i);
                            } else if (e.key === 'Escape') {
                              cancelTopicForm();
                            }
                          }}
                          className="px-2 py-1 border rounded text-sm"
                          autoFocus
                        />
                        <select value={newTopicType} onChange={(e) => setNewTopicType(e.target.value)} className="px-2 py-1 border rounded text-sm">
                          <option value="instruction">Instruction</option>
                          <option value="video">Video</option>
                          <option value="quiz">Quiz</option>
                          <option value="project">Project</option>
                        </select>
                        <div className="flex gap-2">
                          <button onClick={() => addTopic(i)} className="px-2 py-1 bg-green-600 text-white rounded text-xs" disabled={!newTopicTitle.trim()}>
                            Add
                          </button>
                          <button onClick={cancelTopicForm} className="px-2 py-1 bg-gray-600 text-white rounded text-xs">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default Contents;
