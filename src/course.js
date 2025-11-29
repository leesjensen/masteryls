export default class Course {
  static async create(catalogEntry) {
    const courseData = await load(catalogEntry);
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

  updateCatalogEntry(catalogEntry) {
    const newCourse = Course.copy(this);
    Object.assign(newCourse, catalogEntry);
    return newCourse;
  }

  moduleIndexOf(path) {
    return this.modules.findIndex((module) => module.topics.some((topic) => topic.path === path));
  }

  adjacentTopic(path, direction = 'prev') {
    let topicIndex = this.allTopics.findIndex((t) => t.path === path);
    topicIndex += direction === 'prev' ? -1 : 1;

    while (topicIndex >= 0 && topicIndex < this.allTopics.length) {
      const topic = this.allTopics[topicIndex];
      if (topic && (!topic.state || topic.state === 'stable')) {
        return topic;
      }
      topicIndex += direction === 'prev' ? -1 : 1;
    }
    return null;
  }

  topicFromId(id) {
    const topic = this.allTopics.find((t) => t.id === id);
    if (topic) {
      return topic;
    }
    return null;
  }

  topicFromTitle(title, defaultToFirst = true) {
    const topic = this.allTopics.find((t) => t.title === title);
    if (topic) {
      return topic;
    } else if (!topic && defaultToFirst) {
      return this.allTopics[0];
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
    return null;
  }

  map(op) {
    return this.modules.map(op);
  }
}

async function load(catalogEntry) {
  const gitHubLinks = {
    url: `https://github.com/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/blob/main`,
    apiUrl: `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/contents`,
    rawUrl: `https://raw.githubusercontent.com/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/main`,
  };

  let courseUrl = `${gitHubLinks.rawUrl}/course.json`;
  if (catalogEntry.gitHub.commit) {
    courseUrl = courseUrl.replace('main', catalogEntry.gitHub.commit);
  }

  const response = await fetch(courseUrl);
  if (!response.ok) {
    return loadCourseFromModulesMarkdown(catalogEntry, gitHubLinks);
  }
  const courseData = await response.json();
  courseData.name = catalogEntry.name || '';
  courseData.title = catalogEntry.title || '';
  courseData.description = catalogEntry.description || '';
  courseData.id = catalogEntry.id;
  courseData.links = catalogEntry.links || {};
  courseData.links.gitHub = gitHubLinks;
  courseData.gitHub = catalogEntry.gitHub;

  for (const module of courseData.modules) {
    for (const topic of module.topics) {
      if (topic.type && topic.type === 'video') {
        topic.path = `${topic.path}`;
      } else if (!topic.path.startsWith('http')) {
        topic.path = `${gitHubLinks.rawUrl}/${topic.path}`;
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
  return crypto.randomUUID();
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
