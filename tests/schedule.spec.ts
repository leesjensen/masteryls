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
  const courseJsonPuts: any[] = [];

  context.route('https://api.github.com/**/contents/course.json', async (route: any) => {
    const method = route.request().method();
    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      const decoded = Buffer.from(body.content, 'base64').toString('utf8');
      courseJsonPuts.push(JSON.parse(decoded));
      await route.fulfill({ status: 201, json: { commit: { sha: 'schedule-coursejson-commit-sha' } } });
      return;
    }

    await route.continue();
  });

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

  return { markdownByRepoPath, schedulePuts, scheduleDeletes, courseJsonPuts };
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

  await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible();

  const titleInput = page.locator('section').first().locator('input').first();
  await titleInput.fill('Edited Winter Schedule');

  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Discard' })).toBeDisabled();

  await expect.poll(() => schedulePuts.length).toBeGreaterThan(0);
  const latest = schedulePuts[schedulePuts.length - 1];
  expect(latest.path).toContain('instruction/schedule/');
  expect(latest.markdown).toContain('# Edited Winter Schedule');

  const fileSelect = page.locator('select:has(option[value="__new_schedule__"])').first();
  page.once('dialog', async (dialog) => {
    if (dialog.message().includes('Discard unsaved schedule changes')) {
      await dialog.accept();
      return;
    }
    await dialog.dismiss();
  });
  await fileSelect.selectOption('__new_schedule__');
  const dialog = page.locator('dialog:has-text("New schedule")');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Schedule title').fill('Evening Schedule');
  await dialog.locator('select').selectOption('');
  await dialog.getByRole('button', { name: 'Create' }).click();

  await expect.poll(() => schedulePuts.some((entry) => entry.path.endsWith('/evening-schedule.md'))).toBeTruthy();
});

test('schedule editor can create a new schedule by copying an existing schedule', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { schedulePuts, markdownByRepoPath } = installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('select:has(option[value="__new_schedule__"])').first();
  await fileSelect.selectOption('joe');
  await expect(fileSelect).toHaveValue('joe');
  await expect(page.locator('section').first().locator('input').first()).toHaveValue("Joe's schedule");
  await fileSelect.selectOption('__new_schedule__');

  const dialog = page.locator('dialog:has-text("New schedule")');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Schedule title').fill('Copied Joe Schedule');
  const sourceSelect = dialog.locator('select');
  await sourceSelect.selectOption('joe');
  await expect(sourceSelect).toHaveValue('joe');
  await dialog.getByRole('button', { name: 'Create' }).click();

  await expect.poll(() => schedulePuts.some((entry) => entry.path.endsWith('/copied-joe-schedule.md') && entry.markdown.includes('[Joe Intro](../instruction/introduction.md)'))).toBeTruthy();

  const copiedContentWrite = [...schedulePuts].reverse().find((entry) => entry.path.endsWith('/copied-joe-schedule.md') && entry.markdown.includes('[Joe Intro](../instruction/introduction.md)'));
  expect(copiedContentWrite?.path || '').toContain('/copied-joe-schedule.md');

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

test('schedule editor can copy a schedule and remap dates to a first session date', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { schedulePuts } = installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('select:has(option[value="__new_schedule__"])').first();
  await fileSelect.selectOption('joe');
  await fileSelect.selectOption('__new_schedule__');

  const dialog = page.locator('dialog:has-text("New schedule")');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Schedule title').fill('Fall Copy');
  await dialog.locator('select').selectOption('joe');
  await dialog.locator('#new-schedule-start-date').fill('2026-04-01');
  await dialog.getByRole('button', { name: 'Create' }).click();

  await expect.poll(() => schedulePuts.some((entry) => entry.path.endsWith('/fall-copy.md') && entry.markdown.includes('Wed Apr 1') && entry.markdown.includes('[Joe Intro](../instruction/introduction.md)'))).toBeTruthy();
});

test('schedule copy shifts all sessions to previous weekday when first session date is earlier in the week', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { schedulePuts, markdownByRepoPath } = installScheduleRoutes(page);

  markdownByRepoPath.set('instruction/schedule/joe-s-schedule.md', `# Joe's schedule\n\n| Week | Date | Module | Due | Topics Covered | Slides |\n| :--: | ---- | ------ | --- | -------------- | ------ |\n|  1   | Tue Jan 6 2026 | Intro | | [Joe Intro](../instruction/introduction.md) | |\n|  1   | Thu Jan 8 2026 | Intro 2 | | [Joe Followup](../instruction/introduction.md) | |\n`);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('select:has(option[value="__new_schedule__"])').first();
  await fileSelect.selectOption('joe');
  await fileSelect.selectOption('__new_schedule__');

  const dialog = page.locator('dialog:has-text("New schedule")');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Schedule title').fill('Shift Earlier');
  await dialog.locator('select').selectOption('joe');
  await dialog.locator('#new-schedule-start-date').fill('2026-03-02');
  await dialog.getByRole('button', { name: 'Create' }).click();

  await expect
    .poll(() => {
      return schedulePuts.some((entry) => entry.path.endsWith('/shift-earlier.md') && entry.markdown.includes('Mon Mar 2') && entry.markdown.includes('Wed Mar 4'));
    })
    .toBeTruthy();
});

