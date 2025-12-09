import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { aiCourseGenerator, aiCourseOverviewGenerator, aiTopicGenerator, aiExamGenerator, aiEssayQuizFeedbackGenerator, aiChoiceQuizFeedbackGenerator } from '../ai/aiContentGenerator';
import Course from '../course';
import MarkdownStatic from '../components/MarkdownStatic';

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
    return service.courseCatalog();
  }

  async function getTemplateRepositories(gitHubAccount) {
    return service.getTemplateRepositories(gitHubAccount);
  }

  async function createCourse(generateWithAi, sourceAccount, sourceRepo, catalogEntry, gitHubToken, setUpdateMessage) {
    let newCatalogEntry;
    let enrollment;
    if (generateWithAi) {
      const apiKey = user.getSetting('geminiApiKey');

      setUpdateMessage('Using AI to create course topics');

      const messages = ['The gerbil is digging', 'The hamster is running', 'The beaver is building', 'The squirrel is gathering nuts'];
      const messageInterval = setInterval(() => {
        setUpdateMessage(messages[Math.floor(Math.random() * messages.length)]);
      }, 3000);

      const courseText = await aiCourseGenerator(apiKey, catalogEntry.title, catalogEntry.description);
      const courseJson = JSON.parse(courseText);

      clearInterval(messageInterval);

      //const response = await fetch('/cs460.course.json');
      //const courseJson = await response.json();
      // const courseText = JSON.stringify(courseJson, null, 2);

      catalogEntry.outcomes = courseJson.outcomes || [];

      setUpdateMessage('Creating course repository');

      newCatalogEntry = await service.createCourseEmpty(catalogEntry, gitHubToken);

      setUpdateMessage('Creating course overview');

      const overview = await aiCourseOverviewGenerator(apiKey, courseJson);
      const overviewGitHubUrl = `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/contents/README.md`;
      await service.commitGitHubFile(overviewGitHubUrl, overview, gitHubToken, 'add(course) generated overview');

      setUpdateMessage('Creating roles and enrollment');
      await service.addUserRole(user, 'editor', newCatalogEntry.id, { gitHubToken });

      setUpdateMessage('Saving course structure');
      const gitHubUrl = `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/contents/course.json`;
      const commit = await service.commitGitHubFile(gitHubUrl, courseText, gitHubToken, 'add(course) generated content structure');

      setUpdateMessage('Finalizing course creation');
      await service.saveCourseSettings({ id: newCatalogEntry.id, gitHub: { ...newCatalogEntry.gitHub, commit } });
      const course = await Course.create(newCatalogEntry);

      enrollment = await service.createEnrollment(user.id, newCatalogEntry);
      // setLearningSession({ enrollment, course, topic: course.allTopics[0] });

      // const settings = saveEnrollmentUiSettings(course.id, { editing: true });
      // setSettings(settings);
    } else {
      newCatalogEntry = await service.createCourseFromTemplate(sourceAccount, sourceRepo, catalogEntry, gitHubToken);
      await service.addUserRole(user, 'editor', newCatalogEntry.id, { gitHubToken });

      const course = await Course.create(newCatalogEntry);
      courseCache.current.set(course.id, course);

      enrollment = await service.createEnrollment(user.id, newCatalogEntry);
      // setLearningSession({ enrollment, course, topic: course.allTopics[0] });
      // setSettings(getEnrollmentUiSettings(course.id));
      // await _populateTemplateTopics(course, ['Introduction', 'Syllabus', 'Overview'], gitHubToken);
    }
    return enrollment;
  }

  async function getCourse(courseId) {
    const courseEntry = courseCatalog().find((c) => c.id === courseId);
    if (!courseCache.current.has(courseId)) {
      const course = await Course.create(courseEntry);
      courseCache.current.set(courseId, course);
    }
    return courseCache.current.get(courseId);
  }

  function setCurrentCourse(updatedCourse) {
    if (updatedCourse) {
      courseCache.current.set(updatedCourse.id, updatedCourse);
    } else if (learningSession?.course) {
      courseCache.current.delete(learningSession.course.id);
    }
    setLearningSession({ updatedCourse, topic: updatedCourse.allTopics[0] });
  }

  async function updateCourseStructure(updatedCourse, updatedTopic, commitMessage = 'update course structure') {
    const token = user.getSetting('gitHubToken', updatedCourse.id);
    if (user.isEditor(updatedCourse.id) && token) {
      await _updateCourseStructure(token, updatedCourse, updatedTopic, commitMessage);
    }
  }

  async function _updateCourseStructure(token, updatedCourse, updatedTopic, commitMessage = 'update course structure') {
    const courseData = {
      title: updatedCourse.title,
      schedule: updatedCourse.schedule ? updatedCourse.schedule.replace(`${updatedCourse.links.gitHub.rawUrl}/`, '') : undefined,
      syllabus: updatedCourse.syllabus ? updatedCourse.syllabus.replace(`${updatedCourse.links.gitHub.rawUrl}/`, '') : undefined,
      links: updatedCourse.links ? Object.fromEntries(Object.entries(updatedCourse.links).filter(([key]) => key !== 'gitHub')) : undefined,
      externalRefs: updatedCourse.externalRefs,
      modules: updatedCourse.modules.map((module) => ({
        title: module.title,
        externalRefs: module.externalRefs,
        topics: module.topics.map((topic) => ({
          title: topic.title,
          type: topic.type,
          path: topic.path.replace(`${updatedCourse.links.gitHub.rawUrl}/`, ''),
          id: topic.id || _generateId(),
          state: topic.state,
          description: topic.description,
          commit: topic.commit,
          externalRefs: topic.externalRefs,
        })),
      })),
    };

    const courseJson = JSON.stringify(courseData, null, 2);
    const gitHubUrl = `${updatedCourse.links.gitHub.apiUrl}/course.json`;

    const commit = await service.updateGitHubFile(gitHubUrl, courseJson, token, commitMessage);
    await service.saveCourseSettings({ id: updatedCourse.id, gitHub: { ...updatedCourse.gitHub, commit } });
    courseCache.current.set(updatedCourse.id, updatedCourse);

    const updatedLearningSession = { ...learningSession, course: updatedCourse };
    if (updatedTopic) {
      updatedLearningSession.topic = updatedTopic;
    }

    setLearningSession(updatedLearningSession);
  }

  async function addModule(title) {
    if (!learningSession?.course) return;
    if (!title.trim()) return;
    const updatedCourse = Course.copy(learningSession.course);
    updatedCourse.modules.push({
      id: _generateId(),
      title: title.trim(),
      topics: [],
    });
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

    await updateCourseStructure(updatedCourse, null, `add(module) ${title.trim()}`);
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
        topic.state = 'stable';

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
          topic.state = 'stable';

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
          id: _generateId(),
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

  async function getTopicMarkdown(topic) {
    if (!learningSession?.course || learningSession.topic?.type === 'video') return '';

    const course = learningSession.course;
    if (course && course.markdownCache.has(topic.path)) {
      return course.markdownCache.get(topic.path);
    }

    let url = topic.path;
    if (topic.commit) {
      url = topic.path.replace(/(\/main\/)/, `/${topic.commit}/`);
    }

    return _downloadTopicMarkdown(url);
  }

  async function updateTopic(topic, content, commitMessage = `update(${topic.title})`) {
    const token = user.getSetting('gitHubToken', learningSession.course.id);
    await _updateTopic(token, learningSession.course, topic, content, commitMessage);
  }

  async function _updateTopic(token, course, topic, content, commitMessage = `update(${topic.title})`) {
    const contentPath = topic.path.match(/\/main\/(.+)$/);
    const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}`;

    const updatedCourse = Course.copy(course);
    const updatedTopic = updatedCourse.topicFromId(topic.id);

    const commit = await service.updateGitHubFile(gitHubUrl, content, token, commitMessage);
    updatedTopic.commit = commit;
    await _updateCourseStructure(token, updatedCourse, updatedTopic, `update(course) topic ${topic.title}`);
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
    const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}`;
    await service.deleteGitHubFolder(gitHubUrl, token, `remove(topic) ${topic.title}`);

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

  async function discardTopicMarkdown(updatedTopic) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const updatedCourse = Course.copy(course);
    const topic = updatedCourse.topicFromId(updatedTopic.id);

    const markdown = await _downloadTopicMarkdown(topic.path);
    updatedCourse.markdownCache.set(topic.path, markdown);
    setLearningSession({ ...learningSession, course: updatedCourse, topic: topic });

    return markdown;
  }

  async function _downloadTopicMarkdown(topicUrl) {
    const response = await fetch(topicUrl);
    const markdown = await response.text();
    if (learningSession?.course) {
      learningSession.course.markdownCache.set(topicUrl, markdown);
    }

    return markdown;
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
    const apiKey = user.getSetting('geminiApiKey');
    let basicContent = `
# ${topic.title}

![Topic Cover](https://raw.githubusercontent.com/csinstructiontemplate/emptycourse/refs/heads/main/cover.jpg)

${topicDescription || 'overview content placeholder'}`;

    switch (topic.type) {
      case 'video':
        return null;
      case 'exam':
        if (apiKey && topicDescription && topicDescription.trim().length > 0) {
          basicContent = await aiExamGenerator(apiKey, course.description, topic.title, topicDescription);
        }
        break;
      case 'project':
        basicContent = `# Project: ${topic.title}\n\n## Objectives\n\n- Objective 1\n- Objective 2\n\n## Instructions\n\n1. Step 1\n2. Step 2\n3. Step 3\n\n## Deliverables\n\n- Deliverable 1\n- Deliverable 2\n`;
        break;
      default:
        if (apiKey && topicDescription && topicDescription.trim().length > 0) {
          basicContent = await aiTopicGenerator(apiKey, course.description, topic.title, topicDescription);
        }
        break;
    }

    return basicContent;
  }

  async function getChoiceQuizFeedback(data) {
    const apiKey = user.getSetting('geminiApiKey');
    return aiChoiceQuizFeedbackGenerator(apiKey, data);
  }

  async function getEssayQuizFeedback(data) {
    const apiKey = user.getSetting('geminiApiKey');
    if (apiKey) {
      return aiEssayQuizFeedbackGenerator(apiKey, data);
    }
    return { feedback: `Thank you for your submission. Your essay has been recorded.`, percentCorrect: -1 };
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

  async function getProgress({ courseId, enrollmentId, userId, topicId = null, type = null, startDate = null, endDate = null, page = 1, limit = 100 }) {
    return service.getProgress({ courseId, enrollmentId, userId, topicId, type, startDate, endDate, page, limit });
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

  async function exportToCanvas(course) {
    const canvasCourseId = 33932;

    const updatedCourse = Course.copy(course);
    updatedCourse.externalRefs = { ...updatedCourse.externalRefs, canvasCourseId };

    for (const module of updatedCourse.modules) {
      const canvasModule = await createCanvasModule(module, canvasCourseId);
      module.externalRefs = { ...module.externalRefs, canvasModuleId: canvasModule.id };
      for (const topic of module.topics) {
        const canvasPage = await createCanvasPage(topic, canvasCourseId, canvasModule);
        topic.externalRefs = { ...topic.externalRefs, canvasPageId: canvasPage.page_id };
      }

      for (const topic of module.topics) {
        await updateCanvasPage(updatedCourse, topic, canvasCourseId);
      }

      await updateCourseStructure(updatedCourse, null, (commitMessage = `exported to canvas courseId ${canvasCourseId}`));

      break;
    }
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
    const md = await getTopicMarkdown(topic);
    const html = ReactDOMServer.renderToStaticMarkup(<MarkdownStatic course={course} topic={topic} content={md} languagePlugins={[]} />);

    const body = {
      wiki_page: {
        title: topic.title,
        body: html,
        published: true,
      },
    };

    await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/pages/${topic.externalRefs.canvasPageId}`, 'PUT', body);
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

  async function _populateTemplateTopics(course, topicNames, gitHubToken) {
    if (gitHubToken && course.gitHub && course.gitHub.account && course.gitHub.repository) {
      for (const topicName of topicNames) {
        const topic = course.topicFromTitle(topicName);
        if (!topic) continue;
        const markdown = await getTopicMarkdown(topic);

        let variableFound = false;
        const replacedMarkdown = markdown.replace(/%%MASTERYLS_(\w+)%%/g, (_, variable) => {
          variableFound = true;
          const key = variable.toLowerCase();
          const value = course[key] ?? '';
          if (typeof value === 'string') {
            return value;
          } else if (Array.isArray(value)) {
            return value.reduce((acc, item) => acc + `- ${item}\n`, '');
          }
        });
        if (variableFound) {
          await _updateTopic(gitHubToken, course, topic, replacedMarkdown, `update(topic) with template variables`);
        }
      }
    }
  }

  function _generateId() {
    return crypto.randomUUID();
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
    addTopic,
    generateTopic,
    generateTopics,
    getTopicMarkdown,
    removeTopic,
    renameTopic,
    updateTopic,
    getAdjacentTopic,
    addTopicFiles,
    deleteTopicFiles,
    getTopicFiles,
    discardTopicMarkdown,
    getEssayQuizFeedback,
    getChoiceQuizFeedback,
    addProgress,
    getProgress,
    getQuizProgress,
    getExamState,
    exportToCanvas,
    service,
  };
}

export default useCourseOperations;
