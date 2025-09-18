export default class Course {
  static async create(catalogEntry) {
    const courseData = await load(catalogEntry);
    return new Course(courseData);
  }

  constructor(courseEntry = { modules: [] }) {
    Object.assign(this, courseEntry);

    this.markdownCache = new Map();
    this.allTopics = this.modules.flatMap((m) => m.topics);
  }

  updateCatalogEntry(catalogEntry) {
    const newCourse = Course._copy(this);
    Object.assign(newCourse, catalogEntry);
    return newCourse;
  }

  moduleIndexOf(path) {
    return this.modules.findIndex((module) => module.topics.some((topic) => topic.path === path));
  }

  adjacentTopic(path, direction = 'prev') {
    const topicIndex = this.allTopics.findIndex((t) => t.path === path);

    if (direction === 'prev' && topicIndex > 0) {
      return this.allTopics[topicIndex - 1];
    } else if (direction === 'next' && topicIndex < this.allTopics.length - 1) {
      return this.allTopics[topicIndex + 1];
    }
    return null;
  }

  topicFromPath(path, defaultToFirst = true) {
    const topic = this.allTopics.find((t) => t.path === path);
    if (topic) {
      return topic;
    } else if (!topic && defaultToFirst) {
      return this.allTopics[0];
    }
    return { title: 'unknown topic', path: path };
  }

  map(op) {
    return this.modules.map(op);
  }

  stagedCount() {
    return this.allTopics.filter((topic) => topic.lastUpdated !== undefined).length;
  }

  async topicMarkdown(topic) {
    if (this.markdownCache.has(topic.path)) {
      return this.markdownCache.get(topic.path);
    }

    return this._downloadTopicMarkdown(topic.path);
  }

  async saveTopicMarkdown(updatedTopic, content) {
    const updatedCourse = Course._copy(this);
    const savedTopic = updatedCourse.topicFromPath(updatedTopic.path);
    savedTopic.lastUpdated = Date.now();
    updatedCourse.markdownCache.set(updatedTopic.path, content);
    return [updatedCourse, savedTopic];
  }

  async commitTopicMarkdown(user, service, updatedTopic, commitMessage = `update(${updatedTopic.title})`) {
    const updatedCourse = Course._copy(this);
    const savedTopic = updatedCourse.topicFromPath(updatedTopic.path);
    delete savedTopic.lastUpdated;

    const markdown = await updatedCourse.topicMarkdown(savedTopic);

    const contentPath = savedTopic.path.match(/\/main\/(.+)$/);
    const gitHubUrl = `${this.links.gitHub.apiUrl}/${contentPath[1]}`;

    const token = user.gitHubToken(this.id);
    await service.commitTopicMarkdown(gitHubUrl, markdown, token, commitMessage);

    return [updatedCourse, savedTopic];
  }

  async commitCourseStructure(user, service, commitMessage = 'update course structure') {
    if (!user.isEditor(this.id)) {
      throw new Error('User does not have permission to modify course structure');
    }

    const token = user.gitHubToken(this.id);
    if (!token) {
      throw new Error('GitHub token not available');
    }

    // Create course.json content
    const courseData = {
      title: this.title,
      schedule: this.schedule ? this.schedule.replace(`${this.links.gitHub.rawUrl}/`, '') : undefined,
      syllabus: this.syllabus ? this.syllabus.replace(`${this.links.gitHub.rawUrl}/`, '') : undefined,
      links: this.links ? Object.fromEntries(Object.entries(this.links).filter(([key]) => key !== 'gitHub')) : undefined,
      modules: this.modules.map((module) => ({
        title: module.title,
        topics: module.topics.map((topic) => ({
          title: topic.title,
          type: topic.type,
          path: topic.path.replace(`${this.links.gitHub.rawUrl}/`, ''),
          id: topic.id,
        })),
      })),
    };

    // Remove undefined values
    Object.keys(courseData).forEach((key) => courseData[key] === undefined && delete courseData[key]);

    const courseJson = JSON.stringify(courseData, null, 2);
    const gitHubUrl = `${this.links.gitHub.apiUrl}/course.json`;

    await service.commitTopicMarkdown(gitHubUrl, courseJson, token, commitMessage);
  }

  async discardTopicMarkdown(updatedTopic) {
    const updatedCourse = Course._copy(this);
    const topic = updatedCourse.topicFromPath(updatedTopic.path);
    delete topic.lastUpdated;

    const markdown = await updatedCourse._downloadTopicMarkdown(topic.path);
    updatedCourse.markdownCache.set(topic.path, markdown);
    return [updatedCourse, topic, markdown];
  }

  async _downloadTopicMarkdown(topicUrl) {
    const response = await fetch(topicUrl);
    const markdown = await response.text();
    this.markdownCache.set(topicUrl, markdown);

    return markdown;
  }

  static _copy(course) {
    const newModules = course.modules.map((module) => ({
      ...module,
      topics: module.topics.map((topic) => ({ ...topic })),
    }));
    const newCourse = new Course({ ...course, modules: newModules });

    newCourse.markdownCache = new Map(course.markdownCache);
    newCourse.allTopics = newCourse.modules.flatMap((m) => m.topics);

    return newCourse;
  }
}

