import { test, expect } from './fixtures';
import { initBasicCourse } from './testInit';

async function mockAboutReadme(page: any) {
  const readmeFiles = {
    'README.md': `# MasteryLS README

- [Learner tutorial](docs/learnerTutorial.md)
- [Editor tutorial](docs/editorTutorial.md)
- [Deploying your own instance of MasteryLS](docs/deploying.md)
- [MasteryLS software architecture](docs/architecture.md)
`,
    'docs/learnerTutorial.md': '# Learner Tutorial\n\nLearner tutorial content.',
    'docs/editorTutorial.md': '# Editor Tutorial\n\nEditor tutorial content.',
    'docs/deploying.md': '# Deploying MasteryLS\n\nDeployment content.',
    'docs/architecture.md': '# MasteryLS Architecture\n\nArchitecture content.',
  };

  for (const [path, body] of Object.entries(readmeFiles)) {
    await page.context().route(`https://raw.githubusercontent.com/leesjensen/masteryls/main/${path}`, async (route: any) => {
      await route.fulfill({ body, contentType: 'text/plain; charset=utf-8' });
    });
  }
}

test('start page links to About and Demo Courses', async ({ page }) => {
  await initBasicCourse({ page });
  await mockAboutReadme(page);
  await page.goto('http://localhost:5173/');

  await expect(page.getByRole('heading', { name: 'MasteryLS', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Demo( courses)?/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'About' })).toBeVisible();

  await page.getByRole('button', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { name: 'MasteryLS README' })).toBeVisible();

  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: /Demo( courses)?/ }).click();
  await expect(page).toHaveURL(/\/demo-courses$/);
  await expect(page.getByRole('heading', { name: 'Try a course' })).toBeVisible();
});

test('about page renders README Markdown and relative Markdown links', async ({ page }) => {
  await initBasicCourse({ page });
  await mockAboutReadme(page);
  await page.goto('http://localhost:5173/about');

  await expect(page.getByRole('heading', { name: 'MasteryLS README' })).toBeVisible();
  await expect(page.getByText(/^Version /)).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);

  const markdownLinks = [
    ['Learner tutorial', 'Learner Tutorial'],
    ['Editor tutorial', 'Editor Tutorial'],
    ['Deploying your own instance of MasteryLS', 'Deploying MasteryLS'],
    ['MasteryLS software architecture', 'MasteryLS Architecture'],
  ];

  for (const [linkName, headingName] of markdownLinks) {
    await page.getByRole('link', { name: linkName }).click();
    await expect(page.getByRole('heading', { name: headingName })).toBeVisible();
    await expect(page.getByRole('button', { name: /Back to README/ })).toBeVisible();
    await page.getByRole('button', { name: /Back to README/ }).click();
    await expect(page.getByRole('heading', { name: 'MasteryLS README' })).toBeVisible();
  }
});

test('demo courses page lists browseable course catalog and navigates to course', async ({ page }) => {
  await initBasicCourse({ page });
  await page.goto('http://localhost:5173/demo-courses');

  await expect(page.getByRole('heading', { name: 'Try a course' })).toBeVisible();
  await expect(page.getByRole('option', { name: /Rocket Science/ })).toBeVisible();

  await page.getByRole('option', { name: /Rocket Science/ }).click();
  await expect(page).toHaveURL(/\/course\//);
  await expect(page.getByRole('banner')).toContainText('Rocket Science');
});
