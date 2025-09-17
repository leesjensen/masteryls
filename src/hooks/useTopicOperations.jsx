import { useState } from 'react';

function useTopicOperations(course, setCourse, user, service, currentTopic, changeTopic) {
  const [showTopicForm, setShowTopicForm] = useState(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicType, setNewTopicType] = useState('instruction');

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

  function generateBasicContent(title, type) {
    let basicContent = `# ${title}\n\n`;

    switch (type) {
      case 'video':
        basicContent += `## Video Content\n\n[Add video link or embed here]\n\n## Summary\n\nSummary of the video content goes here.\n`;
        break;
      case 'quiz':
        basicContent += `## Quiz\n\n### Question 1\n\nYour question here?\n\n- [ ] Option A\n- [ ] Option B\n- [ ] Option C\n- [ ] Option D\n\n### Answer\n\nCorrect answer and explanation.\n`;
        break;
      case 'project':
        basicContent += `## Project: ${title}\n\n### Objectives\n\n- Objective 1\n- Objective 2\n\n### Instructions\n\n1. Step 1\n2. Step 2\n3. Step 3\n\n### Deliverables\n\n- Deliverable 1\n- Deliverable 2\n`;
        break;
      default:
        basicContent += `## Overview\n\nContent for ${title} goes here.\n\n## Key Concepts\n\n- Concept 1\n- Concept 2\n- Concept 3\n`;
    }

    return basicContent;
  }

  async function addTopic(moduleIndex, afterTopicIndex) {
    if (!newTopicTitle.trim()) return;

    const token = user.gitHubToken(course.id);

    if (token) {
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
        const basicContent = generateBasicContent(newTopic.title, newTopic.type);

        // Create the GitHub file path
        const topicPath = generateTopicPath(newTopic.title, newTopic.type);
        const gitHubUrl = `${course.links.gitHub.apiUrl}/${topicPath}`;
        // Create the topic file on GitHub
        await service.commitTopicMarkdown(gitHubUrl, basicContent, token, `add(${newTopic.title}): create new topic`);

        // Commit the course structure changes
        await updatedCourse.commitCourseStructure(user, service, `add(${newTopic.title}): update course structure`);

        changeTopic(newTopic);
      } catch (error) {
        console.error('Error adding topic:', error);
        alert('Failed to add topic. Please try again.');
      }
    }
  }

  async function removeTopic(moduleIndex, topicIndex) {
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

  return {
    showTopicForm,
    setShowTopicForm,
    newTopicTitle,
    setNewTopicTitle,
    newTopicType,
    setNewTopicType,
    addTopic,
    removeTopic,
    cancelTopicForm,
  };
}

export default useTopicOperations;
