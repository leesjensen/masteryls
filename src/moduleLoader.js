export default async function loadModules(config) {
  const response = await fetch(`${config.gitHub.apiUrl}/instruction/modules.md`, {
    headers: {
      Authorization: `Bearer ${config.github.token}`,
    },
  });

  const fileData = await response.json();
  const markdownContent = new TextDecoder('utf-8').decode(Uint8Array.from(atob(fileData.content), (c) => c.charCodeAt(0)));

  return parseModulesMarkdown(config.gitHub.apiUrl, markdownContent);
}

function parseModulesMarkdown(baseUrl, markdownContent) {
  const lines = markdownContent.split('\n');

  const modules = [];
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
      const path = isAbsoluteUrl ? topicMatch[3] : `${baseUrl}/instruction/${topicMatch[3]}`;
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
