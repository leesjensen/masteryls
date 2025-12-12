import { generateId } from '../utils/utils';
import { aiCourseGenerator, aiCourseOverviewGenerator } from '../ai/aiContentGenerator';

export async function createCourseInternal(service, user, generateWithAi, sourceAccount, sourceRepo, catalogEntry, gitHubToken, setUpdateMessage) {
  let newCatalogEntry;
  if (generateWithAi) {
    const apiKey = user.getSetting('geminiApiKey');
    setUpdateMessage('Using AI to create course topics');
    const messages = ['The gerbil is digging', 'The hamster is running', 'The beaver is building', 'The squirrel is gathering nuts'];
    const messageInterval = setInterval(() => {
      setUpdateMessage(messages[Math.floor(Math.random() * messages.length)]);
    }, 3000);
    const courseText = await aiCourseGenerator(apiKey, catalogEntry.title, catalogEntry.description);
    const courseJson = JSON.parse(courseText);
    clearInterval(messageInterval);
    catalogEntry.outcomes = courseJson.outcomes || [];
    setUpdateMessage('Creating course repository');
    newCatalogEntry = await service.createCourseEmpty(user, catalogEntry, gitHubToken);
    setUpdateMessage('Creating course overview');
    const overview = await aiCourseOverviewGenerator(apiKey, courseJson);
    const overviewGitHubUrl = `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/contents/README.md`;
    await service.commitGitHubFile(overviewGitHubUrl, overview, gitHubToken, 'add(course) generated overview');
  } else {
    setUpdateMessage('Creating course from template');
    newCatalogEntry = await service.createCourseFromTemplate(user, sourceAccount, sourceRepo, catalogEntry, gitHubToken);

    setUpdateMessage('Parsing course resources');
    newCatalogEntry = await loadCourseFromModulesMarkdown(newCatalogEntry);
  }

  setUpdateMessage('Saving course');
  await addCourseSettings(service, newCatalogEntry, gitHubToken);

  await service.createEnrollment(user.id, newCatalogEntry);
}

// This is a fallback for when course.json is not found
async function loadCourseFromModulesMarkdown(catalogEntry) {
  const gitHubUrl = `https://raw.githubusercontent.com/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/main`;
  const [instructionPath, modulesMarkdown] = await getModulesMarkdown(gitHubUrl);
  const modules = parseModulesMarkdown(gitHubUrl, instructionPath, modulesMarkdown);

  return { ...catalogEntry, modules };
}

async function addCourseSettings(service, catalogEntry, gitHubToken) {
  const gitHubUrl = `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/contents/course.json`;
  const courseJson = JSON.stringify(catalogEntry, null, 2);

  const commitMessage = 'add(course) course settings';
  const commit = await service.commitGitHubFile(gitHubUrl, courseJson, gitHubToken, commitMessage);
  await service.saveCourseSettings({ id: catalogEntry.id, gitHub: { ...catalogEntry.gitHub, commit } });
}

async function getModulesMarkdown(gitHubUrl) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  let attemptCount = 0;
  // Since we are reading right after creating the repo, we may need to retry a few times
  while (attemptCount < 3) {
    let instructionPath = 'instruction';
    let instructionModules = 'modules.md';

    let response = await fetch(`${gitHubUrl}/${instructionPath}/${instructionModules}`);
    if (response.ok) {
      return [instructionPath, await response.text()];
    }
    attemptCount++;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Unable to load modules`);
}

function parseModulesMarkdown(gitHubUrl, instructionPath, modulesMarkdown) {
  const lines = modulesMarkdown.split('\n');

  const modules = [
    {
      title: 'Course info',
      topics: [
        { id: generateId(), title: 'Home', path: `${gitHubUrl}/README.md` },
        { id: generateId(), title: 'Syllabus', path: `${gitHubUrl}/syllabus/syllabus.md` },
        { id: generateId(), title: 'Schedule', path: `${gitHubUrl}/schedule/schedule.md` },
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
        id: generateId(),
        topics: [],
      };
      continue;
    }

    const topicMatch = line.match(topicRegex);
    if (topicMatch && currentModule) {
      let prefix = topicMatch[1] ? topicMatch[1] : '';
      let title = topicMatch[2] ? topicMatch[2].trim() : '';
      const path = `${instructionPath}/${topicMatch[3] ? topicMatch[3].trim() : ''}`;

      currentModule.topics.push({
        title: `${prefix}${title}`,
        path: path,
        id: generateId(),
      });
    }
  }

  if (currentModule) {
    modules.push(currentModule);
  }

  return modules;
}
