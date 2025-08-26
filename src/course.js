export default class Course {
  static async create(courseInfo) {
    const courseData = await load(courseInfo);
    return new Course(courseData);
  }

  constructor(courseData = { modules: [] }) {
    Object.assign(this, courseData);

    this.markdownCache = new Map();
    this.allTopics = this.modules.flatMap((m) => m.topics);
  }

  static copy(course) {
    const newModules = course.modules.map((module) => ({
      ...module,
      topics: module.topics.map((topic) => ({ ...topic })),
    }));
    const newCourse = new Course({ ...course, modules: newModules });

    newCourse.markdownCache = new Map(course.markdownCache);
    newCourse.allTopics = newCourse.modules.flatMap((m) => m.topics);

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
    return this.allTopics.find((t) => t.path === path) || (defaultToFirst ? this.allTopics[0] : null);
  }

  map(op) {
    return this.modules.map(op);
  }

  isDirty() {
    return this.allTopics.some((topic) => topic.lastUpdated !== undefined);
  }

  async topicMarkdown(topic) {
    if (this.markdownCache.has(topic.path)) {
      return this.markdownCache.get(topic.path);
    }

    return this._downloadTopicMarkdown(topic.path);
  }

  async saveTopicMarkdown(updatedTopic, content) {
    const updatedCourse = Course.copy(this);
    const savedTopic = updatedCourse.topicFromPath(updatedTopic.path);
    savedTopic.lastUpdated = Date.now();
    updatedCourse.markdownCache.set(updatedTopic.path, content);
    await updatedCourse._convertTopicToHtml(updatedTopic.path, content);
    return [updatedCourse, savedTopic];
  }

  async commitTopicMarkdown(updatedTopic, commitMessage = `update(${updatedTopic.title})`) {
    const updatedCourse = Course.copy(this);
    const savedTopic = updatedCourse.topicFromPath(updatedTopic.path);
    delete savedTopic.lastUpdated;

    const markdown = await updatedCourse.topicMarkdown(savedTopic);

    const contentPath = savedTopic.path.match(/\/main\/(.+)$/);
    const gitHubUrl = `${this.links.gitHub.apiUrl}/${contentPath[1]}`;

    // Get current file SHA - This will overwrite any changes made on GitHub since last fetch
    const getRes = await this.makeGitHubApiRequest(gitHubUrl);
    const fileData = await getRes.json();
    const sha = fileData.sha;

    // Commit to GitHub
    const contentBase64 = btoa(new TextEncoder().encode(markdown).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    await this.makeGitHubApiRequest(gitHubUrl, 'PUT', {
      message: commitMessage,
      content: contentBase64,
      sha,
    });

    return [updatedCourse, savedTopic];
  }

  async discardTopicMarkdown(updatedTopic) {
    const updatedCourse = Course.copy(this);
    const topic = updatedCourse.topicFromPath(updatedTopic.path);
    delete topic.lastUpdated;

    const markdown = await updatedCourse._downloadTopicMarkdown(topic.path);
    updatedCourse.markdownCache.set(topic.path, markdown);
    await updatedCourse._convertTopicToHtml(topic.path, markdown);
    return [updatedCourse, topic, markdown];
  }

  async _downloadTopicMarkdown(topicUrl) {
    const response = await fetch(topicUrl);
    const markdown = await response.text();
    this.markdownCache.set(topicUrl, markdown);

    return markdown;
  }

  async makeGitHubApiRequest(url, method = 'GET', body = null) {
    const request = {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    };
    if (body) {
      request.headers['Content-Type'] = 'application/json';
      request.body = JSON.stringify(body);
    }
    return fetch(url, request);
  }
}
``;
async function load(courseInfo) {
  const gitHub = {
    url: `https://github.com/${courseInfo.gitHub.account}/${courseInfo.gitHub.repository}/blob/main`,
    apiUrl: `https://api.github.com/repos/${courseInfo.gitHub.account}/${courseInfo.gitHub.repository}/contents`,
    rawUrl: `https://raw.githubusercontent.com/${courseInfo.gitHub.account}/${courseInfo.gitHub.repository}/main`,
  };

  const courseUrl = `${gitHub.rawUrl}/course.json`;
  const response = await fetch(courseUrl);
  if (!response.ok) {
    return loadCourseFromModulesMarkdown(courseInfo.title, gitHub);
  }
  const courseData = await response.json();
  courseData.id = courseInfo.id;
  courseData.links = courseData.links || {};
  courseData.links.gitHub = gitHub;
  courseData.schedule = courseData.schedule ? `${gitHub.rawUrl}/${courseData.schedule}` : undefined;
  courseData.syllabus = courseData.syllabus ? `${gitHub.rawUrl}/${courseData.syllabus}` : undefined;
  courseData.token = courseInfo.gitHub.token;

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
async function loadCourseFromModulesMarkdown(title, gitHub) {
  const response = await fetch(`${gitHub.rawUrl}/instruction/modules.md`);
  const markdownContent = await response.text();

  const instructionUrl = `${gitHub.rawUrl}/instruction/`;
  const modules = parseModulesMarkdown(gitHub, instructionUrl, markdownContent);

  const schedule = `${gitHub.rawUrl}/schedule/schedule.md`;
  const syllabus = `${gitHub.rawUrl}/instruction/syllabus/syllabus.md`;

  return { title, schedule, syllabus, modules, links: { gitHub } };
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
        { title: 'Home', path: `${gitHub.apiUrl}/README.md` },
        { title: 'Syllabus', path: `${gitHub.apiUrl}/syllabus/syllabus.md` },
        { title: 'Schedule', path: `${gitHub.apiUrl}/schedule/schedule.md` },
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
