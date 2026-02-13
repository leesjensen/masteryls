import { generateId } from '../utils/utils';
import { aiCourseGenerator, aiCourseOverviewGenerator } from '../ai/aiContentGenerator';

export async function createCourseInternal(service, user, generateWithAi, sourceAccount, sourceRepo, catalogEntry, gitHubToken, setUpdateMessage) {
  if (generateWithAi) {
    setUpdateMessage('Using AI to create course');
    const messages = ['The gerbil is digging', 'The hamster is running', 'The beaver is building', 'The squirrel is gathering nuts', 'The spider is spinning a web'];
    const messageInterval = setInterval(() => {
      setUpdateMessage(messages[Math.floor(Math.random() * messages.length)]);
    }, 3000);
    const courseJson = await aiCourseGenerator(catalogEntry.title, catalogEntry.description);
    clearInterval(messageInterval);

    const courseDefinition = JSON.parse(courseJson);
    courseDefinition.title = catalogEntry.title;
    courseDefinition.description = catalogEntry.description;
    assignCourseIds(courseDefinition);

    setUpdateMessage('Creating course repository');
    await service.createCourseRepoFromDefaultTemplate(catalogEntry, gitHubToken);

    setUpdateMessage('Waiting for course repository to be ready');
    await waitForCourseRepositoryReady(service, catalogEntry, gitHubToken);

    setUpdateMessage('Configuring course definition');
    catalogEntry = await service.createCatalogEntry(user, catalogEntry, gitHubToken);
    await commitCourseDefinition(service, catalogEntry, courseDefinition, gitHubToken, service.updateGitHubFile.bind(service));

    setUpdateMessage('Creating course overview');
    const overview = await aiCourseOverviewGenerator(courseDefinition);
    const overviewGitHubUrl = `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/contents/README.md`;
    await service.commitGitHubFile(overviewGitHubUrl, overview, gitHubToken, 'add(course) generated overview');
  } else {
    setUpdateMessage('Creating course repository');
    await service.createCourseRepoFromTemplate(sourceAccount, sourceRepo, catalogEntry, gitHubToken);

    setUpdateMessage('Waiting for course repository to be ready');
    await waitForCourseRepositoryReady(service, catalogEntry, gitHubToken);

    setUpdateMessage('Configuring course definition');
    catalogEntry = await service.createCatalogEntry(user, catalogEntry, gitHubToken);
    if (!(await loadCourseDefinition(service, catalogEntry, gitHubToken))) {
      await createCourseDefinitionFromModulesMarkdown(service, catalogEntry, gitHubToken);
    }
  }

  await service.createEnrollment(user.id, catalogEntry);
}

async function loadCourseDefinition(service, catalogEntry, gitHubToken) {
  const getCourseDefinitionUrl = `https://raw.githubusercontent.com/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/main/course.json`;
  const response = await fetch(getCourseDefinitionUrl);
  if (!response.ok) return false;

  const courseDefinition = await response.json();
  assignCourseIds(courseDefinition);

  await commitCourseDefinition(service, catalogEntry, courseDefinition, gitHubToken, service.updateGitHubFile.bind(service));
  return true;
}

// This is a fallback for when course.json is not found
async function createCourseDefinitionFromModulesMarkdown(service, catalogEntry, gitHubToken) {
  const modulesMarkdown = await getModulesMarkdown(catalogEntry);
  const modules = parseModulesMarkdown(modulesMarkdown);

  const courseDefinition = { title: catalogEntry.title, modules };
  await commitCourseDefinition(service, catalogEntry, courseDefinition, gitHubToken, service.commitGitHubFile.bind(service));
}

async function commitCourseDefinition(service, catalogEntry, courseDefinition, gitHubToken, commitCommand) {
  const commitMessage = 'update(course) definition';
  const commitCourseDefinitionUrl = `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/contents/course.json`;
  const courseJson = JSON.stringify(courseDefinition, null, 2);
  const commit = await commitCommand(commitCourseDefinitionUrl, courseJson, gitHubToken, commitMessage);
  await service.saveCatalogEntry({ id: catalogEntry.id, gitHub: { ...catalogEntry.gitHub, commit } });
}

async function getModulesMarkdown(catalogEntry) {
  const gitHubRepoUrl = `https://raw.githubusercontent.com/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}/main`;
  let response = await fetch(`${gitHubRepoUrl}/instruction/modules.md`);
  if (!response.ok) throw new Error(`Unable to load modules`);
  return await response.text();
}

function parseModulesMarkdown(modulesMarkdown) {
  // used to resolve relative paths
  const stubRootUrl = 'https://stub.com/';
  const stubContentUrl = `${stubRootUrl}instruction/`;

  const lines = modulesMarkdown.split('\n');

  const modules = [];
  let currentModule = null;

  const moduleRegex = /^##\s+(.*)$/;
  const topicRegex = /^-\s(.*\s)?\[(.+?)\]\((.+?)\)$/;

  for (const line of lines) {
    const moduleMatch = line.match(moduleRegex);
    if (moduleMatch) {
      currentModule = {
        title: moduleMatch[1].trim(),
        id: generateId(),
        topics: [],
      };
      modules.push(currentModule);

      continue;
    }

    const topicMatch = line.match(topicRegex);
    if (topicMatch && currentModule) {
      let prefix = topicMatch[1] ? topicMatch[1] : '';
      let title = topicMatch[2] ? topicMatch[2].trim() : '';
      const path = new URL(topicMatch[3], stubContentUrl).toString().replace(stubRootUrl, '');

      currentModule.topics.push({
        title: `${prefix}${title}`,
        path: path,
        id: generateId(),
      });
    }
  }

  // Create a default module if none was found
  if (currentModule === null) {
    modules.push({
      title: 'Course info',
      id: generateId(),
      topics: [],
    });
  }

  // Add the Home topic to point to the repository readme
  modules[0].topics.unshift({
    title: 'Home',
    path: `README.md`,
    id: generateId(),
  });

  return modules;
}

async function waitForCourseRepositoryReady(service, catalogEntry, gitHubToken, timeoutMs = 60000, intervalMs = 1000) {
  const startedAt = Date.now();
  const repositoryUrl = `https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}`;
  let previousTreeSha = null;
  let stablePollCount = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const repositoryResponse = await service.makeGitHubApiRequest(gitHubToken, repositoryUrl);
    if (repositoryResponse.ok) {
      const repository = await repositoryResponse.json();
      if (repository.default_branch) {
        const treeUrl = `${repositoryUrl}/git/trees/${encodeURIComponent(repository.default_branch)}?recursive=1`;
        const treeResponse = await service.makeGitHubApiRequest(gitHubToken, treeUrl);
        if (treeResponse.ok) {
          const tree = await treeResponse.json();
          const treeEntries = Array.isArray(tree.tree) ? tree.tree : [];

          if (tree.sha && treeEntries.length > 0) {
            if (tree.sha === previousTreeSha) {
              stablePollCount += 1;
            } else {
              previousTreeSha = tree.sha;
              stablePollCount = 0;
            }

            if (stablePollCount >= 1) {
              return;
            }
          }
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out waiting for course repository template to finish provisioning');
}

function assignCourseIds(courseDefinition) {
  for (const module of courseDefinition.modules) {
    for (const topic of module.topics) {
      topic.id = generateId();
    }
  }
  return courseDefinition;
}
