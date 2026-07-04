import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { makeSimpleAiRequest, aiTopicGenerator, aiExamGenerator, aiEssayInteractionFeedbackGenerator, aiChoiceInteractionFeedbackGenerator, aiWebPageFeedbackGenerator, aiUrlFeedbackGenerator, aiFileInteractionFeedbackGenerator, aiDraScenarioGenerator, aiDraStakeholderResponseGenerator, aiDraEvaluationGenerator, aiDraCoachGenerator } from '../ai/aiContentGenerator';
import Course from '../course';
import MarkdownStatic from '../components/MarkdownStatic';
import { generateId } from '../utils/utils';
import { resolveSnapshotRawUrl, invalidateRawGitHubSnapshot, setRawGitHubSnapshot } from '../utils/githubRawSnapshot.js';
import { extractInteractionMetas, isSubmittableInteractionType, normalizeInteractionIds } from '../utils/interactionMeta';
import { parseScheduleMarkdown } from '../utils/scheduleMarkdown';
import { createInitialDraMarkdown } from '../utils/draMarkdown';
import { summarizeLikertResponses } from '../utils/likertInteraction';
import { createCourseInternal } from './courseCreation.js';
import { createCanvasSync } from './canvas/canvasSync.js';
import { createCanvasCourseMembershipChecker } from './canvas/canvasMembership.js';

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
function useCourseOperations(user, setUser, service, learningSession, setLearningSession, setSettings, observeSession = null) {
  const courseCache = React.useRef(new Map());
  const discussionToggleHandler = React.useRef(null);
  const canvasMembershipChecker = React.useRef(createCanvasCourseMembershipChecker({ checkLearnerEligibility: (params) => service.checkCanvasGradebookEligibility(params) }));

  function getWorkingCourse() {
    const courseId = learningSession?.course?.id;
    if (!courseId) {
      return learningSession?.course;
    }
    return courseCache.current.get(courseId) || learningSession.course;
  }

  async function login(user) {
    setUser(user);
  }

  async function logout() {
    await addProgress(null, null, 'userLogout', 0, { method: 'inApp' });
    setUser(null);
    service.logout();
  }

  async function updateUserProfile({ name, email }) {
    const result = await service.updateUserProfile({ name, email });
    if (result?.user) {
      setUser(result.user);
    }
    return result;
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

  function toggleSidebar() {
    if (learningSession?.course) {
      const settings = getEnrollmentUiSettings(learningSession.course.id);

      let visible = 'end';
      if (window.innerWidth < 400) {
        visible = settings.sidebarVisible === 'end' ? 'start' : 'end';
      } else {
        visible = settings.sidebarVisible === 'start' ? 'split' : settings.sidebarVisible === 'end' ? 'split' : 'start';
      }

      saveEnrollmentUiSettings(learningSession.course.id, { sidebarVisible: visible });
      setSettings((prev) => ({ ...prev, sidebarVisible: visible }));
    }
  }

  function setDiscussionToggleHandler(handler) {
    discussionToggleHandler.current = handler || null;
  }

  function toggleDiscussion() {
    discussionToggleHandler.current?.();
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
    const courseEntry = service.catalogEntry(courseId);
    if (!courseEntry) {
      return null;
    }

    const isPublished = courseEntry.settings?.state === 'published';
    const canEditCourse = user?.isEditor(courseId);
    let isEnrolledLearner = false;
    if (!isPublished && !canEditCourse && user?.id) {
      const enrollment = await service.enrollment(user.id, courseId);
      isEnrolledLearner = !!enrollment;
    }

    if (!isPublished && !canEditCourse && !isEnrolledLearner) {
      return null;
    }

    if (!courseCache.current.has(courseId)) {
      const course = await Course.load(courseEntry, {
        snapshotRefResolver: async ({ owner, repository, ref }) => service.resolveGitHubSnapshotRef({ owner, repository, ref }),
      });
      if (course) {
        courseCache.current.set(courseId, course);
      }
      return course;
    }
    return courseCache.current.get(courseId);
  }

  async function searchCourse(query) {
    if (!learningSession?.course || !user) return { query, matches: [] };

    const result = await service.searchCourse(learningSession.course.id, query);

    return { query, matches: transformSearchResults(result) };
  }

  async function reindexCourse(courseId) {
    const course = await getCourse(courseId);
    if (!course) throw new Error('Course not found for indexing.');

    const topics = [];
    for (const topic of course.allTopics) {
      if (topic?.state === 'stub') {
        continue;
      }
      let content = await getTopic(topic);
      content = cleanMarkdownForIndexing(content);
      if (content && content.length > 0) {
        topics.push({ id: topic.id, content });
      }
    }

    if (topics.length > 0) {
      await service.indexCourse(courseId, topics);
    }
  }

  function cleanMarkdownForIndexing(md) {
    let text = md;

    // Remove code blocks (```...``` and single backticks)
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`[^`]+`/g, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Remove images ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1');

    // Remove links [text](url) but keep the text
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    // Remove footnote references [^1]
    text = text.replace(/\[\^\d+\]/g, '');

    // Remove headers (#, ##, etc.)
    text = text.replace(/^#{1,6}\s+/gm, '');

    // Remove horizontal rules
    text = text.replace(/^[-*_]{3,}$/gm, '');

    // Remove bold and italic (**text**, *text*, __text__, _text_)
    text = text.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');

    // Remove strikethrough (~~text~~)
    text = text.replace(/~~([^~]+)~~/g, '$1');

    // Remove task list markers (- [ ] or - [x])
    text = text.replace(/^-\s+\[[ x]\]\s+/gm, '');

    // Remove list markers (-, *, +, 1., 2., etc.)
    text = text.replace(/^[\s]*[-*+]\s+/gm, '');
    text = text.replace(/^[\s]*\d+\.\s+/gm, '');

    // Remove blockquote markers (>)
    text = text.replace(/^>\s*/gm, '');

    // Remove table formatting (|)
    text = text.replace(/\|/g, ' ');

    // Remove mentions (@username)
    text = text.replace(/@[\w-]+/g, '');

    // Remove issue/PR references (#123, user/repo#123)
    text = text.replace(/[\w-]+\/[\w-]+#\d+/g, '');
    text = text.replace(/#\d+/g, '');

    // Remove emoji shortcodes (:smile:, :rocket:, etc.)
    text = text.replace(/:[a-z_+-]+:/g, '');

    // Remove color codes (#0969DA)
    text = text.replace(/#[0-9A-Fa-f]{6}/g, '');

    // Normalize whitespace (multiple spaces, tabs, newlines)
    text = text.replace(/\s+/g, ' ').trim();

    return text.trim();
  }

  function transformSearchResults(results) {
    const transformedResults = results.map((item) => ({
      topic: learningSession.course.topicFromId(item.id),
      headlines: item.headline.split(' ... '),
    }));

    return transformedResults.filter((res) => res.topic);
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
    const schedule = course.schedule
      ? {
          id: course.schedule.id || generateId(),
          files: Array.isArray(course.schedule.files)
            ? course.schedule.files.map((file) => ({
                id: file.id,
                title: file.title,
                path: String(file.path || '').replace(`${course.links.gitHub.rawUrl}/`, ''),
                default: Boolean(file.default),
                state: file.state,
              }))
            : [],
        }
      : undefined;

    const courseData = {
      title: course.title,
      links: course.links ? Object.fromEntries(Object.entries(course.links).filter(([key]) => key !== 'gitHub')) : undefined,
      externalRefs: course.externalRefs,
      schedule,
      modules: course.modules.map((module) => ({
        title: module.title,
        externalRefs: module.externalRefs,
        topics: module.topics.map((topic) => ({
          title: topic.title,
          type: topic.type,
          points: topic.points,
          path: topic.path.replace(`${course.links.gitHub.rawUrl}/`, ''),
          id: topic.id || generateId(),
          state: topic.state,
          interactions: topic.interactions,
          description: topic.description,
          externalRefs: topic.externalRefs,
        })),
      })),
    };

    const courseJson = JSON.stringify(courseData, null, 2);
    const gitHubUrl = `${course.links.gitHub.apiUrl}/course.json`;

    const commitSha = await service.updateGitHubFile(gitHubUrl, courseJson, token, commitMessage);
    await service.saveCatalogEntry({ id: course.id, gitHub: { ...course.gitHub } });
    invalidateCourseReadCache(course, commitSha);
    courseCache.current.set(course.id, course);

    return course;
  }

  function defaultPointsForTopicType(topicType) {
    if (topicType === 'exam') {
      return 200;
    }
    if (topicType === 'project') {
      return 100;
    }
    return undefined;
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

  async function unpinAllContent(course) {
    const updatedCourse = Course.copy(learningSession.course);
    updatedCourse.modules.forEach((mod) => {
      mod.topics.forEach((topic) => {
        if (topic.commit) {
          delete topic.commit;
        }
      });
    });

    if (Array.isArray(updatedCourse.schedule?.files)) {
      updatedCourse.schedule.files.forEach((file) => {
        if (file?.commit) {
          delete file.commit;
        }
      });
    }

    await updateCourseStructure(updatedCourse, null, `unpin(all) ${course.title} commits`);
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

        const basicContent = await generateTopicContent(topic, prompt, updatedCourse);
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

          const basicContent = await generateTopicContent(topic, topic.description, updatedCourse);
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

  async function addTopic(moduleIndex, topicTitle, topicDescription, topicType, topicPoints) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    topicTitle = topicTitle.trim();
    topicType = topicType || 'instruction';
    if (!topicTitle) return;
    if (topicType === 'schedule') {
      throw new Error('Schedule is managed at the course level and cannot be created as a topic.');
    }

    const token = user.getSetting('gitHubToken', course.id);
    if (user.isEditor(course.id) && token) {
      try {
        const updatedCourse = Course.copy(course);
        const existingPaths = new Set(updatedCourse.allTopics.map((topic) => topic.path));
        const basePath = _generateTopicPath(course, topicTitle, topicDescription, topicType);
        const resolvedPath = _resolveUniqueTopicPath(course, basePath, existingPaths);

        const newTopic = {
          id: generateId(),
          title: topicTitle,
          type: topicType,
          points: topicPoints ?? defaultPointsForTopicType(topicType),
          path: resolvedPath,
          description: topicDescription,
        };

        const module = updatedCourse.modules[moduleIndex];
        module.topics.push(newTopic);

        updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

        const basicContent = await generateTopicContent(newTopic, topicDescription, updatedCourse);
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
    if (!topic || topic?.type === 'video' || topic?.type === 'embedded') return '';

    let url = topic.path;
    if (commit) {
      url = topic.path.replace(/(\/main\/)/, `/${commit}/`);
    } else {
      const token = user?.getSetting?.('gitHubToken', learningSession?.course?.id);
      url = await resolveSnapshotRawUrl(topic.path, token, async ({ owner, repository, ref }) => service.resolveGitHubSnapshotRef({ owner, repository, ref }));
    }

    topic.snapshotPath = url;

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
    if (topic?.state !== 'stub') {
      service.indexCourse(learningSession.course.id, [{ id: topic.id, content }]);
    }
  }

  async function _updateTopic(token, course, topic, content, commitMessage = `update(${topic.title})`) {
    const contentPath = topic.path.match(/\/main\/(.+)$/);

    let updatedCourse = Course.copy(course);
    const updatedTopic = updatedCourse.topicFromId(topic.id);
    let structureChanged = false;

    if (updatedTopic.type === 'video' || updatedTopic.type === 'embedded') {
      const nextPath = String(content || '').trim();
      if (updatedTopic.path !== nextPath) {
        updatedTopic.path = nextPath;
        structureChanged = true;
      }
    } else {
      const existingIds = new Set((updatedCourse.modules || []).flatMap((m) => (m.topics || []).filter((t) => t.id !== topic.id).flatMap((t) => (Array.isArray(t.interactions) ? t.interactions : []))));
      const normalizedContent = normalizeInteractionIds(content, undefined, existingIds);
      const nextInteractions = _extractInteractionIds(normalizedContent);
      const previousInteractions = Array.isArray(updatedTopic.interactions) ? updatedTopic.interactions : [];
      updatedTopic.interactions = nextInteractions;
      structureChanged = !_areStringArraysEqual(previousInteractions, nextInteractions);

      const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}`;
      const commitSha = await service.updateGitHubFile(gitHubUrl, normalizedContent, token, commitMessage);
      invalidateCourseReadCache(course, commitSha);
      course.markdownCache.set(topic.path, normalizedContent);
    }

    if (structureChanged) {
      updatedCourse = await _updateCourseStructure(token, updatedCourse, `update(course) topic ${topic.title}`);
      setLearningSession({ ...learningSession, course: updatedCourse, topic: updatedTopic });
      return;
    }

    if (learningSession?.topic?.id === topic.id) {
      setLearningSession({ ...learningSession, topic: { ...learningSession.topic, interactions: updatedTopic.interactions } });
    }
  }

  async function renameTopic(moduleIdx, topicIdx, newTitle, newDescription, newType, newPoints) {
    if (!newTitle.trim()) return;
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const updatedCourse = Course.copy(course);
    const topic = updatedCourse.modules[moduleIdx].topics[topicIdx];
    if (!topic) return;
    topic.title = newTitle.trim();
    topic.description = newDescription.trim();
    topic.type = newType || topic.type;
    topic.points = newPoints ?? defaultPointsForTopicType(topic.type);
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

  function getScheduleTopic(course = learningSession?.course) {
    if (!course) return null;
    if (!course.schedule?.id) {
      return null;
    }

    const files = Array.isArray(course.schedule.files) ? course.schedule.files.filter((file) => file && file.path) : [];
    if (!files.length) {
      return null;
    }

    const defaultFile = files.find((file) => file.default) || files[0];

    return {
      id: course.schedule.id,
      title: defaultFile.title || 'Schedule',
      type: 'schedule',
      path: defaultFile.path,
      state: defaultFile.state || 'published',
    };
  }

  function getScheduleFiles(topic = learningSession?.topic) {
    const course = getWorkingCourse();
    if (!course) return [];
    const scheduleTopic = getScheduleTopic(course);
    if (!scheduleTopic) return [];

    let files = Array.isArray(course.schedule?.files) ? course.schedule.files.filter((file) => file && file.path) : [];
    if (!files.length) return [];
    if (!files.some((file) => file.default)) {
      files[0] = { ...files[0], default: true };
      course.schedule.files = files;
    }

    return files
      .filter((file) => file && file.path)
      .map((file, index) => {
        if (!file.id) {
          file.id = generateId();
        }
        return resolveScheduleFile(scheduleTopic, file.path, file.id || `schedule-${index + 1}`, file.title || file.path, Boolean(file.default));
      });
  }

  function getSelectedScheduleFile(topic = learningSession?.topic, scheduleFiles = null) {
    const files = scheduleFiles || getScheduleFiles();
    if (!files.length) return null;

    const settings = getEnrollmentUiSettings(learningSession?.course?.id);
    const selectedId = settings?.selectedScheduleFile;

    return files.find((file) => file.id === selectedId) || files.find((file) => file.default) || files[0];
  }

  function setSelectedScheduleFile(topic, fileId) {
    if (!learningSession?.course || !fileId) return;

    saveEnrollmentUiSettings(learningSession.course.id, { selectedScheduleFile: fileId });
  }

  async function createSchedule(scheduleTitle = 'Schedule') {
    const course = getWorkingCourse();
    if (!course) {
      return null;
    }

    const title = (scheduleTitle || '').trim();
    if (!title) {
      throw new Error('Schedule title is required.');
    }

    const token = user.getSetting('gitHubToken', course.id);
    if (!user.isEditor(course.id) || !token) {
      throw new Error('You do not have permission to create schedules for this course.');
    }
    if (course.schedule?.id) {
      throw new Error('This course already has a schedule.');
    }

    const updatedCourse = Course.copy(course);
    const scheduleId = generateId();
    const defaultFileId = generateId();
    const defaultPath = `${course.links.gitHub.rawUrl}/schedule/schedule.md`;

    updatedCourse.schedule = {
      id: scheduleId,
      files: [
        {
          id: defaultFileId,
          title,
          path: defaultPath,
          default: true,
          state: 'published',
        },
      ],
    };

    const scheduleTopic = getScheduleTopic(updatedCourse);
    const resolved = resolveScheduleFile(scheduleTopic, defaultPath, defaultFileId, title, true);
    const initialMarkdown = createInitialScheduleMarkdown(title);

    await service.commitGitHubFile(resolved.apiUrl, initialMarkdown, token, `add(schedule) ${title}`);
    updatedCourse.markdownCache.set(resolved.rawUrl, initialMarkdown);
    await _updateCourseStructure(token, updatedCourse, `update(course) add schedule ${title}`);

    setSelectedScheduleFile(scheduleTopic, defaultFileId);
    setLearningSession({ ...learningSession, course: updatedCourse, topic: scheduleTopic });
    return resolved;
  }

  async function createScheduleFile(topic, scheduleTitle) {
    const course = getWorkingCourse();
    if (!course) {
      return null;
    }

    const title = (scheduleTitle || '').trim();
    if (!title) {
      throw new Error('Schedule title is required.');
    }

    if (!course.schedule?.id) {
      return createSchedule(title);
    }
    const token = user.getSetting('gitHubToken', course.id);
    if (!user.isEditor(course.id) || !token) {
      throw new Error('You do not have permission to create schedules for this course.');
    }

    const updatedCourse = Course.copy(course);
    const updatedSchedule = updatedCourse.schedule;
    let existingSchedules = Array.isArray(updatedSchedule.files) ? [...updatedSchedule.files] : [];

    const path = sanitizeSchedulePath(title);
    if (existingSchedules.some((entry) => sanitizeSchedulePath(entry.path) === path)) {
      throw new Error(`A schedule file already exists for '${path}'.`);
    }

    const newSchedule = {
      id: generateId(),
      title,
      path,
      default: false,
    };

    updatedSchedule.files = [...existingSchedules, newSchedule];

    const scheduleTopic = getScheduleTopic(updatedCourse);
    const resolved = resolveScheduleFile(scheduleTopic, newSchedule.path, newSchedule.id, newSchedule.title, newSchedule.default);
    const initialMarkdown = createInitialScheduleMarkdown(title);

    await service.commitGitHubFile(resolved.apiUrl, initialMarkdown, token, `add(schedule) ${title}`);
    updatedCourse.markdownCache.set(resolved.rawUrl, initialMarkdown);

    await _updateCourseStructure(token, updatedCourse, `update(course) add schedule ${title}`);
    setLearningSession({ ...learningSession, course: updatedCourse, topic: scheduleTopic });
    setSelectedScheduleFile(scheduleTopic, newSchedule.id);

    return resolved;
  }

  async function renameScheduleFile() {
    throw new Error('Renaming schedule files is not supported. File names are generated from the original schedule title.');
  }

  async function deleteScheduleFile(topic, fileId) {
    const course = getWorkingCourse();
    if (!course) {
      return null;
    }
    const token = user.getSetting('gitHubToken', course.id);
    if (!user.isEditor(course.id) || !token) {
      throw new Error('You do not have permission to delete schedules for this course.');
    }
    if (!course.schedule?.id) {
      throw new Error('No schedule exists for this course.');
    }

    const updatedCourse = Course.copy(course);
    let schedules = Array.isArray(updatedCourse.schedule.files) ? [...updatedCourse.schedule.files] : [];

    if (schedules.length <= 1) {
      throw new Error('At least one schedule file is required.');
    }

    const index = schedules.findIndex((entry) => entry.id === fileId);
    if (index === -1) {
      throw new Error('Unable to find selected schedule file.');
    }

    const removing = schedules[index];
    if (removing.default) {
      throw new Error('The default schedule file cannot be deleted.');
    }

    const scheduleTopic = getScheduleTopic(updatedCourse);
    const resolved = resolveScheduleFile(scheduleTopic, removing.path, removing.id, removing.title, Boolean(removing.default));
    await service.deleteGitHubFile(resolved.apiUrl, token, `remove(schedule) ${removing.title || removing.path}`);

    updatedCourse.markdownCache.delete(resolved.rawUrl);
    schedules.splice(index, 1);

    if (!schedules.some((entry) => entry.default)) {
      schedules[0] = { ...schedules[0], default: true };
    }

    updatedCourse.schedule.files = schedules;

    const nextSelection = schedules.find((entry) => entry.default) || schedules[0];

    await _updateCourseStructure(token, updatedCourse, `update(course) delete schedule ${removing.title || removing.path}`);
    setLearningSession({ ...learningSession, course: updatedCourse, topic: scheduleTopic });
    if (nextSelection?.id) {
      setSelectedScheduleFile(scheduleTopic, nextSelection.id);
    }

    return nextSelection?.id || null;
  }

  async function deleteCourseSchedule() {
    const course = getWorkingCourse();
    if (!course) return;
    const token = user.getSetting('gitHubToken', course.id);
    if (!user.isEditor(course.id) || !token) {
      throw new Error('You do not have permission to delete schedules for this course.');
    }
    if (!course.schedule?.id) {
      throw new Error('No schedule exists for this course.');
    }

    const updatedCourse = Course.copy(course);
    const scheduleTopic = getScheduleTopic(updatedCourse);
    const scheduleFiles = getScheduleFiles(scheduleTopic);

    for (const file of scheduleFiles) {
      await service.deleteGitHubFile(file.apiUrl, token, `remove(schedule) ${file.title || file.path}`);
      updatedCourse.markdownCache.delete(file.rawUrl);
    }

    updatedCourse.schedule = undefined;

    const nextTopic = updatedCourse.defaultTopic();
    await _updateCourseStructure(token, updatedCourse, `update(course) delete schedule`);
    setLearningSession({ ...learningSession, course: updatedCourse, topic: nextTopic });
  }

  async function setDefaultScheduleFile(topic, fileId) {
    const course = getWorkingCourse();
    if (!course || !fileId) {
      return null;
    }
    const token = user.getSetting('gitHubToken', course.id);
    if (!user.isEditor(course.id) || !token) {
      throw new Error('You do not have permission to update default schedules for this course.');
    }
    if (!course.schedule?.id) {
      throw new Error('No schedule exists for this course.');
    }

    const updatedCourse = Course.copy(course);
    const scheduleTopic = getScheduleTopic(updatedCourse);
    let schedules = Array.isArray(updatedCourse.schedule.files) ? [...updatedCourse.schedule.files] : [];

    if (!schedules.some((entry) => entry.id === fileId)) {
      throw new Error('Unable to find selected schedule file.');
    }

    schedules = schedules.map((entry) => ({ ...entry, default: entry.id === fileId }));
    updatedCourse.schedule.files = schedules;

    await _updateCourseStructure(token, updatedCourse, `update(course) default schedule ${fileId}`);
    setLearningSession({ ...learningSession, course: updatedCourse, topic: scheduleTopic });
    setSelectedScheduleFile(scheduleTopic, fileId);

    return fileId;
  }

  function sanitizeSchedulePath(rawPath) {
    let normalized = String(rawPath || '')
      .trim()
      .toLowerCase()
      .replace(/\.md$/i, '')
      .replace(/[^a-z0-9/_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-/]+|[-/]+$/g, '');

    if (!normalized) {
      normalized = `schedule-${Date.now()}`;
    }

    const parts = normalized
      .split('/')
      .map((part) => part.replace(/^-+|-+$/g, ''))
      .filter(Boolean);

    if (!parts.includes('schedule')) {
      parts.unshift('schedule');
    }

    return `${parts.join('/')}.md`;
  }

  function createInitialScheduleMarkdown(title) {
    return `# ${title}\n\n| Week | Date | Module | Due | Topics Covered | Slides |\n| :--: | ---- | ------ | --- | -------------- | ------ |\n|  1   |      |        |     |                |        |\n`;
  }

  function extractScheduleTitleFromMarkdown(markdown = '') {
    const match = String(markdown).match(/^\s*#\s+(.+)$/m);
    return match ? match[1].trim() : '';
  }

  function resolveScheduleFile(topic, configuredPath, id, title, isDefault = false) {
    const course = learningSession?.course;
    const rawRoot = course.links.gitHub.rawUrl;
    const apiRoot = course.links.gitHub.apiUrl;
    const topicRepoPath = String(topic.path || '').replace(`${rawRoot}/`, '');
    const topicDir = topicRepoPath.substring(0, topicRepoPath.lastIndexOf('/'));

    if (configuredPath.startsWith('http://') || configuredPath.startsWith('https://')) {
      const repoPath = configuredPath.replace(`${rawRoot}/`, '');
      const apiUrl = configuredPath.startsWith(rawRoot) ? `${apiRoot}/${repoPath}` : null;
      return { id, title, path: configuredPath, rawUrl: configuredPath, apiUrl, repoPath, default: isDefault };
    }

    let relativePath = '';
    if (configuredPath.startsWith('/')) {
      relativePath = configuredPath.slice(1);
    } else if (configuredPath.startsWith('./') || configuredPath.startsWith('../')) {
      relativePath = `${topicDir}/${configuredPath}`;
    } else if (configuredPath.includes('/')) {
      relativePath = configuredPath;
    } else {
      relativePath = `${topicDir}/${configuredPath}`;
    }

    const normalizedRepoPath = relativePath.replace(/^\.\//, '');

    return {
      id,
      title,
      path: configuredPath,
      rawUrl: `${rawRoot}/${normalizedRepoPath}`,
      apiUrl: `${apiRoot}/${normalizedRepoPath}`,
      repoPath: normalizedRepoPath,
      default: isDefault,
    };
  }

  async function getScheduleTopicContent(topic, fileId, forceRefresh = false) {
    if (!topic) return '';

    const files = getScheduleFiles(topic);
    const selectedFile = files.find((file) => file.id === fileId) || getSelectedScheduleFile(topic, files) || files[0];
    if (!selectedFile) return '';

    const token = user?.getSetting?.('gitHubToken', learningSession?.course?.id);
    const fetchUrl = await resolveSnapshotRawUrl(selectedFile.rawUrl, token, async ({ owner, repository, ref }) => service.resolveGitHubSnapshotRef({ owner, repository, ref }));

    if (!forceRefresh && learningSession?.course?.markdownCache.has(fetchUrl)) {
      return learningSession.course.markdownCache.get(fetchUrl);
    }

    const response = await fetch(fetchUrl, { cache: 'no-store' });
    const markdown = await response.text();
    learningSession?.course?.markdownCache.set(fetchUrl, markdown);
    setSelectedScheduleFile(topic, selectedFile.id);

    return markdown;
  }

  async function updateScheduleTopicContent(topic, fileId, content, commitMessage = `update(${topic.title})`) {
    const course = getWorkingCourse();
    if (!course || !topic) return;

    const files = getScheduleFiles(topic);
    const selectedFile = files.find((file) => file.id === fileId) || getSelectedScheduleFile(topic, files);
    if (!selectedFile) return;

    const token = user.getSetting('gitHubToken', course.id);
    const commitSha = await service.updateGitHubFile(selectedFile.apiUrl, content, token, commitMessage);
    invalidateCourseReadCache(course, commitSha);

    const updatedCourse = Course.copy(course);
    const updatedScheduleTopic = getScheduleTopic(updatedCourse);
    let structureChanged = false;

    const nextTitle = extractScheduleTitleFromMarkdown(content);
    if (nextTitle && Array.isArray(updatedCourse.schedule.files)) {
      const existingEntry = updatedCourse.schedule.files.find((entry) => entry?.id === selectedFile.id);
      const existingTitle = String(existingEntry?.title || '').trim();
      if (existingTitle !== nextTitle) {
        updatedCourse.schedule.files = updatedCourse.schedule.files.map((entry) => (entry?.id === selectedFile.id ? { ...entry, title: nextTitle } : entry));
        structureChanged = true;
      }
    }

    updatedCourse.markdownCache.set(selectedFile.rawUrl, content);
    if (structureChanged) {
      await _updateCourseStructure(token, updatedCourse, `update(course) schedule ${topic.title}`);
      setLearningSession({ ...learningSession, course: updatedCourse, topic: updatedScheduleTopic });
    }
    setSelectedScheduleFile(updatedScheduleTopic, selectedFile.id);
  }

  async function deleteTopicFiles(topic, files) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const token = user.getSetting('gitHubToken', course.id);
    const contentPath = topic.path.match(/\/main\/((?:.+\/)?)[^\/]+\.md$/);
    if (!contentPath) return;

    for (const file of files) {
      const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}${file}`;
      await service.deleteGitHubFile(gitHubUrl, token, `remove(topic) file ${file}`);
    }

    invalidateCourseReadCache(course);
  }

  function readFileAsUint8Array(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(reader.error || new Error('Failed to read file for upload.'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function addTopicFiles(files) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    const token = user.getSetting('gitHubToken', course.id);
    const commitMessage = `enhance(topic) ${learningSession.topic.title} with new file`;
    const contentPath = learningSession.topic.path.match(/\/main\/((?:.+\/)?)[^\/]+\.md$/);
    if (!contentPath) return;

    let latestCommitSha = null;
    for (const file of files) {
      const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}${file.name}`;
      const content = await readFileAsUint8Array(file.props);
      latestCommitSha = await service.commitGitHubFile(gitHubUrl, content, token, commitMessage);
    }

    invalidateCourseReadCache(course, latestCommitSha);
    return await getTopicFiles(latestCommitSha);
  }

  async function getTopicFiles(ref) {
    if (!learningSession?.course) return;
    const course = learningSession.course;
    let fetchUrl = learningSession.topic.path.substring(0, learningSession.topic.path.lastIndexOf('/'));
    fetchUrl = fetchUrl.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
    if (ref) fetchUrl += `?ref=${ref}`;
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

  async function downloadTopicFiles(fileNames) {
    if (!learningSession?.course || !Array.isArray(fileNames) || fileNames.length === 0) {
      return [];
    }

    const course = learningSession.course;
    const token = user.getSetting('gitHubToken', course.id);
    const contentPath = learningSession.topic.path.match(/\/main\/((?:.+\/)?)[^\/]+\.md$/);
    if (!contentPath) {
      return [];
    }

    const downloadedFiles = [];
    for (const fileName of fileNames) {
      if (!fileName) {
        continue;
      }

      const encodedName = encodeURIComponent(fileName);
      const gitHubUrl = `${course.links.gitHub.apiUrl}/${contentPath[1]}${encodedName}`;
      const response = await service.makeGitHubApiRequest(token, gitHubUrl, 'GET', undefined, 'application/vnd.github.raw');

      if (!response.ok) {
        throw new Error(`Failed to download ${fileName}: ${response.status}`);
      }

      downloadedFiles.push({
        name: fileName,
        blob: await response.blob(),
      });
    }

    return downloadedFiles;
  }

  function _getTopicPath() {
    let topicPath = '';
    const match = learningSession.topic.path.match(/\/main\/(.+\/)[^\/]+\.md$/);
    if (match) {
      topicPath = match[1];
    }
    return topicPath;
  }

  async function generateTopicContent(topic, topicDescription, courseContext = learningSession.course) {
    let basicContent = `
# ${topic.title}

![Topic Cover](https://raw.githubusercontent.com/csinstructiontemplate/emptycourse/refs/heads/main/coursecover.jpg)

${topicDescription || 'overview content placeholder'}`;

    switch (topic.type) {
      case 'video':
      case 'embedded':
        return null;
      case 'schedule':
        basicContent = createInitialScheduleMarkdown(topic.title || 'Schedule');
        break;
      case 'dra':
        basicContent = createInitialDraMarkdown(topic.title || 'Disciplinary Reasoning Assessment');
        break;
      case 'exam':
        if (topicDescription && topicDescription.trim().length > 0) {
          basicContent = await aiExamGenerator(courseContext.description, topic.title, topicDescription);
        }
        break;
      case 'project':
        basicContent = `# Project: ${topic.title}\n\n## Objectives\n\n- Objective 1\n- Objective 2\n\n## Instructions\n\n1. Step 1\n2. Step 2\n3. Step 3\n\n## Deliverables\n\n- Deliverable 1\n- Deliverable 2\n`;
        break;
      default:
        if (topicDescription && topicDescription.trim().length > 0) {
          const module = courseContext.moduleFromTopic(topic);
          const otherTopicDescriptions = (module?.topics || [])
            .map((t) => (t.id !== topic.id ? t.title : null))
            .filter(Boolean)
            .join('; ');
          basicContent = await aiTopicGenerator(courseContext.description, topic.title, topicDescription, module?.title || '', otherTopicDescriptions);
        }
        break;
    }

    return basicContent;
  }

  async function getChoiceInteractionFeedback(data) {
    return aiChoiceInteractionFeedbackGenerator(data, user);
  }

  async function getEssayInteractionFeedback(data) {
    return aiEssayInteractionFeedbackGenerator(data, user);
  }

  async function getPromptResponse(data) {
    data = 'Limit the response to 100 words or less\n\n' + data;
    return makeSimpleAiRequest(data, user);
  }

  async function getAiWebPageFeedback(data) {
    return aiWebPageFeedbackGenerator(data, user);
  }

  async function getCriteriaTargetFeedback(data, gradingCriteria, urlPrompt) {
    return aiUrlFeedbackGenerator(data, gradingCriteria, urlPrompt, user);
  }

  async function getGithubInteractionFeedback(data, gradingCriteria) {
    return service.makeGithubGradeRequest({
      url: data.url,
      title: data.title,
      body: data.body,
      gradingCriteria,
    });
  }

  async function getFileInteractionFeedback(data, gradingCriteria) {
    return aiFileInteractionFeedbackGenerator({ ...data, gradingCriteria }, user);
  }

  async function getAiWebPageResponse({ prompt }) {
    const data = `Create a complete, standalone HTML web page for a learner submission.

Learner prompt:
${prompt}

Requirements:
- Return only HTML. Do not include markdown code fences or explanatory commentary.
- Include all CSS and JavaScript inline in the document.
- The page must be valid HTML and fit responsively inside an iframe viewport.
- Use accessible semantic markup and readable text.
- Do not use external network resources, remote scripts, remote stylesheets, or tracking.
- If images are needed, use inline SVG, CSS, or simple placeholders.
`;

    return makeSimpleAiRequest(data, user);
  }

  async function validateUrlFromServer({ url, timeoutMs = 8000 }) {
    return service.makeUrlValidationRequest({ url, timeoutMs });
  }

  async function getExamState() {
    if (learningSession?.enrollment && learningSession?.topic) {
      const progress = await service.getProgress({ types: ['exam'], topicId: learningSession.topic.id, enrollmentId: learningSession.enrollment.id });
      if (progress && progress.data.length > 0) {
        return progress.data[0];
      }
    }
    return { details: { state: 'notStarted' } };
  }

  async function getDraState() {
    if (learningSession?.enrollment && learningSession?.topic) {
      const progress = await service.getProgress({ types: ['dra'], topicId: learningSession.topic.id, enrollmentId: learningSession.enrollment.id });
      if (progress?.data?.length > 0) {
        const state = await service.loadDraState(learningSession.enrollment.id, learningSession.topic.id);
        if (state) return state;
      }
    }
    return { practiceScenarios: [], selectedPracticeScenarioId: null, finalScenario: null };
  }

  async function saveDraState(state) {
    if (observeSession?.active && learningSession?.observeMode) return;
    if (learningSession?.enrollment && learningSession?.topic) {
      await service.saveDraState(learningSession.enrollment.id, learningSession.topic.id, state);
    }
  }

  async function generateDraScenario(params) {
    return aiDraScenarioGenerator(params || {});
  }

  async function getDraStakeholderResponse(scenario, target, messages, stakeholders, resources, difficulty) {
    return aiDraStakeholderResponseGenerator(scenario, target, messages, stakeholders, resources, difficulty);
  }

  async function getDraEvaluation(scenario, transcripts, reasoningRecord, difficulty) {
    return aiDraEvaluationGenerator(scenario, transcripts, reasoningRecord, difficulty);
  }

  async function getDraCoaching(scenario, transcripts, reasoningRecord, activeStage, difficulty) {
    return aiDraCoachGenerator(scenario, transcripts, reasoningRecord, activeStage, difficulty);
  }

  async function uploadSubmissionFile({ interactionId, file }) {
    const enrollmentId = learningSession?.enrollment?.id;
    if (!enrollmentId) throw new Error('Not enrolled in this course.');
    return service.uploadSubmissionFile(enrollmentId, interactionId, file);
  }

  async function clearSubmissionFolder({ interactionId }) {
    const enrollmentId = learningSession?.enrollment?.id;
    if (!enrollmentId) return;
    const paths = await service.listSubmissionFolder(enrollmentId, interactionId);
    if (paths.length > 0) {
      await service.removeSubmissionFiles(paths);
    }
  }

  async function getSubmissionFileUrl(storagePath) {
    return service.getSubmissionFileUrl(storagePath);
  }

  async function addProgress(providedUser, interactionId, type, duration = 0, details = {}) {
    if (observeSession?.active && learningSession?.observeMode) {
      return null;
    }
    const progressUser = providedUser || user;
    if (progressUser) {
      _updateEnrollmentCachedInfo(learningSession?.enrollment, learningSession?.topic, interactionId, type, details, duration);
      const saved = await service.addProgress(progressUser.id, learningSession?.course?.id, learningSession?.enrollment?.id, learningSession?.topic?.id, interactionId, type, duration, details);

      const topic = learningSession?.topic;
      const course = learningSession?.course;
      if (topic && course?.externalRefs?.canvasCourseId && topic.type === 'exam') {
        const shouldSyncExam = type === 'exam' && details?.state === 'completed';

        if (shouldSyncExam) {
          const percentCorrect = Number(details?.results?.ai?.percentCorrect);
          const pointsPossible = Number(topic?.points ?? 200);

          if (Number.isFinite(percentCorrect) && Number.isFinite(pointsPossible) && pointsPossible > 0) {
            try {
              await service.makeCanvasGradebookRequest({
                courseId: String(course.externalRefs.canvasCourseId),
                catalogId: course.id,
                topicType: 'exam',
                percentCorrect,
                pointsPossible,
                canvasAssignmentId: topic.externalRefs?.canvasAssignmentId,
                canvasQuizId: topic.externalRefs?.canvasQuizId,
                learnerEmail: progressUser.email,
              });
            } catch (error) {
              console.error(`Unable to sync Canvas grade for topic '${topic.title}': ${error.message}`);
            }
          }
        }
      }

      return saved;
    }
  }

  async function syncProjectInteractionGrade(providedUser, interactionId, details = {}) {
    if (observeSession?.active && learningSession?.observeMode) {
      throw new Error('Gradebook sync is disabled while observing a learner.');
    }
    const progressUser = providedUser || user;
    const topic = learningSession?.topic;
    const course = learningSession?.course;

    if (!progressUser) {
      throw new Error('Unable to sync grade without an authenticated learner.');
    }

    if (!topic || !course || topic.type !== 'project') {
      throw new Error('Gradebook submission is only supported for project topics.');
    }

    if (!course?.externalRefs?.canvasCourseId) {
      throw new Error('This project is not linked to a Gradebook course.');
    }

    if (!details?.syncGrade) {
      throw new Error('This interaction is not configured for Gradebook submission.');
    }

    const percentCorrect = Number(details?.percentCorrect);
    if (!Number.isFinite(percentCorrect)) {
      throw new Error('A numeric grade is required before syncing to Canvas.');
    }

    const pointsPossible = Number(topic?.points ?? 100);
    if (!Number.isFinite(pointsPossible) || pointsPossible <= 0) {
      throw new Error('Unable to determine valid points possible for this project.');
    }

    const learnerEmail = String(progressUser?.email || '').trim();
    if (!learnerEmail) {
      throw new Error('Unable to submit grade because learner email is missing.');
    }

    const interactionFeedback = String(details?.feedback || '').trim();
    const submissionUrl = typeof details?.url === 'string' ? details.url.trim() : '';
    const autoGrade = details?.autoGrade === true;

    return service.makeCanvasGradebookRequest({
      courseId: String(course.externalRefs.canvasCourseId),
      catalogId: course.id,
      topicType: 'project',
      percentCorrect,
      pointsPossible,
      canvasAssignmentId: topic.externalRefs?.canvasAssignmentId,
      canvasQuizId: topic.externalRefs?.canvasQuizId,
      learnerEmail,
      autoGrade,
      feedback: interactionFeedback,
      submissionUrl: submissionUrl || undefined,
    });
  }

  async function isLearnerInCanvasCourse(providedUser = null, providedCourse = null) {
    const progressUser = providedUser || user;
    const course = providedCourse || learningSession?.course;
    const canvasCourseId = String(course?.externalRefs?.canvasCourseId || '').trim();
    const learnerEmail = String(progressUser?.email || '').trim();

    return canvasMembershipChecker.current.isLearnerInCanvasCourse(canvasCourseId, learnerEmail, course?.id);
  }

  /*
   * enrollment.progress structure:
   * {
   *   mastery: 99,
   *   lastActivityAt: '2026-06-01T10:00:00Z',
   *   [topicId]: {
   *     interactions: ['interactionId1', 'interactionId2'],
   *     scores: { 'interactionId1': 85, 'interactionId2': 92 },
   *     lastInteractionAt: '2026-06-01T10:00:00Z',
   *     notes: true,
   *     examCompleted: true,
   *     projectSubmission: true,
   *   }
   * }
   *
   * Note progress details:
   * {
   *   "type": "note",
   *   "content": "Here is my note",
   *   "section": "heading text"
   *   }
   * }
   */
  function _updateEnrollmentCachedInfo(enrollment, topic, interactionId, type, details = {}, duration = 0) {
    if (!enrollment || !topic) return;

    var update = false;
    if (type === 'instructionView' || type === 'embeddedView' || type === 'quizSubmit') {
      update = _getEnrollmentProgress(enrollment, topic.id);

      if (duration > 0) {
        enrollment.progress[topic.id].timeSpent = (enrollment.progress[topic.id].timeSpent || 0) + duration;
        update = true;
      }

      if (type === 'quizSubmit' && interactionId && (!enrollment.progress[topic.id].interactions || !enrollment.progress[topic.id].interactions.includes(interactionId))) {
        enrollment.progress[topic.id].interactions = [...(enrollment.progress[topic.id].interactions || []), interactionId];
        update = true;
      }
      if (type === 'quizSubmit' && interactionId) {
        const score = Number.isFinite(Number(details?.percentCorrect)) ? Number(details.percentCorrect) : null;
        enrollment.progress[topic.id].scores = { ...(enrollment.progress[topic.id].scores || {}), [interactionId]: score };
        update = true;
      }
      enrollment.progress[topic.id].lastInteractionAt = new Date().toISOString();
      update = true;
      if (type === 'quizSubmit' && details?.syncGrade === true && !enrollment.progress[topic.id].projectSubmission) {
        enrollment.progress[topic.id].projectSubmission = true;
        update = true;
      }
      if (update) {
        enrollment.progress.mastery = _calculateEnrollmentProgress(enrollment, learningSession.course);
      }
    } else if (type === 'note') {
      update = _getEnrollmentProgress(enrollment, topic.id);
      if (!enrollment.progress[topic.id].notes) {
        enrollment.progress[topic.id].notes = true;
        update = true;
      }
    } else if (type === 'exam' && details?.state === 'completed') {
      update = _getEnrollmentProgress(enrollment, topic.id);
      if (!enrollment.progress[topic.id].examCompleted) {
        enrollment.progress[topic.id].examCompleted = true;
        update = true;
      }
    } else if (type === 'dra' && details?.state === 'completed') {
      update = _getEnrollmentProgress(enrollment, topic.id);
      if (!enrollment.progress[topic.id].draCompleted) {
        enrollment.progress[topic.id].draCompleted = true;
        update = true;
      }
    }

    // Accumulate total time spent across all topics
    if (duration > 0) {
      enrollment.progress.totalTimeSpent = (enrollment.progress.totalTimeSpent || 0) + duration;
      update = true;
    }

    // Always record last activity regardless of type
    enrollment.progress.lastActivityAt = new Date().toISOString();
    update = true;

    if (update) {
      service.saveEnrollment(enrollment);
      setLearningSession({ ...learningSession, enrollment: enrollment });
    }
  }

  function _getEnrollmentProgress(enrollment, topicId) {
    if (!enrollment.progress) {
      enrollment.progress = {};
    }
    if (!enrollment.progress[topicId]) {
      enrollment.progress[topicId] = { interactions: [] };
      return true;
    }
    return false;
  }

  function _calculateEnrollmentProgress(enrollment, course) {
    let publishedTopics = course.allTopics.filter((topic) => topic.state === 'published');
    if (publishedTopics.length === 0) return 0;
    let completedTopics = 0;

    publishedTopics.forEach((topic) => {
      let topicPercent = enrollment.progress[topic.id] ? 1 : 0;
      if (topic.interactions && topic.interactions.length > 0) {
        const completedForTopic = enrollment.progress[topic.id]?.interactions || [];
        const interactionPercent = completedForTopic.length / topic.interactions.length;
        topicPercent = interactionPercent;
      }
      completedTopics += topicPercent;
    });

    return Math.round((completedTopics / publishedTopics.length) * 100);
  }

  async function getProgress({ courseId, enrollmentId, userId, topicId = null, interactionId = null, types = null, startDate = null, endDate = null, page = 1, limit = 100 }) {
    return service.getProgress({ courseId, enrollmentId, userId, topicId, interactionId, types, startDate, endDate, page, limit });
  }

  async function getMasteryOverview({ courseId, page = 1, limit = 50, search = '', learnerId = '' }) {
    return service.makeMasteryOverviewRequest({ courseId, page, limit, search, ...(learnerId ? { learnerId } : {}) });
  }

  async function getTopicProgress(types = ['quizSubmit']) {
    if (!learningSession?.enrollment || !learningSession?.topic) return {};

    const progressItems = await getProgress({ topicId: learningSession.topic.id, enrollmentId: learningSession.enrollment.id, types, limit: 1000 });
    return progressItems.data.reduce((acc, item) => {
      const interactionId = item.interactionId;
      if (!acc[interactionId] || new Date(item.createdAt) > new Date(acc[interactionId].creationDate)) {
        acc[interactionId] = item;
      }
      return acc;
    }, {});
  }

  async function getSurveySummary(interactionId) {
    const progressItems = await getProgress({ interactionId, types: ['quizSubmit'], limit: 1000 });
    // Only use the user's latest submission
    const voters = progressItems.data.reduce((acc, item) => {
      const userId = item.userId;
      if (!acc[userId] || new Date(item.createdAt) > new Date(acc[userId].creationDate)) {
        acc[userId] = item;
      }
      return acc;
    }, {});

    const votes = {};
    Object.values(voters).forEach((userProgress) => {
      const answers = userProgress.details.selected;
      answers.forEach((answer) => {
        votes[answer] = votes[answer] ? (votes[answer] += 1) : 1;
      });
    });

    return { voters: Object.keys(voters).length, votes };
  }

  async function getLikertSummary(interactionId, { questions = [], scaleValues = [] } = {}) {
    const progressItems = await getProgress({ interactionId, types: ['quizSubmit'], limit: 1000 });

    // Only use each learner's latest submission.
    const voters = progressItems.data.reduce((acc, item) => {
      const userId = item.userId;
      if (!acc[userId] || new Date(item.createdAt) > new Date(acc[userId].creationDate)) {
        acc[userId] = item;
      }
      return acc;
    }, {});

    const latestResponsesByUser = Object.values(voters).map((item) => ({
      responses: item?.details?.responses || {},
    }));

    return summarizeLikertResponses({
      questions,
      scaleValues,
      latestResponsesByUser,
    });
  }

  async function renderCanvasTopicHtml(course, topic) {
    if (topic.type === 'video' || topic.type === 'embedded') {
      return `<iframe style="width: 1280px; height: 720px; max-width: 100%;" src="${topic.path}" title="${topic.title} YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />`;
    }

    let md = await getTopic(topic);
    // Canvas inserts its own title header, so remove any top-level headers from the markdown.
    md = md.replace(/^\w*#\s.+\n/gm, '');
    return ReactDOMServer.renderToStaticMarkup(<MarkdownStatic course={course} topic={topic} content={md} languagePlugins={[]} />);
  }

  const canvasSync = createCanvasSync({ service, renderTopicHtml: renderCanvasTopicHtml });

  async function verifyCanvasAccess(course) {
    const token = user.getSetting('gitHubToken', course.id);
    if (!(await service.verifyGitHubAccount(token))) {
      throw new Error('You do not have permission to associate this course with canvas.');
    }
  }

  function repoRelativePathFromRawUrl(rawUrl, rawRoot) {
    if (!rawUrl || !rawRoot || !rawUrl.startsWith(rawRoot)) {
      return '';
    }

    return rawUrl.slice(rawRoot.length + 1);
  }

  function resolveRelativeRepoPath(fromFileRepoPath, rawPath) {
    if (!fromFileRepoPath || !rawPath) {
      return '';
    }

    if (/^https?:\/\//i.test(rawPath)) {
      return '';
    }

    const baseDir = fromFileRepoPath.slice(0, Math.max(0, fromFileRepoPath.lastIndexOf('/')));
    const joined = rawPath.startsWith('/') ? rawPath.slice(1) : `${baseDir}/${rawPath}`;

    const normalized = [];
    joined.split('/').forEach((segment) => {
      if (!segment || segment === '.') {
        return;
      }

      if (segment === '..') {
        normalized.pop();
        return;
      }

      normalized.push(segment);
    });

    return normalized.join('/');
  }

  function parseScheduleDateToIso(dateText) {
    const raw = String(dateText || '').trim();
    if (!raw) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const parsed = new Date(`${raw}T23:59:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }

    const partsMatch = raw.match(/^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
    if (partsMatch) {
      const year = partsMatch[3] ? Number(partsMatch[3]) : new Date().getFullYear();
      const parsed = new Date(`${partsMatch[1]} ${Number(partsMatch[2])}, ${year} 23:59:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 0, 0);
      return parsed.toISOString();
    }

    return null;
  }

  async function getScheduleDueDatesByTopicId(course, selectedScheduleFileId = null) {
    const scheduleFiles = Array.isArray(course?.schedule?.files) ? course.schedule.files.filter((file) => file && file.path) : [];
    if (!scheduleFiles.length) {
      return {};
    }

    const selected = scheduleFiles.find((file) => file.id === selectedScheduleFileId) || scheduleFiles.find((file) => file.default) || scheduleFiles[0];
    if (!selected?.path) {
      return {};
    }

    const fetchUrl = selected.commit ? selected.path.replace(/(\/main\/)/, `/${selected.commit}/`) : selected.path;
    const markdown = await fetch(fetchUrl, { cache: 'no-store' }).then((res) => res.text());
    const model = parseScheduleMarkdown(markdown || '');
    const rawRoot = course.links?.gitHub?.rawUrl;
    const selectedRepoPath = repoRelativePathFromRawUrl(selected.path, rawRoot);

    const topicByRepoPath = new Map();
    const topicByTitle = new Map();
    course.allTopics.forEach((topic) => {
      const repoPath = repoRelativePathFromRawUrl(topic.path, rawRoot);
      if (repoPath) {
        topicByRepoPath.set(repoPath, topic.id);
      }
      if (topic.title) {
        topicByTitle.set(topic.title.trim().toLowerCase(), topic.id);
      }
    });

    const dueDatesByTopicId = {};
    const weeks = Array.isArray(model?.weeks) ? model.weeks : [];
    weeks.forEach((row) => {
      const dueAt = parseScheduleDateToIso(row?.date || '');
      if (!dueAt) {
        return;
      }

      const dueItems = Array.isArray(row?.dueItems) ? row.dueItems : [];
      dueItems.forEach((item) => {
        const href = String(item?.href || '').trim();
        const text = String(item?.text || '').trim();

        let topicId = null;
        if (href) {
          const repoPath = resolveRelativeRepoPath(selectedRepoPath, href);
          topicId = topicByRepoPath.get(repoPath) || null;
        }
        if (!topicId && text) {
          topicId = topicByTitle.get(text.toLowerCase()) || null;
        }
        if (!topicId) {
          return;
        }

        const topic = course.topicFromId(topicId);
        if (topic?.type === 'exam' || topic?.type === 'project') {
          dueDatesByTopicId[topicId] = dueAt;
        }
      });
    });

    return dueDatesByTopicId;
  }

  async function repairCanvas(course, canvasCourseId, setUpdateMessage) {
    await verifyCanvasAccess(course);
    const updatedCourse = Course.copy(course);
    await canvasSync.repairCanvasReferences({ updatedCourse, canvasCourseId, setUpdateMessage });

    setUpdateMessage(`Updating course information`);
    await updateCourseStructure(updatedCourse, null, `linked to canvas courseId ${canvasCourseId}`);
  }

  async function unlinkFromCanvas(course, deleteExisting = false, setUpdateMessage = () => {}) {
    await verifyCanvasAccess(course);

    const updatedCourse = Course.copy(course);

    if (deleteExisting && updatedCourse.externalRefs?.canvasCourseId) {
      setUpdateMessage(`Cleaning up existing Canvas course content`);
      await canvasSync.cleanCanvasCourse({ canvasCourseId: updatedCourse.externalRefs.canvasCourseId, catalogId: updatedCourse.id, setUpdateMessage });
    }

    setUpdateMessage(`Removing Canvas references`);
    canvasSync.removeCanvasReferences(updatedCourse);

    setUpdateMessage(`Updating course information`);
    await updateCourseStructure(updatedCourse, null, `unlinked from canvas`);
  }

  async function linkToCanvas(course, canvasCourseId, deleteExisting, setUpdateMessage, selectedScheduleFileId = null, selectedTopicIds = []) {
    await verifyCanvasAccess(course);

    const updatedCourse = Course.copy(course);
    const scheduleFiles = Array.isArray(updatedCourse?.schedule?.files) ? updatedCourse.schedule.files.filter((file) => file && file.path) : [];
    const selectedSchedule = scheduleFiles.find((file) => file.id === selectedScheduleFileId) || scheduleFiles.find((file) => file.default) || scheduleFiles[0] || null;
    updatedCourse.externalRefs = {
      ...updatedCourse.externalRefs,
      canvasCourseId,
      ...(selectedSchedule?.id ? { canvasScheduleFileId: selectedSchedule.id } : {}),
    };
    if (!selectedSchedule?.id && updatedCourse.externalRefs?.canvasScheduleFileId) {
      const { canvasScheduleFileId, ...remainingRefs } = updatedCourse.externalRefs;
      updatedCourse.externalRefs = remainingRefs;
    }

    if (deleteExisting) {
      setUpdateMessage(`Cleaning up existing Canvas course content`);
      await canvasSync.cleanCanvasCourse({ canvasCourseId, catalogId: updatedCourse.id, setUpdateMessage });
    }

    const dueDatesByTopicId = await getScheduleDueDatesByTopicId(updatedCourse, selectedSchedule?.id || null);
    await canvasSync.linkCourseResources({
      updatedCourse,
      canvasCourseId,
      setUpdateMessage,
      dueDatesByTopicId,
      selectedTopicIds,
      onTopicUpdateError: (topic, error) => {
        console.error(`Failed to link topic '${topic.title}' to Canvas: ${error.message}`);
        setUpdateMessage(`Failed to link topic '${topic.title}' to Canvas: ${error.message}`);
      },
    });

    setUpdateMessage(`Updating course information`);
    await updateCourseStructure(updatedCourse, null, `linked to canvas courseId ${canvasCourseId}`);
  }

  async function updateCanvasPage(course, topic, canvasCourseId) {
    return canvasSync.updateCanvasTopic({ course, topic, canvasCourseId });
  }

  function _generateTopicPath(course, topicTitle, topicDescription, topicType) {
    if (topicType === 'embedded') {
      return topicDescription || `https://www.youtube.com/embed/HXNx_Gp0jyM`;
    }

    const slugTitle = topicTitle
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim('-');
    const topicFolder = topicType === 'schedule' ? 'schedule' : 'instruction';
    return `${course.links.gitHub.rawUrl}/${topicFolder}/${slugTitle}/${slugTitle}.md`;
  }

  function _resolveUniqueTopicPath(course, topicPath, existingPaths) {
    const rawRoot = course?.links?.gitHub?.rawUrl;
    if (!rawRoot || !topicPath || !existingPaths) {
      return topicPath;
    }

    const isExternalHttpPath = /^https?:\/\//i.test(topicPath) && !topicPath.startsWith(`${rawRoot}/`);
    if (isExternalHttpPath) {
      return topicPath;
    }

    const match = topicPath.match(new RegExp(`^${rawRoot.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')}/([^/]+)/([^/]+)/\\2\\.md$`));
    if (!match) {
      return topicPath;
    }

    const folder = match[1];
    const baseSlug = match[2];
    let suffix = 1;
    let candidatePath = topicPath;

    while (existingPaths.has(candidatePath)) {
      suffix += 1;
      const nextSlug = `${baseSlug}-${suffix}`;
      candidatePath = `${rawRoot}/${folder}/${nextSlug}/${nextSlug}.md`;
    }

    return candidatePath;
  }

  function _extractInteractionIds(content) {
    return extractInteractionMetas(content)
      .filter((meta) => meta.id && isSubmittableInteractionType(meta.type))
      .map((meta) => meta.id);
  }

  function invalidateCourseReadCache(course = learningSession?.course, nextSnapshotSha = null) {
    const rawRoot = course?.links?.gitHub?.rawUrl;
    if (!rawRoot) {
      return;
    }

    if (nextSnapshotSha) {
      setRawGitHubSnapshot(rawRoot, nextSnapshotSha);
    } else {
      invalidateRawGitHubSnapshot(rawRoot);
    }

    if (course?.markdownCache?.clear) {
      course.markdownCache.clear();
    }
  }

  function _areStringArraysEqual(left, right) {
    if (left === right) {
      return true;
    }

    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }

    if (left.length !== right.length) {
      return false;
    }

    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) {
        return false;
      }
    }

    return true;
  }

  return {
    login,
    logout,
    updateUserProfile,
    user,
    getEnrollmentUiSettings,
    saveEnrollmentUiSettings,
    toggleSidebar,
    setDiscussionToggleHandler,
    toggleDiscussion,
    courseCatalog,
    getCourse,
    searchCourse,
    reindexCourse,
    setCurrentCourse,
    getTemplateRepositories,
    createCourse,
    updateCourseStructure,
    addModule,
    renameModule,
    removeModule,
    unpinAllContent,
    addTopic,
    generateTopic,
    generateTopics,
    getTopic,
    removeTopic,
    renameTopic,
    updateTopic,
    getAdjacentTopic,
    getScheduleTopic,
    getScheduleFiles,
    getSelectedScheduleFile,
    setSelectedScheduleFile,
    createSchedule,
    createScheduleFile,
    renameScheduleFile,
    deleteScheduleFile,
    deleteCourseSchedule,
    setDefaultScheduleFile,
    getScheduleTopicContent,
    updateScheduleTopicContent,
    addTopicFiles,
    deleteTopicFiles,
    getTopicFiles,
    downloadTopicFiles,
    getEssayInteractionFeedback,
    getChoiceInteractionFeedback,
    getPromptResponse,
    getAiWebPageFeedback,
    getCriteriaTargetFeedback,
    getGithubInteractionFeedback,
    getFileInteractionFeedback,
    getAiWebPageResponse,
    validateUrlFromServer,
    addProgress,
    uploadSubmissionFile,
    clearSubmissionFolder,
    getSubmissionFileUrl,
    syncProjectInteractionGrade,
    isLearnerInCanvasCourse,
    getProgress,
    getMasteryOverview,
    getTopicProgress,
    getSurveySummary,
    getLikertSummary,
    getExamState,
    getDraState,
    saveDraState,
    generateDraScenario,
    getDraStakeholderResponse,
    getDraEvaluation,
    getDraCoaching,
    repairCanvas,
    unlinkFromCanvas,
    linkToCanvas,
    updateCanvasPage,
    service,
  };
}

export default useCourseOperations;
