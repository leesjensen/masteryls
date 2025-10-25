import React from 'react';
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
 */
function useCourseOperations(user, setUser, service, course, setCourse, setSettings, currentTopic, setTopic) {
  const [enrollment, setEnrollment] = React.useState(null);
  const courseCache = React.useRef(new Map());

  async function logout() {
    await addProgress(null, null, 'userLogout', 0, { method: 'inApp' });
    setUser(null);
    service.logout();
    localStorage.clear();
  }

  function getEnrollmentUiSettings(courseId) {
    const defaultEnrollmentSettings = { editing: true, tocIndexes: [0], sidebarVisible: 'split', sidebarWidth: 300, currentTopic: null };

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

  function courseCatalog() {
    return service.courseCatalog();
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
      courseCache.current.set(course.id, course);
      setCourse(course);
      setSettings(getEnrollmentUiSettings(course.id));
      await _populateTemplateTopics(course, ['Introduction', 'Syllabus', 'Overview'], gitHubToken);
    }
    return enrollment;
  }

  function loadCourseById(courseId) {
    const courseEntry = courseCatalog().find((c) => c.id === courseId);
    if (courseEntry) {
      Course.create(courseEntry).then((loadedCourse) => {
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
  }

  function loadCourse(loadingEnrollment) {
    setEnrollment(loadingEnrollment);
    loadCourseById(loadingEnrollment.catalogEntry.id);
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
    courseCache.current.set(updatedCourse.id, updatedCourse);
    setCourse(updatedCourse);
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
    courseCache.current.delete(updatedCourse.id);
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
          await service.updateGitHubFile(gitHubUrl, basicContent, token, `add(topic) ${topic.title}`);
        }

        await updateCourseStructure(updatedCourse, `add(course) topic '${topic.title}'`);

        changeTopic(topic);
      } catch (error) {
        throw new Error(`Failed to generate topic. ${error.message}`);
      }
    }
  }

  async function generateTopics(topicList, progressCallback, isCancelled) {
    const token = user.getSetting('gitHubToken', course.id);
    if (user.isEditor(course.id) && token) {
      try {
        const updatedCourse = Course.copy(course);
        for (let i = 0; i < topicList.length && !isCancelled(); i++) {
          const topic = updatedCourse.topicFromPath(topicList[i].path);
          progressCallback && (await progressCallback(topic, i));
          topic.state = 'stable';

          const basicContent = await generateTopicContent(topic, topic.description);
          if (basicContent) {
            console.log('Generated content:', basicContent.substring(0, 200) + '...');
            const gitHubUrl = topic.path.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
            await service.updateGitHubFile(gitHubUrl, basicContent, token, `add(topic) ${topic.title}`);
          }
        }

        setCourse(updatedCourse);
        await updateCourseStructure(updatedCourse, `add(course) topics`);
      } catch (error) {
        throw new Error(`Failed to generate topics. ${error.message}`);
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

  async function deleteTopicFiles(topic, files) {
    const token = user.getSetting('gitHubToken', course.id);

    files.forEach(async (file) => {
      const contentPath = topic.path.match(/\/main\/(.+)\/[^\/]+\.md$/);
      const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}/${file}`;
      await service.deleteGitHubFile(gitHubUrl, token, `remove(topic) file ${file}`);
    });
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
    const match = currentTopic.path.match(/\/main\/(.+\/)[^\/]+\.md$/);
    if (match) {
      topicPath = match[1];
    }
    return topicPath;
  }

  async function generateTopicContent(topic, topicDescription) {
    let basicContent = `# ${topic.title}\n\n`;

    switch (topic.type) {
      case 'video':
        return null;
      case 'exam':
        basicContent += `## Exam\n\n### Question 1\n\n\`\`\`masteryls
{"id":"39280", "title":"Multiple choice", "type":"multiple-choice", "body":"Simple **multiple choice** question" }
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`\n`;
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

  async function addProgress(providedUser, activityId, type, duration = 0, details = {}, createdAt = undefined) {
    const progressUser = providedUser || user;
    if (progressUser) {
      return service.addProgress(progressUser.id, course?.id, enrollment?.id, currentTopic?.id, activityId, type, duration, details, createdAt);
    }
  }

  async function getProgress(courseId, enrollmentId, userId, startDate = null, endDate = null) {
    return service.getProgress(courseId, enrollmentId, userId, startDate, endDate);
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

  async function generateRandomData() {
    if (!user?.id || !course?.id || !enrollment?.id) {
      throw new Error('User, course, and enrollment must be available to generate random data');
    }

    const activityTypes = ['instructionView', 'videoWatch', 'quizSubmit', 'topicComplete', 'moduleComplete', 'discussion', 'assignment'];
    const topicIds = course.allTopics.map((topic) => topic.id);
    const activityIds = ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8', '6ba7b811-9dad-11d1-80b4-00c04fd430c8', '6ba7b812-9dad-11d1-80b4-00c04fd430c8', '6ba7b813-9dad-11d1-80b4-00c04fd430c8', '6ba7b814-9dad-11d1-80b4-00c04fd430c8', '6ba7b815-9dad-11d1-80b4-00c04fd430c8', '6ba7b816-9dad-11d1-80b4-00c04fd430c8', '6ba7b817-9dad-11d1-80b4-00c04fd430c8', '6ba7b818-9dad-11d1-80b4-00c04fd430c8', '6ba7b819-9dad-11d1-80b4-00c04fd430c8', '6ba7b81a-9dad-11d1-80b4-00c04fd430c8', '6ba7b81b-9dad-11d1-80b4-00c04fd430c8'];

    // Generate 200-400 random progress records
    const numRecords = Math.floor(Math.random() * 200) + 200;
    const recordsPerDay = Math.ceil(numRecords / 7); // Distribute over 7 days

    console.log(`Generating ${numRecords} random progress records distributed over 7 days...`);

    let totalGenerated = 0;

    for (let day = 0; day < 7; day++) {
      const recordsToday = Math.min(recordsPerDay, numRecords - totalGenerated);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - (6 - day)); // 6-day offset so day 0 is oldest

      for (let i = 0; i < recordsToday; i++) {
        // Random activity type
        const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)];

        // Random topic ID
        const topicId = topicIds[Math.floor(Math.random() * topicIds.length)];

        // Random activity ID
        const activityId = activityIds[Math.floor(Math.random() * activityIds.length)];

        // Random duration based on activity type
        let duration = 0;
        switch (activityType) {
          case 'instructionView':
            duration = Math.floor(Math.random() * 300) + 60; // 1-5 minutes
            break;
          case 'videoWatch':
            duration = Math.floor(Math.random() * 1200) + 300; // 5-20 minutes
            break;
          case 'quizSubmit':
            duration = Math.floor(Math.random() * 600) + 120; // 2-10 minutes
            break;
          case 'topicComplete':
            duration = Math.floor(Math.random() * 1800) + 600; // 10-30 minutes
            break;
          case 'moduleComplete':
            duration = Math.floor(Math.random() * 3600) + 1800; // 30-60 minutes
            break;
          case 'discussion':
            duration = Math.floor(Math.random() * 900) + 180; // 3-15 minutes
            break;
          case 'assignment':
            duration = Math.floor(Math.random() * 7200) + 1800; // 30-120 minutes
            break;
        }

        // Random details based on activity type
        const details = {};
        if (activityType === 'quizSubmit') {
          details.score = Math.floor(Math.random() * 100);
          details.attempts = Math.floor(Math.random() * 3) + 1;
        } else if (activityType === 'videoWatch') {
          details.percentWatched = Math.floor(Math.random() * 100);
          details.playbackSpeed = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0][Math.floor(Math.random() * 6)];
        } else if (activityType === 'assignment') {
          details.status = ['submitted', 'draft', 'graded'][Math.floor(Math.random() * 3)];
          if (details.status === 'graded') {
            details.grade = Math.floor(Math.random() * 100);
          }
        }

        try {
          createdAt.setHours(Math.floor(Math.random() * 24));
          createdAt.setMinutes(Math.floor(Math.random() * 60));
          createdAt.setSeconds(Math.floor(Math.random() * 60));

          await service.addProgress(user.id, course.id, enrollment.id, topicId, activityId, activityType, duration, details, createdAt.toISOString());

          totalGenerated++;
        } catch (error) {
          console.warn(`Failed to add progress record for ${activityId}:`, error);
        }

        // Small delay between records to avoid overwhelming the database
        if (i % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      // Progress update
      console.log(`Generated ${totalGenerated}/${numRecords} records (Day ${day + 1}/7)`);

      if (totalGenerated >= numRecords) break;
    }

    console.log(`Successfully generated ${totalGenerated} random progress records`);
    return { success: true, recordsGenerated: totalGenerated };
  }

  return {
    logout,
    getEnrollmentUiSettings,
    saveEnrollmentUiSettings,
    setSidebarVisible,
    courseCatalog,
    getCourse,
    setCurrentCourse,
    createCourse,
    loadCourse,
    loadCourseById,
    closeCourse,
    updateCourseStructure,
    addModule,
    addTopic,
    generateTopic,
    generateTopics,
    getTopicMarkdown,
    removeTopic,
    renameTopic,
    updateTopic,
    changeTopic,
    addTopicFiles,
    deleteTopicFiles,
    getTopicFiles,
    discardTopicMarkdown,
    navigateToAdjacentTopic,
    getQuizFeedback,
    addProgress,
    getProgress,
    generateRandomData,
    enrollment,
  };
}

export default useCourseOperations;