test('schedule copy shifts all sessions to next weekday when first session date is later in the week', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { schedulePuts, markdownByRepoPath } = installScheduleRoutes(page);

  markdownByRepoPath.set('instruction/schedule/joe-s-schedule.md', `# Joe's schedule\n\n| Week | Date | Module | Due | Topics Covered | Slides |\n| :--: | ---- | ------ | --- | -------------- | ------ |\n|  1   | Tue Jan 6 2026 | Intro | | [Joe Intro](../instruction/introduction.md) | |\n|  1   | Thu Jan 8 2026 | Intro 2 | | [Joe Followup](../instruction/introduction.md) | |\n`);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('select:has(option[value="__new_schedule__"])').first();
  await fileSelect.selectOption('joe');
  await fileSelect.selectOption('__new_schedule__');

  const dialog = page.locator('dialog:has-text("New schedule")');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Schedule title').fill('Shift Later');
  await dialog.locator('select').selectOption('joe');
  await dialog.locator('#new-schedule-start-date').fill('2026-03-04');
  await dialog.getByRole('button', { name: 'Create' }).click();

  await expect
    .poll(() => {
      return schedulePuts.some((entry) => entry.path.endsWith('/shift-later.md') && entry.markdown.includes('Wed Mar 4') && entry.markdown.includes('Fri Mar 6'));
    })
    .toBeTruthy();
});

test('schedule editor creates blank schedules with schedule markdown template', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { schedulePuts } = installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('select:has(option[value="__new_schedule__"])').first();
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

test('adding a schedule topic creates schedule template markdown and schedules metadata', async ({ page }) => {
  await initBasicCourse({ page });
  const { schedulePuts, courseJsonPuts } = installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.locator('.absolute.left-0\\.5').click();

  await page.getByRole('button', { name: '+ Add New Topic' }).first().click();
  await page.getByPlaceholder('Topic title').fill('schedule');
  await page
    .locator('select')
    .filter({ has: page.locator('option[value="schedule"]') })
    .first()
    .selectOption('schedule');
  await page.getByRole('button', { name: 'Generate' }).click();

  await expect.poll(() => schedulePuts.some((entry) => entry.path.endsWith('instruction/schedule/schedule.md'))).toBeTruthy();

  const createdScheduleMd = [...schedulePuts].reverse().find((entry) => entry.path.endsWith('instruction/schedule/schedule.md'));
  expect(createdScheduleMd?.markdown || '').toContain('# schedule');
  expect(createdScheduleMd?.markdown || '').toContain('| Week | Date | Module | Due | Topics Covered | Slides |');
  expect(createdScheduleMd?.markdown || '').not.toContain('overview content placeholder');

  await expect.poll(() => courseJsonPuts.length).toBeGreaterThan(0);
  const latestCourseJson = courseJsonPuts[courseJsonPuts.length - 1];
  const allTopics = (latestCourseJson.modules || []).flatMap((m: any) => m.topics || []);
  const scheduleTopic = allTopics.find((t: any) => t.type === 'schedule' && t.path === 'instruction/schedule/schedule.md');

  expect(scheduleTopic).toBeTruthy();
  expect(Array.isArray(scheduleTopic.schedules)).toBeTruthy();
  expect(scheduleTopic.schedules).toHaveLength(1);
  expect(scheduleTopic.schedules[0].title).toBe('schedule');
  expect(scheduleTopic.schedules[0].path).toBe('schedule.md');
  expect(scheduleTopic.schedules[0].default).toBe(true);
  expect(scheduleTopic.schedules[0].id).toMatch(/^[0-9a-f-]{36}$/i);
});

test('schedule editor confirms before switching files with unsaved changes', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('select:has(option[value="__new_schedule__"])').first();
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

  const fileSelect = page.locator('select:has(option[value="__new_schedule__"])').first();
  await fileSelect.selectOption('joe');

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(fileSelect).toHaveValue('default');
  await expect.poll(() => scheduleDeletes.some((path) => path.endsWith('/joe-s-schedule.md'))).toBeTruthy();
});

test('schedule editor can set default schedule used as fallback selection', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('select:has(option[value="__new_schedule__"])').first();
  await fileSelect.selectOption('joe');
  await page.getByRole('button', { name: 'Default' }).click();

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

  const readSelect = page.locator('select:has(option[value="default"])').first();
  await expect(readSelect).toHaveValue('joe');
});
