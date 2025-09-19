import { useState } from 'react';
import { aiTopicGenerator } from '../ai/aiContentGenerator';

function useCourseOperations(course, setCourse, user, service, currentTopic, changeTopic) {
  async function createCourse(catalogEntry) {
    if (!title.trim()) return;
    const newCourse = await service.createCourse(user, title.trim());
    if (newCourse) {
      setCourse(newCourse);
    }
  }

  async function addTopic(moduleIndex, topicTitle, topicDescription, topicType) {
    topicTitle = topicTitle.trim();
    topicType = topicType || 'instruction';
    if (!topicTitle) return;

    const token = user.getSetting('gitHubToken', course.id);
    if (token) {
      try {
        const newTopic = {
          id: generateId(),
          title: topicTitle,
          type: topicType,
          path: generateTopicPath(course, topicTitle, topicType),
        };

        const updatedCourse = course.constructor._copy(course);
        const module = updatedCourse.modules[moduleIndex];
        module.topics.push(newTopic);

        updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
        setCourse(updatedCourse);

        const basicContent = await generateTopicContent(newTopic, topicDescription);
        if (basicContent) {
          const gitHubUrl = newTopic.path.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
          await service.commitTopicMarkdown(gitHubUrl, basicContent, token, `add(topic) ${newTopic.title}`);
        }

        await updatedCourse.commitCourseStructure(user, service, `add(topic) ${newTopic.title}`);

        changeTopic(newTopic);
      } catch (error) {
        alert(`Failed to add topic: ${error.message}`);
      }
    }
  }

  async function renameTopic(moduleIdx, topicIdx, newTitle, newType) {
    if (!newTitle.trim()) return;
    const updatedCourse = course.constructor._copy(course);
    const topic = updatedCourse.modules[moduleIdx].topics[topicIdx];
    if (!topic) return;
    topic.title = newTitle.trim();
    topic.type = newType || topic.type;
    updatedCourse.modules[moduleIdx].topics[topicIdx] = topic;
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
    setCourse(updatedCourse);
    try {
      const token = user.getSetting('gitHubToken', course.id);
      if (token) {
        await updatedCourse.commitCourseStructure(user, service, `rename(topic) ${topic.title} with type ${topic.type}`);
      }
    } catch (err) {
      alert(`Failed to persist topic rename: ${err.message}`);
    }
  }

  async function removeTopic(moduleIndex, topicIndex) {
    const topic = course.modules[moduleIndex].topics[topicIndex];
    if (!confirm(`Are you sure you want to remove "${topic.title}"?`)) return;

    try {
      const updatedCourse = course.constructor._copy(course);
      updatedCourse.modules[moduleIndex].topics.splice(topicIndex, 1);
      updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

      setCourse(updatedCourse);

      // Commit the course structure changes
      const token = user.getSetting('gitHubToken', course.id);
      if (token) {
        await updatedCourse.commitCourseStructure(user, service, `remove(topic) ${topic.title}`);
      }

      // If the removed topic was the current topic, navigate to the first topic
      if (currentTopic && currentTopic.path === topic.path) {
        const firstTopic = updatedCourse.allTopics[0];
        if (firstTopic) {
          changeTopic(firstTopic);
        }
      }
    } catch (error) {
      alert(`Failed to remove topic: ${error.message}`);
    }
  }

  async function addModule(title) {
    if (!title.trim()) return;
    const updatedCourse = course.constructor._copy(course);
    updatedCourse.modules.push({
      id: generateId(),
      title: title.trim(),
      topics: [],
    });
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
    setCourse(updatedCourse);
    try {
      const token = user.getSetting('gitHubToken', course.id);
      if (token) {
        await updatedCourse.commitCourseStructure(user, service, `add(module) ${title.trim()}`);
      }
    } catch (err) {
      alert(`Failed to add module: ${err.message}`);
    }
  }

  async function generateTopicContent(topic, topicDescription) {
    let basicContent = `# ${topic.title}\n\n`;

    switch (topic.type) {
      case 'video':
        return null;
      case 'quiz':
        basicContent += `## Quiz\n\n### Question 1\n\nYour question here?\n\n- [ ] Option A\n- [ ] Option B\n- [ ] Option C\n- [ ] Option D\n\n### Answer\n\nCorrect answer and explanation.\n`;
        break;
      case 'project':
        basicContent += `## Project: ${topic.title}\n\n### Objectives\n\n- Objective 1\n- Objective 2\n\n### Instructions\n\n1. Step 1\n2. Step 2\n3. Step 3\n\n### Deliverables\n\n- Deliverable 1\n- Deliverable 2\n`;
        break;
      case 'instruction':
        const apiKey = user.getSetting('geminiApiKey');
        basicContent = await aiTopicGenerator(apiKey, topic.title, topicDescription, 'instruction');
        break;
      default:
        basicContent += `## Overview\n\nContent for ${topic.title} goes here.\n\n## Key Concepts\n\n- Concept 1\n- Concept 2\n- Concept 3\n`;
    }

    return basicContent;
  }

  function generateId() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)).replace(/-/g, '');
  }

  function generateTopicPath(course, topicTitle, topicType) {
    if (topicType === 'video') {
      return `https://youtu.be/PKiRH2ZKZeM?cb=${Date.now()}`;
    }

    const slugTitle = topicTitle
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim('-');
    return `${course.links.gitHub.rawUrl}/instruction/${slugTitle}/${slugTitle}.md`;
  }

  return {
    createCourse,
    addTopic,
    removeTopic,
    renameTopic,
    addModule,
  };
}

export default useCourseOperations;
