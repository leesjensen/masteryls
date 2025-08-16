export default class Course {
  static async create(config) {
    const modules = await Course._load(config);
    return new Course(config, modules);
  }

  constructor(config, modules) {
    this.config = config;
    this.modules = modules;

    this.markdownCache = new Map();
    this.htmlCache = new Map();

    this.allTopics = this.modules.flatMap((m) => m.topics);
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

  async topicHtml(topicUrl) {
    try {
      if (this.htmlCache.has(topicUrl)) {
        return this.htmlCache.get(topicUrl);
      }

      const markdown = await this._downloadTopicMarkdown(topicUrl);
      return this._convertTopicToHtml(topicUrl, markdown);
    } catch (e) {
      console.error(e);
      return '<p>Error loading content.</p>';
    }
  }

  async topicMarkdown(topic) {
    if (this.markdownCache.has(topic.path)) {
      return this.markdownCache.get(topic.path);
    }

    return this._downloadTopicMarkdown(topic.path);
  }

  static copy(course) {
    const newCourse = new Course(
      { ...course.config },
      course.modules.map((module) => ({
        ...module,
        topics: module.topics.map((topic) => ({ ...topic })),
      }))
    );
    newCourse.markdownCache = new Map(course.markdownCache);
    newCourse.htmlCache = new Map(course.htmlCache);

    newCourse.allTopics = newCourse.modules.flatMap((m) => m.topics);

    return newCourse;
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

    const gitHubUrl = `${this.config.links.gitHub.apiUrl}/${savedTopic.path.match(/\/contents\/(.+)$/)[1]}`;

    // Get current file SHA
    const getRes = await this.makeRequest(gitHubUrl);
    const fileData = await getRes.json();
    const sha = fileData.sha;

    // Commit to GitHub
    const contentBase64 = btoa(new TextEncoder().encode(markdown).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    await this.makeRequest(gitHubUrl, 'PUT', {
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
    const response = await this.makeRequest(topicUrl);
    const fileData = await response.json();
    const markdown = new TextDecoder('utf-8').decode(Uint8Array.from(atob(fileData.content), (c) => c.charCodeAt(0)));
    this.markdownCache.set(topicUrl, markdown);

    return markdown;
  }

  async _convertTopicToHtml(topicUrl, markdown) {
    let baseUrl = this.config.links.gitHub.rawUrl;
    let contentPath = topicUrl.split('/contents/')[1];
    contentPath = contentPath.substring(0, contentPath.lastIndexOf('/'));
    if (contentPath) {
      baseUrl += `/${contentPath}`;
    }

    const response = await this.makeRequest('https://api.github.com/markdown', 'POST', {
      text: markdown,
      mode: 'gfm',
      context: `${this.config.github.account}/${this.config.github.repository}`,
    });
    let html = await response.text();
    html = this._replaceImageLinks(baseUrl, html);
    html = this._postProcessTopicHTML(html);
    this.htmlCache.set(topicUrl, html);

    return html;
  }

  _postProcessTopicHTML(html) {
    html = html.replace(/<div class="highlight highlight-source-mermaid"><pre class="notranslate">([\s\S]*?)<\/pre><\/div>/g, (_, diagramContent) => {
      const cleanDiagram = diagramContent.replace(/<[^>]*>/g, '').trim();
      return `<div class="mermaid">${cleanDiagram}</div>`;
    });
    return html;
  }

  _replaceImageLinks(baseUrl, html) {
    html = html.replace(/<a[^>]*><img([^>]+)src=["'](?!https?:\/\/|\/)([^"']+)["']([^>]*)><\/a>/g, (match, beforeSrc, url, afterSrc) => {
      const absUrl = `${baseUrl}/${url.replace(/^\.\//, '')}`;
      return `<img${beforeSrc}src="${absUrl}"${afterSrc}>`;
    });

    return html;
  }

  async makeRequest(url, method = 'GET', body = null) {
    const request = {
      method,
      headers: {
        Authorization: `Bearer ${this.config.github.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    };
    if (body) {
      request.headers['Content-Type'] = 'application/json';
      request.body = JSON.stringify(body);
    }
    const response = await fetch(url, request);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response;
  }

  static async _load(config) {
    const response = await fetch(`${config.links.gitHub.apiUrl}/instruction/modules.md`, {
      headers: {
        Authorization: `Bearer ${config.github.token}`,
      },
    });

    const fileData = await response.json();
    const markdownContent = new TextDecoder('utf-8').decode(Uint8Array.from(atob(fileData.content), (c) => c.charCodeAt(0)));

    const instructionUrl = `${config.links.gitHub.apiUrl}/instruction/`;
    return Course._parseModulesMarkdown(config, instructionUrl, markdownContent);
  }

  static _parseModulesMarkdown(config, instructionUrl, markdownContent) {
    const lines = markdownContent.split('\n');

    const modules = [
      {
        title: 'Course info',
        topics: [
          { title: 'Home', path: `${config.links.gitHub.apiUrl}/README.md` },
          { title: 'Syllabus', path: config.links.syllabus || `${config.links.gitHub.apiUrl}/syllabus/syllabus.md` },
          { title: 'Schedule', path: config.links.schedule || `${config.links.gitHub.apiUrl}/schedule/schedule.md` },
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

    return modules;
  }
}
