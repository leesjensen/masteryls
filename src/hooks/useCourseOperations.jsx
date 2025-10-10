import { aiCourseGenerator, aiCourseOverviewGenerator, aiTopicGenerator, aiQuizFeedbackGenerator } from '../ai/aiContentGenerator';
import Course from '../course';

/**
 * @typedef {import('../service/service.ts').default} Service
 */

/**
 * Custom hook for course operations
 * @param {Object} user - The current user object
 * @param {Function} setUser - Function to update user state
 * @param {Service} service - The service instance with GitHub operations
 * @param {Object} course - The current course object
 * @param {Function} setCourse - Function to update course state
 * @param {Object} currentTopic - The currently selected topic
 * @param {Function} setTopic - Function to update current topic
 * @param {Object} enrollment - The current enrollment
 * @param {Function} setEnrollment - Function to update enrollment state
 */
function useCourseOperations(user, setUser, service, course, setCourse, setSettings, currentTopic, setTopic) {
  function logout() {
    setUser(null);
    service.logout();
  }

  function getEnrollmentUiSettings(courseId) {
    const defaultEnrollmentSettings = { editing: true, tocIndexes: [0], sidebarVisible: true, sidebarWidth: 300, currentTopic: null };

    if (courseId) {
      const settings = localStorage.getItem(`uiSettings-${courseId}`);
      if (settings) {
        return JSON.parse(settings);
      } else {
        localStorage.setItem(`uiSettings-${courseId}`, JSON.stringify(defaultEnrollmentSettings));
      }
    }
    return defaultEnrollmentSettings;
  }

  function saveEnrollmentUiSettings(courseId, updatedSettings) {
    if (courseId) {
      const settings = { ...getEnrollmentUiSettings(courseId), ...updatedSettings };
      localStorage.setItem(`uiSettings-${courseId}`, JSON.stringify(settings));
      setSettings(settings);
      return settings;
    }
    return {};
  }

  function setSidebarVisible(visible) {
    if (course) {
      saveEnrollmentUiSettings(course.id, { sidebarVisible: visible });
      setSettings((prev) => ({ ...prev, sidebarVisible: visible }));
    }
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
      setUser(await service.currentUser());
      enrollment = await service.createEnrollment(user.id, newCatalogEntry);

      setUpdateMessage('Saving course structure');
      const gitHubUrl = `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/contents/course.json`;
      const commit = await service.commitGitHubFile(gitHubUrl, courseText, gitHubToken, 'add(course) generated content structure');

      setUpdateMessage('Finalizing course creation');
      await service.saveCourseSettings({ id: newCatalogEntry.id, gitHub: { ...newCatalogEntry.gitHub, commit } });
      const course = await Course.create(newCatalogEntry);
      setCourse(course);
      setTopic(course.allTopics[0]);

      const settings = saveEnrollmentUiSettings(course.id, { editing: true });
      setSettings(settings);
    } else {
      newCatalogEntry = await service.createCourseFromTemplate(sourceAccount, sourceRepo, catalogEntry, gitHubToken);
      await service.addUserRole(user, 'editor', newCatalogEntry.id, { gitHubToken });
      setUser(await service.currentUser());
      enrollment = await service.createEnrollment(user.id, newCatalogEntry);

      const course = await Course.create(newCatalogEntry);
      setCourse(course);
      setSettings(getEnrollmentUiSettings(course.id));
      await _populateTemplateTopics(course, ['Introduction', 'Syllabus', 'Overview'], gitHubToken);
    }
    return enrollment;
  }

  function loadCourse(loadingEnrollment) {
    Course.create(loadingEnrollment.catalogEntry).then((loadedCourse) => {
      service.setCurrentCourse(loadedCourse.id);
      setCourse(loadedCourse);

      const settings = getEnrollmentUiSettings(loadedCourse.id);
      setSettings(settings);
      if (settings.currentTopic) {
        setTopic(loadedCourse.topicFromPath(settings.currentTopic));
      } else {
        setTopic(loadedCourse.allTopics[0] || { title: '', path: '' });
      }
    });
  }

  async function updateCourseStructure(updatedCourse, commitMessage = 'update course structure') {
    const token = user.getSetting('gitHubToken', updatedCourse.id);
    if (user.isEditor(updatedCourse.id) && token) {
      await _updateCourseStructure(token, updatedCourse, commitMessage);
    }
  }

  async function _updateCourseStructure(token, updatedCourse, commitMessage = 'update course structure') {
    const courseData = {
      title: updatedCourse.title,
      schedule: updatedCourse.schedule ? updatedCourse.schedule.replace(`${updatedCourse.links.gitHub.rawUrl}/`, '') : undefined,
      syllabus: updatedCourse.syllabus ? updatedCourse.syllabus.replace(`${updatedCourse.links.gitHub.rawUrl}/`, '') : undefined,
      links: updatedCourse.links ? Object.fromEntries(Object.entries(updatedCourse.links).filter(([key]) => key !== 'gitHub')) : undefined,
      modules: updatedCourse.modules.map((module) => ({
        title: module.title,
        topics: module.topics.map((topic) => ({
          title: topic.title,
          type: topic.type,
          path: topic.path.replace(`${updatedCourse.links.gitHub.rawUrl}/`, ''),
          id: topic.id || _generateId(),
          state: topic.state,
          description: topic.description,
          commit: topic.commit,
        })),
      })),
    };

    const courseJson = JSON.stringify(courseData, null, 2);
    const gitHubUrl = `${updatedCourse.links.gitHub.apiUrl}/course.json`;

    const commit = await service.updateGitHubFile(gitHubUrl, courseJson, token, commitMessage);
    await service.saveCourseSettings({ id: updatedCourse.id, gitHub: { ...updatedCourse.gitHub, commit } });
  }

  function closeCourse() {
    setCourse(null);
    service.removeCurrentCourse();
  }

  async function addModule(title) {
    if (!title.trim()) return;
    const updatedCourse = Course.copy(course);
    updatedCourse.modules.push({
      id: _generateId(),
      title: title.trim(),
      topics: [],
    });
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
    setCourse(updatedCourse);
    await updateCourseStructure(updatedCourse, `add(module) ${title.trim()}`);
  }

  async function generateTopic(topic, prompt) {
    const token = user.getSetting('gitHubToken', course.id);
    if (user.isEditor(course.id) && token) {
      try {
        const updatedCourse = Course.copy(course);
        topic = updatedCourse.topicFromPath(topic.path);
        topic.description = prompt;
        topic.state = 'stable';
        setCourse(updatedCourse);

        const basicContent = await generateTopicContent(topic, prompt);
        if (basicContent) {
          const gitHubUrl = topic.path.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
          await service.commitGitHubFile(gitHubUrl, basicContent, token, `add(topic) ${topic.title}`);
        }

        await updateCourseStructure(updatedCourse, `add(course) topic '${topic.title}'`);

        changeTopic(topic);
      } catch (error) {
        alert(`Failed to generate topic: ${error.message}`);
      }
    }
  }

  async function addTopic(moduleIndex, topicTitle, topicDescription, topicType) {
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
        setCourse(updatedCourse);

        const basicContent = await generateTopicContent(newTopic, topicDescription);
        if (basicContent) {
          const gitHubUrl = newTopic.path.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
          await service.commitGitHubFile(gitHubUrl, basicContent, token, `add(topic) ${newTopic.title}`);
        }

        await updateCourseStructure(updatedCourse, `add(course) topic '${newTopic.title}'`);

        changeTopic(newTopic);
      } catch (error) {
        alert(`Failed to add topic: ${error.message}`);
      }
    }
  }

  async function getTopicMarkdown(topic) {
    // We want to move the cache here.
    // if (this.markdownCache.has(topic.path)) {
    //   return this.markdownCache.get(topic.path);
    // }

    let url = topic.path;
    if (topic.commit) {
      url = topic.path.replace(/(\/main\/)/, `/${topic.commit}/`);
    }

    return _downloadTopicMarkdown(url);
  }

  async function updateTopic(topic, content, commitMessage = `update(${topic.title})`) {
    const token = user.getSetting('gitHubToken', course.id);
    const [updatedCourse, updatedTopic] = await _updateTopic(token, course, topic, content, commitMessage);
    setCourse(updatedCourse);

    return updatedTopic;
  }

  async function _updateTopic(token, course, topic, content, commitMessage = `update(${topic.title})`) {
    const contentPath = topic.path.match(/\/main\/(.+)$/);
    const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}`;

    const updatedCourse = Course.copy(course);
    const updatedTopic = updatedCourse.topicFromPath(topic.path);

    const commit = await service.updateGitHubFile(gitHubUrl, content, token, commitMessage);
    updatedTopic.commit = commit;
    await _updateCourseStructure(token, updatedCourse, `update(course) topic ${topic.title}`);

    return [updatedCourse, updatedTopic];
  }

  async function renameTopic(moduleIdx, topicIdx, newTitle, newType) {
    if (!newTitle.trim()) return;
    const updatedCourse = Course.copy(course);
    const topic = updatedCourse.modules[moduleIdx].topics[topicIdx];
    if (!topic) return;
    topic.title = newTitle.trim();
    topic.type = newType || topic.type;
    updatedCourse.modules[moduleIdx].topics[topicIdx] = topic;
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
    setCourse(updatedCourse);
    await updateCourseStructure(updatedCourse, `rename(course) topic ${topic.title} with type ${topic.type}`);
  }

  async function removeTopic(moduleIndex, topicIndex) {
    const topic = course.modules[moduleIndex].topics[topicIndex];
    if (!confirm(`Are you sure you want to remove "${topic.title}"?`)) return;

    try {
      const token = user.getSetting('gitHubToken', course.id);
      const contentPath = topic.path.match(/\/main\/(.+)\/[^\/]+\.md$/);
      const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}`;
      await service.deleteGitHubFolder(gitHubUrl, token, `remove(topic) ${topic.title}`);

      const updatedCourse = Course.copy(course);
      updatedCourse.modules[moduleIndex].topics.splice(topicIndex, 1);
      updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

      setCourse(updatedCourse);
      await updateCourseStructure(updatedCourse, `remove(course) topic ${topic.title}`);

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

  async function discardTopicMarkdown(updatedTopic) {
    const updatedCourse = Course.copy(course);
    const topic = updatedCourse.topicFromPath(updatedTopic.path);

    const markdown = await _downloadTopicMarkdown(topic.path);
    updatedCourse.markdownCache.set(topic.path, markdown);
    return [updatedCourse, topic, markdown];
  }

  async function _downloadTopicMarkdown(topicUrl) {
    const response = await fetch(topicUrl);
    const markdown = await response.text();
    //    this.markdownCache.set(topicUrl, markdown);

    return markdown;
  }

  function changeTopic(newTopic) {
    if (newTopic.path !== currentTopic.path) {
      saveEnrollmentUiSettings(course.id, { currentTopic: newTopic.path });
    }

    setTopic(newTopic);
  }

  function navigateToAdjacentTopic(direction = 'prev') {
    const adjacentTopic = course.adjacentTopic(currentTopic.path, direction);
    if (adjacentTopic) {
      changeTopic(adjacentTopic);
    }
  }

  async function addTopicFiles(files) {
    const token = user.getSetting('gitHubToken', course.id);
    const commitMessage = `enhance(topic) ${currentTopic.title} with new file`;

    files.forEach(async (file) => {
      const contentPath = currentTopic.path.match(/\/main\/(.+)\/[^\/]+\.md$/);
      const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}/${file.name}`;

      const reader = new FileReader();
      reader.onload = () => {
        file.content = new Uint8Array(reader.result);
        service.commitGitHubFile(gitHubUrl, file.content, token, commitMessage);
      };
      reader.readAsArrayBuffer(file.props);
    });
  }

  async function getTopicFiles() {
    let fetchUrl = currentTopic.path.substring(0, currentTopic.path.lastIndexOf('/'));
    fetchUrl = fetchUrl.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
    const token = user.getSetting('gitHubToken', course.id);
    const res = await service.makeGitHubApiRequest(token, fetchUrl);

    if (res.ok) {
      const data = await res.json();

      const contentPath = currentTopic.path.match(/\/main\/(.+)\/[^\/]+\.md$/);
      data.forEach((file) => {
        file.path = `${contentPath[1]}/${file.name}`;
      });

      return data;
    }
    return [];
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
      default:
        const apiKey = user.getSetting('geminiApiKey');
        basicContent = await aiTopicGenerator(apiKey, topic.title, topicDescription);
        break;
    }

    return basicContent;
  }

  async function getQuizFeedback(data) {
    const apiKey = user.getSetting('geminiApiKey');
    return aiQuizFeedbackGenerator(apiKey, data);
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
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)).replace(/-/g, '');
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
    logout,
    getEnrollmentUiSettings,
    saveEnrollmentUiSettings,
    setSidebarVisible,
    createCourse,
    loadCourse,
    closeCourse,
    updateCourseStructure,
    addModule,
    addTopic,
    generateTopic,
    getTopicMarkdown,
    removeTopic,
    renameTopic,
    updateTopic,
    changeTopic,
    addTopicFiles,
    getTopicFiles,
    discardTopicMarkdown,
    navigateToAdjacentTopic,
    getQuizFeedback,
  };
}

export default useCourseOperations;
