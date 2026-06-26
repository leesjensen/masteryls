import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

const DRA_REPO_PATH = 'instruction/reasoning-lab/reasoning-lab.md';

function draMarkdown(overrides: Record<string, unknown> = {}) {
  const model = {
    title: 'Reasoning Lab',
    discipline: 'Software Engineering',
    problemType: 'System modernization',
    difficulty: 4,
    mode: 'final',
    instability: true,
    learningOutcomes: 'Demonstrate systems thinking and evidence-based decisions.',
    ...overrides,
  };

  return `# ${model.title}\n\n**Discipline:** ${model.discipline}\n**Problem type:** ${model.problemType}\n**Difficulty:** ${model.difficulty} / 5\n**Mode:** ${model.mode === 'final' ? 'Final' : 'Practice'}\n**Instability:** ${model.instability ? 'On' : 'Off'}\n\n## Learning Outcomes\n\n${model.learningOutcomes}\n\n## Assessment Definition\n\n\`\`\`json\n${JSON.stringify(model, null, 2)}\n\`\`\`\n`;
}

function draCourseOverride() {
  return {
    modules: [
      {
        title: 'Module 1',
        topics: [
          { id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', title: 'Home', path: 'README.md' },
          { id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f', title: 'Reasoning Lab', path: DRA_REPO_PATH, type: 'dra' },
        ],
      },
    ],
  };
}

function installDraRoutes(page: any, initialMarkdown: string) {
  const context = page.context();
  let currentMarkdown = initialMarkdown;
  const draPuts: Array<{ path: string; markdown: string }> = [];

  context.route(/https:\/\/raw\.githubusercontent\.com\/.*\/instruction\/reasoning-lab\/.*\.md$/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: currentMarkdown,
    });
  });

  context.route(/https:\/\/api\.github\.com\/repos\/ghAccount\/ghRepo\/contents\/instruction\/reasoning-lab\/.*\.md$/, async (route: any) => {
    const method = route.request().method();
    const url = route.request().url();
    const repoPath = url.match(/\/contents\/(instruction\/reasoning-lab\/[^?]+)/)?.[1] || DRA_REPO_PATH;

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        json: {
          path: repoPath,
          sha: 'fake-dra-sha',
          download_url: `https://raw.githubusercontent.com/ghAccount/ghRepo/main/${repoPath}`,
          type: 'file',
        },
      });
      return;
    }

    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      const markdown = Buffer.from(body.content, 'base64').toString('utf8');
      currentMarkdown = markdown;
      draPuts.push({ path: repoPath, markdown });
      await route.fulfill({ status: 201, json: { commit: { sha: 'dra-commit-sha' } } });
      return;
    }

    await route.continue();
  });

  return { draPuts };
}

test('dra learner view renders the published parameters and learning outcomes', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown());

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();

  await expect(page.getByRole('heading', { name: 'Reasoning Lab', exact: true })).toBeVisible();
  await expect(page.getByText('Software Engineering')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Learning Outcomes', exact: true })).toBeVisible();
  await expect(page.getByText('Demonstrate systems thinking and evidence-based decisions.')).toBeVisible();
  await expect(page.getByText('a scenario will be generated', { exact: false })).toBeVisible();
});

test('dra graphical editor edits a field and commits updated markdown', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  const { draPuts } = installDraRoutes(page, draMarkdown());

  await navigateToCourse(page);
  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Reasoning Lab').click();

  await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible();

  const disciplineInput = page.getByPlaceholder('e.g. Software Engineering');
  await expect(disciplineInput).toHaveValue('Software Engineering');
  await disciplineInput.fill('Civil Engineering');

  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Discard' })).toBeDisabled();

  await expect.poll(() => draPuts.length).toBeGreaterThan(0);
  const latest = draPuts[draPuts.length - 1];
  expect(latest.path).toContain('instruction/reasoning-lab/');
  expect(latest.markdown).toContain('"discipline": "Civil Engineering"');
});
