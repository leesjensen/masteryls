import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

function scheduleCourseOverride() {
  return {
    modules: [
      {
        title: 'Module 1',
        topics: [
          { id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', title: 'Home', path: 'README.md' },
          {
            id: 'a7db85a9-da40-4623-bce2-b99162b416f9',
            title: 'Schedule',
            type: 'schedule',
            path: 'instruction/schedule/schedule.md',
            state: 'published',
            externalRefs: {
              schedules: [
                { id: 'default', title: 'Winter', path: 'schedule.md', default: true },
                { id: 'joe', title: "Joe's schedule", path: 'joe-s-schedule.md', default: false },
              ],
            },
          },
        ],
      },
    ],
  };
}

function installScheduleRoutes(page: any) {
  const context = page.context();

  const markdownByRepoPath = new Map<string, string>([
    ['instruction/schedule/schedule.md', `# Winter 2026 Schedule\n\n| Week | Date | Module | Due | Topics Covered | Slides |\n| :--: | ---- | ------ | --- | -------------- | ------ |\n|  1   | Thu Jan 8 | Intro | | [Introduction](../instruction/introduction.md) | |\n\n## Special days\n\n- Jan 7: First day of class\n`],
    ['instruction/schedule/joe-s-schedule.md', `# Joe's schedule\n\n| Week | Date | Module | Due | Topics Covered | Slides |\n| :--: | ---- | ------ | --- | -------------- | ------ |\n|  1   | Fri Jan 9 | Intro | | [Joe Intro](../instruction/introduction.md) | |\n\n## Special days\n\n- Jan 9: Joe starts\n`],
  ]);

  const schedulePuts: Array<{ path: string; markdown: string }> = [];

  context.route(/https:\/\/raw\.githubusercontent\.com\/.*\/instruction\/schedule\/.*\.md$/, async (route) => {
    const url = route.request().url();
    const match = url.match(/\/main\/(instruction\/schedule\/[^?]+)/);
    const repoPath = match?.[1];
    if (repoPath && markdownByRepoPath.has(repoPath)) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: markdownByRepoPath.get(repoPath) || '',
      });
      return;
    }

    await route.continue();
  });

  context.route(/https:\/\/api\.github\.com\/repos\/ghAccount\/ghRepo\/contents\/instruction\/schedule\/.*\.md$/, async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const match = url.match(/\/contents\/(instruction\/schedule\/[^?]+)/);
    const repoPath = match?.[1];

    if (!repoPath) {
      await route.continue();
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        json: {
          path: repoPath,
          sha: 'fake-sha',
          download_url: `https://raw.githubusercontent.com/ghAccount/ghRepo/main/${repoPath}`,
          type: 'file',
        },
      });
      return;
    }

    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      const markdown = Buffer.from(body.content, 'base64').toString('utf8');
      markdownByRepoPath.set(repoPath, markdown);
      schedulePuts.push({ path: repoPath, markdown });
      await route.fulfill({ status: 201, json: { commit: { sha: 'schedule-commit-sha' } } });
      return;
    }

    await route.continue();
  });

  return { markdownByRepoPath, schedulePuts };
}

test('schedule read view lets learner switch files', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();

  await expect(page.getByRole('heading', { name: 'Winter 2026 Schedule' })).toBeVisible();

  await page.locator('select').first().selectOption('joe');
  await expect(page.getByRole('heading', { name: "Joe's schedule" })).toBeVisible();
});

test('schedule form editor commits and can create additional schedule files', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { schedulePuts } = installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  await expect(page.getByText('Schedule editor')).toBeVisible();

  const titleInput = page.locator('section').first().locator('input').first();
  await titleInput.fill('Edited Winter Schedule');
  await page.getByRole('button', { name: '+ Add week' }).click();

  const weekInputs = page.getByPlaceholder('Week');
  await weekInputs.nth(1).fill('2');
  await page.getByPlaceholder('Date').nth(1).fill('Thu Jan 15');
  await page.getByPlaceholder('Module').nth(1).fill('Service');

  await page.getByRole('button', { name: 'Commit', exact: true }).click();

  await expect.poll(() => schedulePuts.length).toBeGreaterThan(0);
  const latest = schedulePuts[schedulePuts.length - 1];
  expect(latest.path).toContain('instruction/schedule/');
  expect(latest.markdown).toContain('# Edited Winter Schedule');
  expect(latest.markdown).toContain('| 2 | Thu Jan 15 | Service');

  await page.getByPlaceholder('New schedule title').fill('Evening Schedule');
  await page.getByRole('button', { name: '+ Add schedule file' }).click();

  await expect(page.locator('select').first()).toHaveValue(/schedule-/);
  await expect.poll(() => schedulePuts.some((entry) => entry.path.endsWith('/evening-schedule.md'))).toBeTruthy();
});

test('schedule editor confirms before switching files with unsaved changes', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('label:has-text("File") select').first();
  await expect(fileSelect).toHaveValue('default');

  const titleInput = page.locator('section').first().locator('input').first();
  await titleInput.fill('Unsaved Title Change');

  page.once('dialog', async (dialog) => {
    await dialog.dismiss();
  });
  await fileSelect.selectOption('joe');

  await expect(fileSelect).toHaveValue('default');
  await expect(titleInput).toHaveValue('Unsaved Title Change');

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await fileSelect.selectOption('joe');

  await expect(fileSelect).toHaveValue('joe');
  await expect(titleInput).toHaveValue("Joe's schedule");
});
