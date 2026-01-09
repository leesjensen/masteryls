import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { aiTopicGenerator, aiExamGenerator, aiEssayQuizFeedbackGenerator, aiChoiceQuizFeedbackGenerator } from '../ai/aiContentGenerator';
import Course from '../course';
import MarkdownStatic from '../components/MarkdownStatic';
import { generateId } from '../utils/utils';
import { createCourseInternal } from './courseCreation.js';

/**
 * @typedef {import('../service/service.ts').default} Service
 */

/**
 * Custom hook for course operations
 * @param {Object} user - The current user object
 * @param {Object} learningSession - The current learning session
 * @param {Function} setUser - Function to update user state
 * @param {Service} service - The service instance with GitHub operations
 * @param {Object} course - The current course object
 * @param {Function} setLearningSession - Function to update learning session state
 */
function useCourseOperations(user, setUser, service, learningSession, setLearningSession, setSettings) {
  const courseCache = React.useRef(new Map());

  async function login(user) {
    setUser(user);
  }

  async function logout() {
    await addProgress(null, null, 'userLogout', 0, { method: 'inApp' });
    setUser(null);
    service.logout();
  }

  function getEnrollmentUiSettings(courseId) {
    return service.getEnrollmentUiSettings(courseId);
  }

  function saveEnrollmentUiSettings(courseId, updatedSettings) {
    if (courseId) {
      const settings = service.saveEnrollmentUiSettings(courseId, updatedSettings);
      setSettings(settings);
      return settings;
    }
    return {};
  }

  function setSidebarVisible(visible) {
    if (learningSession?.course) {
      saveEnrollmentUiSettings(learningSession.course.id, { sidebarVisible: visible });
      setSettings((prev) => ({ ...prev, sidebarVisible: visible }));
    }
  }

  function courseCatalog() {
    const unfilteredCatalog = service.courseCatalog();
    return unfilteredCatalog.filter((entry) => entry.settings?.state === 'published' || user?.isEditor(entry.id));
  }

  async function getTemplateRepositories(gitHubAccount) {
    const token = user.getSetting('gitHubToken');

    return service.getTemplateRepositories(token, gitHubAccount);
  }

  async function createCourse(generateWithAi, sourceAccount, sourceRepo, catalogEntry, gitHubToken, setUpdateMessage) {
    return createCourseInternal(service, user, generateWithAi, sourceAccount, sourceRepo, catalogEntry, gitHubToken, setUpdateMessage);
  }

  async function getCourse(courseId) {
    const courseEntry = courseCatalog().find((c) => c.id === courseId);
    if (!courseEntry) {
      return null;
    }

    if (!courseCache.current.has(courseId)) {
      const course = await Course.load(courseEntry);
      if (course) {
        courseCache.current.set(courseId, course);
      }
      return course;
    }
    return courseCache.current.get(courseId);
  }

  function setCurrentCourse(updatedCourse) {
    if (updatedCourse) {
      courseCache.current.delete(updatedCourse.id);
      setLearningSession({ course: updatedCourse, topic: updatedCourse.allTopics[0] });
    } else if (learningSession?.course) {
      courseCache.current.delete(learningSession.course.id);
      setLearningSession(null);
    }
  }

  async function updateCourseStructure(course, updatedTopic, commitMessage = 'update course structure') {
    const token = user.getSetting('gitHubToken', course.id);
    if (user.isEditor(course.id) && token) {
      const updatedCourse = await _updateCourseStructure(token, course, commitMessage);
      const topic = updatedTopic || learningSession?.topic;
      if (topic) {
        setLearningSession({ ...learningSession, course: updatedCourse, topic });
      }
    }
  }

  async function _updateCourseStructure(token, course, commitMessage = 'update course structure') {
    const courseData = {
      title: course.title,
      links: course.links ? Object.fromEntries(Object.entries(course.links).filter(([key]) => key !== 'gitHub')) : undefined,
      externalRefs: course.externalRefs,
      modules: course.modules.map((module) => ({
        title: module.title,
        externalRefs: module.externalRefs,
        topics: module.topics.map((topic) => ({
          title: topic.title,
          type: topic.type,
          path: topic.path.replace(`${course.links.gitHub.rawUrl}/`, ''),
          id: topic.id || generateId(),
          state: topic.state,
          description: topic.description,
          commit: topic.commit,
          externalRefs: topic.externalRefs,
        })),
      })),
    };

    const courseJson = JSON.stringify(courseData, null, 2);
    const gitHubUrl = `${course.links.gitHub.apiUrl}/course.json`;

    const commit = await service.updateGitHubFile(gitHubUrl, courseJson, token, commitMessage);
    await service.saveCatalogEntry({ id: course.id, gitHub: { ...course.gitHub, commit } });
    courseCache.current.set(course.id, course);

    return course;
  }

  async function addModule(title) {
    if (!learningSession?.course) return;
    if (!title.trim()) return;
    const updatedCourse = Course.copy(learningSession.course);
    updatedCourse.modules.push({
      id: generateId(),
      title: title.trim(),
      topics: [],
    });
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

    await updateCourseStructure(updatedCourse, null, `add(module) ${title.trim()}`);
  }

  async function renameModule(moduleIndex, newTitle) {
    if (!newTitle || !newTitle.trim()) return;
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const updatedCourse = Course.copy(course);
    const mod = updatedCourse.modules[moduleIndex];
    if (!mod) return;
    mod.title = newTitle.trim();
    updatedCourse.modules[moduleIndex] = mod;
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

    await updateCourseStructure(updatedCourse, null, `rename(module) ${mod.title}`);
  }

  async function removeModule(moduleIndex) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const mod = course.modules[moduleIndex];
    if (!mod) return;

    // Remove topics in reverse order to avoid index shifting
    for (let i = mod.topics.length - 1; i >= 0; i--) {
      const topic = mod.topics[i];
      await removeTopic(moduleIndex, i, course, topic);
    }

    // Remove the module itself and commit
    const updatedCourse = Course.copy(learningSession.course);
    updatedCourse.modules.splice(moduleIndex, 1);
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
    await updateCourseStructure(updatedCourse, null, `remove(module) ${mod.title}`);
  }

  async function generateTopic(topicId, prompt) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const token = user.getSetting('gitHubToken', course.id);
    if (user.isEditor(course.id) && token) {
      try {
        const updatedCourse = Course.copy(course);
        const topic = updatedCourse.topicFromId(topicId);
        topic.description = prompt;
        topic.state = 'published';

        const basicContent = await generateTopicContent(topic, prompt);
        if (basicContent) {
          const gitHubUrl = topic.path.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
          await service.updateGitHubFile(gitHubUrl, basicContent, token, `add(topic) ${topic.title}`);
        }

        await updateCourseStructure(updatedCourse, topic, `add(course) topic '${topic.title}'`);
      } catch (error) {
        throw new Error(`Failed to generate topic. ${error.message}`);
      }
    }
  }

  async function generateTopics(topicList, progressCallback, isCancelled) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const token = user.getSetting('gitHubToken', course.id);
    if (user.isEditor(course.id) && token) {
      try {
        const updatedCourse = Course.copy(course);
        for (let i = 0; i < topicList.length && !isCancelled(); i++) {
          const topic = updatedCourse.topicFromId(topicList[i].id);
          progressCallback && (await progressCallback(topic, i));
          topic.state = 'published';

          const basicContent = await generateTopicContent(topic, topic.description);
          if (basicContent) {
            console.log('Generated content:', basicContent.substring(0, 200) + '...');
            const gitHubUrl = topic.path.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
            await service.updateGitHubFile(gitHubUrl, basicContent, token, `add(topic) ${topic.title}`);
          }
        }

        await updateCourseStructure(updatedCourse, null, `add(course) topics`);
      } catch (error) {
        throw new Error(`Failed to generate topics. ${error.message}`);
      }
    }
  }

  async function addTopic(moduleIndex, topicTitle, topicDescription, topicType) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    topicTitle = topicTitle.trim();
    topicType = topicType || 'instruction';
    if (!topicTitle) return;

    const token = user.getSetting('gitHubToken', course.id);
    if (user.isEditor(course.id) && token) {
      try {
        const newTopic = {
          id: generateId(),
          title: topicTitle,
          type: topicType,
          path: _generateTopicPath(course, topicTitle, topicType),
          description: topicDescription,
        };

        const updatedCourse = Course.copy(course);
        const module = updatedCourse.modules[moduleIndex];
        module.topics.push(newTopic);

        updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

        const basicContent = await generateTopicContent(newTopic, topicDescription);
        if (basicContent) {
          const gitHubUrl = newTopic.path.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
          await service.commitGitHubFile(gitHubUrl, basicContent, token, `add(topic) ${newTopic.title}`);
        }

        await updateCourseStructure(updatedCourse, newTopic, `add(course) topic '${newTopic.title}'`);
      } catch (error) {
        alert(`Failed to add topic: ${error.message}`);
      }
    }
  }

  async function getTopic(topic, commit = null) {
    if (!topic || topic?.type === 'video') return '';

    if (!commit && topic.commit) {
      commit = topic.commit;
    }

    let url = topic.path;
    if (commit) {
      url = topic.path.replace(/(\/main\/)/, `/${commit}/`);
    }

    if (learningSession?.course && learningSession.course.markdownCache.has(url)) {
      return learningSession.course.markdownCache.get(url);
    }

    const response = await fetch(url);
    const markdown = await response.text();
    if (learningSession?.course) {
      learningSession.course.markdownCache.set(url, markdown);
    }

    return markdown;
  }

  async function updateTopic(topic, content, commitMessage = `update(${topic.title})`) {
    const token = user.getSetting('gitHubToken', learningSession.course.id);
    await _updateTopic(token, learningSession.course, topic, content, commitMessage);
  }

  async function _updateTopic(token, course, topic, content, commitMessage = `update(${topic.title})`) {
    const contentPath = topic.path.match(/\/main\/(.+)$/);
    const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}`;

    let updatedCourse = Course.copy(course);
    const updatedTopic = updatedCourse.topicFromId(topic.id);

    const commit = await service.updateGitHubFile(gitHubUrl, content, token, commitMessage);
    updatedTopic.commit = commit;
    course.markdownCache.set(topic.path, content);

    updatedCourse = await _updateCourseStructure(token, updatedCourse, `update(course) topic ${topic.title}`);
    setLearningSession({ ...learningSession, course: updatedCourse, topic: updatedTopic });
  }

  async function renameTopic(moduleIdx, topicIdx, newTitle, newDescription, newType) {
    if (!newTitle.trim()) return;
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const updatedCourse = Course.copy(course);
    const topic = updatedCourse.modules[moduleIdx].topics[topicIdx];
    if (!topic) return;
    topic.title = newTitle.trim();
    topic.description = newDescription.trim();
    topic.type = newType || topic.type;
    updatedCourse.modules[moduleIdx].topics[topicIdx] = topic;
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

    await updateCourseStructure(updatedCourse, topic, `rename(course) topic ${topic.title} with type ${topic.type}`);
  }

  async function removeTopic(moduleIndex, topicIndex, course, topic) {
    const token = user.getSetting('gitHubToken', course.id);
    const contentPath = topic.path.match(/\/main\/(.+)\/[^\/]+\.md$/);
    if (contentPath) {
      const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}`;
      await service.deleteGitHubFolder(gitHubUrl, token, `remove(topic) ${topic.title}`);
    }

    const updatedCourse = Course.copy(course);
    updatedCourse.modules[moduleIndex].topics.splice(topicIndex, 1);
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

    // If the removed topic was the current topic, navigate to the first topic
    let currentTopic = learningSession?.topic;
    if (currentTopic && currentTopic.path === topic.path) {
      const firstTopic = updatedCourse.allTopics[0];
      if (firstTopic) {
        currentTopic = firstTopic;
      }
    }

    await updateCourseStructure(updatedCourse, currentTopic, `remove(course) topic ${topic.title}`);
  }

  function getAdjacentTopic(direction = 'prev') {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    return course.adjacentTopic(learningSession.topic.path, direction);
  }

  async function deleteTopicFiles(topic, files) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const token = user.getSetting('gitHubToken', course.id);

    files.forEach(async (file) => {
      const contentPath = topic.path.match(/\/main\/((?:.+\/)?)[^\/]+\.md$/);
      const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}${file}`;
      await service.deleteGitHubFile(gitHubUrl, token, `remove(topic) file ${file}`);
    });
  }

  async function addTopicFiles(files) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const token = user.getSetting('gitHubToken', course.id);
    const commitMessage = `enhance(topic) ${learningSession.topic.title} with new file`;

    files.forEach(async (file) => {
      const contentPath = learningSession.topic.path.match(/\/main\/((?:.+\/)?)[^\/]+\.md$/);
      const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}${file.name}`;

      const reader = new FileReader();
      reader.onload = () => {
        file.content = new Uint8Array(reader.result);
        service.commitGitHubFile(gitHubUrl, file.content, token, commitMessage);
      };
      reader.readAsArrayBuffer(file.props);
    });
  }

  async function getTopicFiles() {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    let fetchUrl = learningSession.topic.path.substring(0, learningSession.topic.path.lastIndexOf('/'));
    fetchUrl = fetchUrl.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
    const token = user.getSetting('gitHubToken', course.id);
    const res = await service.makeGitHubApiRequest(token, fetchUrl);

    if (res.ok) {
      const data = await res.json();

      const files = data.filter((file) => file.type !== 'dir');

      let topicPath = _getTopicPath();
      files.forEach((file) => {
        file.path = `${topicPath}${file.name}`;
      });

      return files;
    }
    return [];
  }
  function _getTopicPath() {
    let topicPath = '';
    const match = learningSession.topic.path.match(/\/main\/(.+\/)[^\/]+\.md$/);
    if (match) {
      topicPath = match[1];
    }
    return topicPath;
  }

  async function generateTopicContent(topic, topicDescription) {
    let basicContent = `
# ${topic.title}

![Topic Cover](https://raw.githubusercontent.com/csinstructiontemplate/emptycourse/refs/heads/main/cover.jpg)

${topicDescription || 'overview content placeholder'}`;

    switch (topic.type) {
      case 'video':
        return null;
      case 'exam':
        if (topicDescription && topicDescription.trim().length > 0) {
          basicContent = await aiExamGenerator(learningSession.course.description, topic.title, topicDescription);
        }
        break;
      case 'project':
        basicContent = `# Project: ${topic.title}\n\n## Objectives\n\n- Objective 1\n- Objective 2\n\n## Instructions\n\n1. Step 1\n2. Step 2\n3. Step 3\n\n## Deliverables\n\n- Deliverable 1\n- Deliverable 2\n`;
        break;
      default:
        if (topicDescription && topicDescription.trim().length > 0) {
          basicContent = await aiTopicGenerator(learningSession.course.description, topic.title, topicDescription);
        }
        break;
    }

    return basicContent;
  }

  async function getChoiceQuizFeedback(data) {
    return aiChoiceQuizFeedbackGenerator(data, user);
  }

  async function getEssayQuizFeedback(data) {
    return aiEssayQuizFeedbackGenerator(data, user);
  }

  async function getExamState() {
    if (learningSession?.enrollment && learningSession?.topic) {
      const progress = await service.getProgress({ type: 'exam', topicId: learningSession.topic.id, enrollmentId: learningSession.enrollment.id });
      if (progress && progress.data.length > 0) {
        return progress.data[0];
      }
    }
    return { details: { state: 'notStarted' } };
  }

  async function addProgress(providedUser, activityId, type, duration = 0, details = {}, createdAt = undefined) {
    const progressUser = providedUser || user;
    if (progressUser) {
      return service.addProgress(progressUser.id, learningSession?.course?.id, learningSession?.enrollment?.id, learningSession?.topic?.id, activityId, type, duration, details, createdAt);
    }
  }

  async function getProgress({ courseId, enrollmentId, userId, topicId = null, activityId = null, type = null, startDate = null, endDate = null, page = 1, limit = 100 }) {
    return service.getProgress({ courseId, enrollmentId, userId, topicId, activityId, type, startDate, endDate, page, limit });
  }

  async function getQuizProgress() {
    if (!learningSession?.enrollment || !learningSession?.topic) return {};

    const progressItems = await getProgress({ topicId: learningSession.topic.id, enrollmentId: learningSession.enrollment.id, type: 'quizSubmit' });
    return progressItems.data.reduce((acc, item) => {
      const activityId = item.activityId;
      if (!acc[activityId] || new Date(item.creationDate) > new Date(acc[activityId].creationDate)) {
        acc[activityId] = item;
      }
      return acc;
    }, {});
  }

  async function getSurveySummary(activityId) {
    const progressItems = await getProgress({ activityId, type: 'quizSubmit', limit: 1000 });
    // Only use the user's latest submission
    const users = progressItems.data.reduce((acc, item) => {
      const userId = item.userId;
      if (!acc[userId] || new Date(item.creationDate) > new Date(acc[userId].creationDate)) {
        acc[userId] = item;
      }
      return acc;
    }, {});

    const results = {};
    Object.values(users).forEach((userProgress) => {
      const answers = userProgress.details.selected;
      answers.forEach((answer) => {
        results[answer] = results[answer] ? (results[answer] += 1) : 1;
      });
    });

    return results;
  }

  async function repairCanvas(course, canvasCourseId, setUpdateMessage) {
    const token = user.getSetting('gitHubToken', course.id);
    if (!(await service.verifyGitHubAccount(token))) throw new Error('You do not have permission to associate this course with canvas.');

    const updatedCourse = Course.copy(course);
    updatedCourse.externalRefs = { ...updatedCourse.externalRefs, canvasCourseId };

    let pagePos = 1;
    const desiredCount = 20;
    let count = desiredCount;
    const pages = [];
    while (count == desiredCount) {
      const canvasPages = await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/pages?page=${pagePos}&per_page=${desiredCount}`, 'GET');
      pages.push(...canvasPages);
      count = canvasPages.length;
      pagePos++;
    }

    for (const page of pages) {
      setUpdateMessage(`Updating Canvas page reference for '${page.title}'`);
      const topic = updatedCourse.allTopics.find((topic) => topic.title === page.title);
      if (topic) {
        topic.externalRefs = { ...topic.externalRefs, canvasPageId: page.page_id };
        console.log(`Checking page '${page.title}' topic:${page.page_id}`);
      }
    }

    setUpdateMessage(`Updating course information`);
    await updateCourseStructure(updatedCourse, null, `exported to canvas courseId ${canvasCourseId}`);
  }

  async function exportToCanvas(course, canvasCourseId, deleteExisting, setUpdateMessage) {
    const token = user.getSetting('gitHubToken', course.id);
    if (!(await service.verifyGitHubAccount(token))) throw new Error('You do not have permission to associate this course with canvas.');

    const updatedCourse = Course.copy(course);
    updatedCourse.externalRefs = { ...updatedCourse.externalRefs, canvasCourseId };

    if (deleteExisting) {
      setUpdateMessage(`Cleaning up existing Canvas course content`);
      await cleanCanvasCourse(canvasCourseId, setUpdateMessage);
    }

    // create the modules and pages first
    for (const module of updatedCourse.modules) {
      setUpdateMessage(`Creating module '${module.title}' in Canvas`);
      const canvasModule = await createCanvasModule(module, canvasCourseId);
      module.externalRefs = { ...module.externalRefs, canvasModuleId: canvasModule.id };
      for (const topic of module.topics) {
        setUpdateMessage(`Creating topic '${topic.title}' in Canvas`);
        const canvasPage = await createCanvasPage(topic, canvasCourseId, canvasModule);
        topic.externalRefs = { ...topic.externalRefs, canvasPageId: canvasPage.page_id };
      }
    }

    // now update the modules and pages with content
    for (const module of updatedCourse.modules) {
      await publishCanvasModule(module, canvasCourseId);
      for (const topic of module.topics) {
        try {
          setUpdateMessage(`Exporting topic '${topic.title}' to Canvas`);
          await updateCanvasPage(updatedCourse, topic, canvasCourseId);
        } catch (error) {
          console.error(`Failed to export topic '${topic.title}' to Canvas: ${error.message}`);
          setUpdateMessage(`Failed to export topic '${topic.title}' to Canvas: ${error.message}`);
        }
      }
    }

    setUpdateMessage(`Updating course information`);
    await updateCourseStructure(updatedCourse, null, `exported to canvas courseId ${canvasCourseId}`);
  }

  async function createCanvasModule(module, canvasCourseId) {
    const body = {
      module: {
        name: module.title,
        published: true,
      },
    };

    return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules`, 'POST', body);
  }

  async function publishCanvasModule(module, canvasCourseId) {
    const body = {
      module: {
        published: true,
      },
    };

    return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules/${module.externalRefs.canvasModuleId}`, 'PUT', body);
  }

  async function createCanvasPage(topic, canvasCourseId, canvasModule = null) {
    const body = {
      wiki_page: {
        title: topic.title,
        body: `<h1>${topic.title}</h1>`,
        published: true,
        front_page: false,
      },
    };

    const canvasPage = await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/pages`, 'POST', body);

    if (canvasModule) {
      await addPageToModule(canvasModule, canvasPage, canvasCourseId);
    }
    return canvasPage;
  }

  async function updateCanvasPage(course, topic, canvasCourseId) {
    let html = '';
    if (topic.type === 'video') {
      const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
      const match = topic.path.match(regExp);
      if (match) {
        html = `<iframe style="width: 1280px; height: 720px; max-width: 100%;" src="https://www.youtube.com/embed/${match[1]}" title="${topic.title} YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />`;
      }
    } else {
      let md = await getTopic(topic);
      // Canvas inserts its own title header, so remove any top-level headers from the markdown
      md = md.replace(/^\w*#\s.+\n/gm, '');
      html = ReactDOMServer.renderToStaticMarkup(<MarkdownStatic course={course} topic={topic} content={md} languagePlugins={[]} />);
    }

    const body = {
      wiki_page: {
        title: topic.title,
        body: html,
        published: true,
      },
    };

    return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/pages/${topic.externalRefs.canvasPageId}`, 'PUT', body);
  }

  async function addPageToModule(canvasModule, canvasPage, canvasCourseId) {
    const body = {
      module_item: {
        type: 'Page',
        page_url: canvasPage.url,
        title: canvasPage.title,
        published: true,
      },
    };

    return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules/${canvasModule.id}/items`, 'POST', body);
  }

  async function cleanCanvasCourse(canvasCourseId, setUpdateMessage) {
    let pagePos = 1;
    const desiredCount = 20;
    let count = desiredCount;
    const pages = [];
    while (count == desiredCount) {
      const canvasPages = await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/pages?page=${pagePos}&per_page=${desiredCount}`, 'GET');
      pages.push(...canvasPages);
      count = canvasPages.length;
      pagePos++;
    }

    for (const page of pages) {
      setUpdateMessage(`Deleting Canvas page '${page.title}'`);
      await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/pages/${page.page_id}`, 'DELETE');
    }

    count = desiredCount;
    const modules = [];
    pagePos = 1;
    while (count == desiredCount) {
      const canvasModules = await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules?page=${pagePos}&per_page=${desiredCount}`, 'GET');
      modules.push(...canvasModules);
      count = canvasModules.length;
      pagePos++;
    }

    for (const module of modules) {
      setUpdateMessage(`Deleting Canvas module '${module.name}'`);
      await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules/${module.id}`, 'DELETE');
    }
  }

  function _generateTopicPath(course, topicTitle, topicType) {
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
    login,
    logout,
    user,
    getEnrollmentUiSettings,
    saveEnrollmentUiSettings,
    setSidebarVisible,
    courseCatalog,
    getCourse,
    setCurrentCourse,
    getTemplateRepositories,
    createCourse,
    updateCourseStructure,
    addModule,
    renameModule,
    removeModule,
    addTopic,
    generateTopic,
    generateTopics,
    getTopic,
    removeTopic,
    renameTopic,
    updateTopic,
    getAdjacentTopic,
    addTopicFiles,
    deleteTopicFiles,
    getTopicFiles,
    getEssayQuizFeedback,
    getChoiceQuizFeedback,
    addProgress,
    getProgress,
    getQuizProgress,
    getSurveySummary,
    getExamState,
    repairCanvas,
    exportToCanvas,
    updateCanvasPage,
    service,
  };
}

export default useCourseOperations;