async function load(catalogEntry) {
  const gitHub = {
    url: `https://github.com/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/blob/main`,
    apiUrl: `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/contents`,
    rawUrl: `https://raw.githubusercontent.com/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/main`,
  };

  const courseUrl = `${gitHub.rawUrl}/course.json`;
  const response = await fetch(courseUrl);
  if (!response.ok) {
    return loadCourseFromModulesMarkdown(catalogEntry, gitHub);
  }
  const courseData = await response.json();
  courseData.name = catalogEntry.name || '';
  courseData.title = catalogEntry.title || '';
  courseData.description = catalogEntry.description || '';
  courseData.id = catalogEntry.id;
  courseData.links = catalogEntry.links || {};
  courseData.links.gitHub = gitHub;
  courseData.schedule = courseData.schedule ? `${gitHub.rawUrl}/${courseData.schedule}` : undefined;
  courseData.syllabus = courseData.syllabus ? `${gitHub.rawUrl}/${courseData.syllabus}` : undefined;
  courseData.gitHub = catalogEntry.gitHub;

  for (const module of courseData.modules) {
    for (const topic of module.topics) {
      if (topic.type && topic.type === 'video') {
        topic.path = `${topic.path}`;
      } else if (!topic.path.startsWith('http')) {
        topic.path = `${gitHub.rawUrl}/${topic.path}`;
      }
      topic.id = topic.id || generateId();
    }
  }

  return courseData;
}

// This is a fallback for when course.json is not found
async function loadCourseFromModulesMarkdown(catalogEntry, gitHub) {
  const instructionPath = catalogEntry.gitHub.instructionPath ?? 'instruction';
  const instructionModules = catalogEntry.gitHub.instructionModules ?? 'modules.md';
  const instructionUrl = `${gitHub.rawUrl}/${instructionPath}/`;
  const response = await fetch(`${instructionUrl}${instructionModules}`);
  const markdownContent = await response.text();

  const modules = parseModulesMarkdown(gitHub, instructionUrl, markdownContent);

  return { ...catalogEntry, modules, links: { gitHub } };
}

function generateId() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)).replace(/-/g, '');
}

function parseModulesMarkdown(gitHub, instructionUrl, markdownContent) {
  const lines = markdownContent.split('\n');

  const modules = [
    {
      title: 'Course info',
      topics: [
        { title: 'Home', path: `${gitHub.rawUrl}/README.md` },
        { title: 'Syllabus', path: `${gitHub.rawUrl}/syllabus/syllabus.md` },
        { title: 'Schedule', path: `${gitHub.rawUrl}/schedule/schedule.md` },
      ],
    },
  ];
  let currentModule = null;

  const moduleRegex = /^##\s+(.*)$/;
  const topicRegex = /^-\s(.*\s)?\[(.+?)\]\((.+?)\)$/;

  for (const line of lines) {
    const moduleMatch = line.match(moduleRegex);
    if (moduleMatch) {
      if (currentModule) {
        modules.push(currentModule);
      }
      currentModule = {
        title: moduleMatch[1].trim(),
        topics: [],
      };
      continue;
    }

    const topicMatch = line.match(topicRegex);
    if (topicMatch && currentModule) {
      let prefix = topicMatch[1] ? topicMatch[1] : '';
      let title = topicMatch[2] ? topicMatch[2].trim() : '';
      let relPath = topicMatch[3] ? topicMatch[3].trim() : '';
      const isAbsoluteUrl = /^(?:[a-z]+:)?\/\//i.test(relPath);
      const path = isAbsoluteUrl ? relPath : new URL(relPath, instructionUrl).toString();
      currentModule.topics.push({
        title: `${prefix}${title}`,
        path: path,
      });
    }
  }

  if (currentModule) {
    modules.push(currentModule);
  }
  for (const module of modules) {
    for (const topic of module.topics) {
      topic.id = generateId();
    }
  }

  return modules;
}
