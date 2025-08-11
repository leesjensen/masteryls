export default async function loadModules() {
  const response = await fetch('https://api.github.com/repos/softwareconstruction240/softwareconstruction/contents/instruction/modules.md');
  const fileData = await response.json();
  const markdownContent = atob(fileData.content);

  return parseModulesMarkdown(markdownContent);
}

function parseModulesMarkdown(markdownContent) {
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
      currentModule.topics.push({
        title: topicMatch[1].trim(),
        path: topicMatch[2].trim(),
      });
    }
  }

  if (currentModule) {
    modules.push(currentModule);
  }

  return modules;
}
