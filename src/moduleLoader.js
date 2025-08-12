export default async function loadModules(baseUrl) {
  const response = await fetch(`${baseUrl}instruction/modules.md`);
  const fileData = await response.json();
  const markdownContent = atob(fileData.content);

  return parseModulesMarkdown(baseUrl, markdownContent);
}

function parseModulesMarkdown(baseUrl, markdownContent) {
  const lines = markdownContent.split('\n');

  const modules = [];
  let currentModule = null;

  const moduleRegex = /^##\s+(.*)$/;
  const topicRegex = /^-\s+\[(.+?)\]\((.+?)\)$/;

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
      const path = topicMatch[2].startsWith('http') ? topicMatch[2] : `${baseUrl}instruction/${topicMatch[2]}`;
      currentModule.topics.push({
        title: topicMatch[1].trim(),
        path: path,
      });
    }
  }

  if (currentModule) {
    modules.push(currentModule);
  }

  return modules;
}
