import { generateId } from './utils/utils.js';

export default class Course {
  static async load(catalogEntry) {
    try {
      const courseDefinition = await loadFromDefinition(catalogEntry);
      return new Course(courseDefinition);
    } catch (error) {
      return null;
    }
  }

  constructor(courseDefinition = { modules: [] }) {
    Object.assign(this, courseDefinition);

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

  defaultTopic() {
    if (this.allTopics.length === 0 || !this.allTopics[0].id) return null;
    return this.allTopics[0];
  }

  adjacentTopic(path, direction = 'prev') {
    let topicIndex = this.allTopics.findIndex((t) => t.path === path);
    topicIndex += direction === 'prev' ? -1 : 1;

    while (topicIndex >= 0 && topicIndex < this.allTopics.length) {
      const topic = this.allTopics[topicIndex];
      if (topic && (!topic.state || topic.state === 'published')) {
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

async function loadFromDefinition(catalogEntry) {
  const gitHubLinks = {
    url: `https://github.com/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/blob/main`,
    apiUrl: `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/contents`,
    rawUrl: `https://raw.githubusercontent.com/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/main`,
  };

  let courseDefinitionUrl = `${gitHubLinks.rawUrl}/course.json`;
  if (catalogEntry.gitHub.commit) {
    courseDefinitionUrl = courseDefinitionUrl.replace('main', catalogEntry.gitHub.commit);
  }

  const response = await fetch(courseDefinitionUrl);
  if (!response.ok) {
    throw new Error(`Unable to load course data file from ${courseDefinitionUrl}`);
  }

  // Prefer the information in the catalog entry
  const courseDefinition = await response.json();
  courseDefinition.name = catalogEntry.name || '';
  courseDefinition.title = catalogEntry.title || '';
  courseDefinition.description = catalogEntry.description || '';
  courseDefinition.id = catalogEntry.id;
  courseDefinition.links = catalogEntry.links || {};
  courseDefinition.links.gitHub = gitHubLinks;
  courseDefinition.gitHub = catalogEntry.gitHub;
  courseDefinition.settings = catalogEntry.settings || { state: 'published' };

  // Make the topic paths absolute while executing (these are not stored in the course definition)
  for (const module of courseDefinition.modules) {
    for (const topic of module.topics) {
      if (!topic.path.startsWith('http')) {
        topic.path = `${gitHubLinks.rawUrl}/${topic.path}`;
      }
    }
  }

  return courseDefinition;
}
