import { generateId } from './utils/utils.js';

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

  copyWithNewSettings(catalogEntry) {
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
    throw new Error(`Unable to load course.json`);
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
      if (!topic.path.startsWith('http')) {
        topic.path = `${gitHubLinks.rawUrl}/${topic.path}`;
      }
    }
  }

  return courseData;
}
