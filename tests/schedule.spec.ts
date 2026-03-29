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
            schedules: [
              { id: 'default', title: 'Winter', path: 'schedule.md', default: true },
              { id: 'joe', title: "Joe's schedule", path: 'joe-s-schedule.md', default: false },
            ],
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
  const scheduleDeletes: string[] = [];

  context.route(/https:\/\/raw\.githubusercontent\.com\/.*\/instruction\/schedule\/.*\.md$/, async (route: any) => {
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

  context.route(/https:\/\/api\.github\.com\/repos\/ghAccount\/ghRepo\/contents\/instruction\/schedule\/.*\.md$/, async (route: any) => {
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

    if (method === 'DELETE') {
      markdownByRepoPath.delete(repoPath);
      scheduleDeletes.push(repoPath);
      await route.fulfill({ status: 200, json: { commit: { sha: 'schedule-delete-sha' } } });
      return;
    }

    await route.continue();
  });

  return { markdownByRepoPath, schedulePuts, scheduleDeletes };
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

test('schedule editor can create a new schedule by copying an existing schedule', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { schedulePuts, markdownByRepoPath } = installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('label:has-text("File") select').first();
  await fileSelect.selectOption('__new_schedule__');

  const dialog = page.locator('dialog:has-text("New schedule")');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Schedule title').fill('Copied Joe Schedule');
  const sourceSelect = dialog.locator('select');
  await sourceSelect.selectOption('joe');
  await expect(sourceSelect).toHaveValue('joe');
  await dialog.getByRole('button', { name: 'Create' }).click();

  await expect.poll(() => schedulePuts.some((entry) => entry.markdown.includes('# Copied Joe Schedule'))).toBeTruthy();

  const copiedContentWrite = [...schedulePuts].reverse().find((entry) => entry.markdown.includes('# Copied Joe Schedule'));
  expect(copiedContentWrite?.path || '').toContain('/copied-joe-schedule.md');
  expect(copiedContentWrite?.markdown || '').toContain('[Joe Intro](../instruction/introduction.md)');

  await expect(fileSelect.locator('option[value="default"]')).toHaveCount(1);
  await expect(fileSelect.locator('option[value="joe"]')).toHaveCount(1);

  const copiedOption = fileSelect.locator('option').filter({ hasText: 'Copied Joe Schedule' });
  await expect(copiedOption).toHaveCount(1);
  const copiedOptionValue = await copiedOption.first().getAttribute('value');
  expect(copiedOptionValue).toBeTruthy();
  if (!copiedOptionValue) {
    throw new Error('Expected copied schedule option to have a value.');
  }

  await fileSelect.selectOption(copiedOptionValue);
  await expect(fileSelect).toHaveValue(copiedOptionValue);
  await expect(page.locator('section').first().locator('input').first()).toHaveValue('Copied Joe Schedule');

  expect(markdownByRepoPath.get('instruction/schedule/joe-s-schedule.md')).toContain("# Joe's schedule");
});

test('schedule editor creates blank schedules with schedule markdown template', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { schedulePuts } = installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('label:has-text("File") select').first();
  await fileSelect.selectOption('__new_schedule__');

  const dialog = page.locator('dialog:has-text("New schedule")');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Schedule title').fill('Blank Section A');
  await dialog.locator('select').selectOption('');
  await dialog.getByRole('button', { name: 'Create' }).click();

  await expect.poll(() => schedulePuts.some((entry) => entry.path.endsWith('/blank-section-a.md'))).toBeTruthy();

  const created = [...schedulePuts].reverse().find((entry) => entry.path.endsWith('/blank-section-a.md'));
  expect(created?.markdown || '').toContain('# Blank Section A');
  expect(created?.markdown || '').toContain('| Week | Date | Module | Due | Topics Covered | Slides |');
  expect(created?.markdown || '').toContain('|  1   |      |        |     |                |        |');
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

test('schedule editor can rename and delete non-default schedule files', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { schedulePuts, scheduleDeletes } = installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('label:has-text("File") select').first();
  await fileSelect.selectOption('joe');

  await page.getByPlaceholder('Selected schedule title').fill("Joe's evening schedule");
  await page.getByPlaceholder('Selected schedule path').fill('joe-evening.md');
  await page.getByRole('button', { name: 'Rename schedule' }).click();

  await expect.poll(() => schedulePuts.some((entry) => entry.path.endsWith('/joe-evening.md'))).toBeTruthy();
  await expect.poll(() => scheduleDeletes.some((path) => path.endsWith('/joe-s-schedule.md'))).toBeTruthy();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete schedule' }).click();

  await expect(fileSelect).toHaveValue('default');
  await expect.poll(() => scheduleDeletes.some((path) => path.endsWith('/joe-evening.md'))).toBeTruthy();
});

test('schedule editor can set default schedule used as fallback selection', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('label:has-text("File") select').first();
  await fileSelect.selectOption('joe');
  await page.getByRole('button', { name: 'Set as default' }).click();

  await page.evaluate(() => {
    const key = 'uiSettings-14602d77-0ff3-4267-b25e-4a7c3c47848b';
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const settings = JSON.parse(raw);
    delete settings.selectedScheduleFiles;
    localStorage.setItem(key, JSON.stringify(settings));
  });

  await page.getByRole('link', { name: 'Home' }).click();
  await page.getByRole('link', { name: 'Schedule' }).click();

  const readSelect = page.locator('label:has-text("Schedule") select').first();
  await expect(readSelect).toHaveValue('joe');
});
