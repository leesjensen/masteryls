export default class Course {
  static async create(config) {
    const modules = await Course.load(config);
    return new Course(config, modules);
  }

  constructor(config, modules) {
    this.config = config;
    this.modules = modules;

    this.markdownCache = new Map();
    this.htmlCache = new Map();

    this.allTopics = this.modules.flatMap((module) =>
      module.topics.map((t, idx) => ({
        ...t,
        moduleIndex: this.modules.indexOf(module),
        topicIndex: idx,
      }))
    );
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

  map(op) {
    return this.modules.map(op);
  }

  async topicHtml(topicUrl) {
    try {
      if (this.htmlCache.has(topicUrl)) {
        return this.htmlCache.get(topicUrl);
      }

      const markdown = await this.downloadTopicMarkdown(topicUrl);
      this.markdownCache.set(topicUrl, markdown);

      const html = await this.convertTopicToHtml(topicUrl, markdown);
      const processedHtml = this.postProcessTopicHTML(html);
      this.htmlCache.set(topicUrl, processedHtml);

      return processedHtml;
    } catch (e) {
      console.error(e);
      return '<p>Error loading content.</p>';
    }
  }

  async downloadTopicMarkdown(topicUrl) {
    const fileResponse = await fetch(topicUrl, {
      headers: {
        accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.config.github.token}`,
      },
    });
    const fileData = await fileResponse.json();
    return new TextDecoder('utf-8').decode(Uint8Array.from(atob(fileData.content), (c) => c.charCodeAt(0)));
  }

  async convertTopicToHtml(topicUrl, markdown) {
    let baseUrl = this.config.links.gitHub.rawUrl;
    let contentPath = topicUrl.split('/contents/')[1];
    contentPath = contentPath.substring(0, contentPath.lastIndexOf('/'));
    if (contentPath) {
      baseUrl += `/${contentPath}`;
    }

    const response = await fetch('https://api.github.com/markdown', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.github.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        text: markdown,
        mode: 'gfm',
        context: `${this.config.github.account}/${this.config.github.repository}`,
      }),
    });

    const html = this.replaceImageLinks(baseUrl, await response.text());

    return html;
  }

  postProcessTopicHTML(html) {
    html = html.replace(/<div class="highlight highlight-source-mermaid"><pre class="notranslate">([\s\S]*?)<\/pre><\/div>/g, (_, diagramContent) => {
      const cleanDiagram = diagramContent.replace(/<[^>]*>/g, '').trim();
      return `<div class="mermaid">${cleanDiagram}</div>`;
    });
    return html;
  }

  replaceImageLinks(baseUrl, html) {
    html = html.replace(/<img([^>]+)src=["'](?!https?:\/\/|\/)([^"']+)["']([^>]*)>/g, (match, beforeSrc, url, afterSrc) => {
      const absUrl = `${baseUrl}/${url.replace(/^\.\//, '')}`;
      return `<img${beforeSrc}src="${absUrl}"${afterSrc}>`;
    });

    return html;
  }

  static async load(config) {
    const response = await fetch(`${config.links.gitHub.apiUrl}/instruction/modules.md`, {
      headers: {
        Authorization: `Bearer ${config.github.token}`,
      },
    });

    const fileData = await response.json();
    const markdownContent = new TextDecoder('utf-8').decode(Uint8Array.from(atob(fileData.content), (c) => c.charCodeAt(0)));

    const instructionUrl = `${config.links.gitHub.apiUrl}/instruction/`;
    return Course.parseModulesMarkdown(config, instructionUrl, markdownContent);
  }

  static parseModulesMarkdown(config, instructionUrl, markdownContent) {
    const lines = markdownContent.split('\n');

    const modules = [
      {
        title: 'Course info',
        topics: [
          { title: 'Home', path: `${config.links.gitHub.apiUrl}/README.md` },
          { title: 'Syllabus', path: config.links.syllabus },
          { title: 'Schedule', path: config.links.schedule },
        ],
      },
    ];
    let currentModule = null;

    const moduleRegex = /^##\s+(.*)$/;
    const topicRegex = /^-\s(.*)\[(.+?)\]\((.+?)\)$/;

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
        const isAbsoluteUrl = /^(?:[a-z]+:)?\/\//i.test(topicMatch[3]);
        const path = isAbsoluteUrl ? topicMatch[3] : new URL(topicMatch[3], instructionUrl).toString();
        currentModule.topics.push({
          title: `${topicMatch[1].trim()} ${topicMatch[2].trim()}`,
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
