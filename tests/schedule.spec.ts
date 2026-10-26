import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

function scheduleCourseOverride() {
  return {
    schedule: {
      id: 'a7db85a9-da40-4623-bce2-b99162b416f9',
      files: [
        { id: 'default', title: 'Winter', path: 'instruction/schedule/schedule.md', default: true, state: 'published' },
        { id: 'joe', title: "Joe's schedule", path: 'instruction/schedule/joe-s-schedule.md', default: false, state: 'published' },
      ],
    },
    modules: [
      {
        title: 'Module 1',
        topics: [{ id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', title: 'Home', path: 'README.md' }],
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

  context.route(/https:\/\/raw\.githubusercontent\.com\/.*\/(instruction\/schedule|schedule)\/.*\.md$/, async (route: any) => {
    const url = route.request().url();
    const match = url.match(/\/(?:main|[A-Za-z0-9._-]+)\/((?:instruction\/schedule|schedule)\/[^?]+)/);
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

  context.route(/https:\/\/api\.github\.com\/repos\/ghAccount\/ghRepo\/contents\/(instruction\/schedule|schedule)\/.*\.md$/, async (route: any) => {
    const method = route.request().method();
    const url = route.request().url();
    const match = url.match(/\/contents\/((?:instruction\/schedule|schedule)\/[^?]+)/);
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
  await expect(page.locator('header h1')).toContainText('Rocket Science');
  await expect(page.locator('header h1')).toContainText('Winter');

  await page.locator('select').first().selectOption('joe');
  await expect(page.locator('.markdown-body').getByRole('heading', { name: "Joe's schedule" })).toBeVisible();
  await expect(page.locator('header h1')).toContainText("Joe's schedule");
});

test('schedule read view marks rows whose dates have passed', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { markdownByRepoPath } = installScheduleRoutes(page);

  markdownByRepoPath.set(
    'instruction/schedule/schedule.md',
    `# Date Status Schedule

| Week | Date | Module | Due | Topics Covered | Slides |
| :--: | ---- | ------ | --- | -------------- | ------ |
|  1   | Mon Jan 3 2000 | Past module | | [Old topic](../instruction/introduction.md) | |
|  2   | Mon Jan 3 2999 | Future module | | [Future topic](../instruction/introduction.md) | |
`,
  );

  await navigateToCourse(page);
  await page.getByText('Schedule').click();

  const pastRow = page.locator('.markdown-body table tbody tr').filter({ hasText: 'Past module' });
  const futureRow = page.locator('.markdown-body table tbody tr').filter({ hasText: 'Future module' });

  await expect(pastRow).toHaveAttribute('data-schedule-date-status', 'past');
  await expect(pastRow).toHaveClass(/schedule-row-past/);
  // The only future row is also the nearest upcoming one, so it's promoted to "next".
  await expect(futureRow).toHaveAttribute('data-schedule-date-status', 'next');
  await expect(futureRow).toHaveClass(/schedule-row-next/);
});

test('a stale in-flight schedule fetch cannot silently overwrite a newer explicit selection', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  installScheduleRoutes(page);

  let releaseWinterFetch: () => void = () => {};
  const winterFetchGate = new Promise<void>((resolve) => {
    releaseWinterFetch = resolve;
  });

  // Hold the default ("Winter") schedule's markdown response open. This simulates a slow
  // network response for whichever request - the page's own initial fetch, or the sidebar's
  // background due-date sync (contents.jsx), both of which read "the selected schedule" on
  // mount - is still in flight when the learner picks a different schedule from the
  // dropdown. Registered after installScheduleRoutes so it takes priority (Playwright runs
  // routes in reverse registration order).
  await page.context().route('https://raw.githubusercontent.com/**/instruction/schedule/schedule.md', async (route) => {
    await winterFetchGate;
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: '# Winter 2026 Schedule\n\n| Week | Date | Module | Due | Topics Covered | Slides |\n| :--: | ---- | ------ | --- | -------------- | ------ |\n|  1   | Thu Jan 8 | Intro | | [Introduction](../instruction/introduction.md) | |\n\n## Special days\n\n- Jan 7: First day of class\n',
    });
  });

  await navigateToCourse(page);
  await page.getByText('Schedule').click();

  // The dropdown's file list is computed synchronously, so it's already usable even while
  // the default schedule's content fetch is stuck.
  const fileSelect = page.locator('select').first();
  await expect(fileSelect).toBeVisible();
  await fileSelect.selectOption('joe');
  await expect(page.locator('.markdown-body').getByRole('heading', { name: "Joe's schedule" })).toBeVisible();

  // Now let the stale Winter fetch(es) resolve, well after the explicit "joe" selection.
  releaseWinterFetch();
  await page.waitForTimeout(300);

  // The learner's explicit selection must survive - both visibly right now (the rendered
  // schedule content, not just the dropdown/breadcrumb), and persisted so a refresh still
  // shows it. This is what previously regressed: the late-resolving stale request would
  // silently rewrite the displayed content (and/or the persisted selection) back to the
  // default, even while the dropdown kept showing the correct selection.
  await expect(page.locator('.markdown-body').getByRole('heading', { name: "Joe's schedule" })).toBeVisible();
  await page.reload();
  await expect(page.locator('.markdown-body').getByRole('heading', { name: "Joe's schedule" })).toBeVisible();
  await expect(page.locator('select').first()).toHaveValue('joe');
});

test('schedule table keeps its header row locked while scrolling', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();

  // The schedule table wrapper opts out of overflow clipping so the sticky
  // header can pin against the reading-pane scroll container.
  const wrapper = page.locator('.markdown-table-scroll--sticky-head');
  await expect(wrapper).toBeVisible();

  const headerCell = wrapper.locator('thead th').first();
  await expect(headerCell).toHaveCSS('position', 'sticky');

  // Schedules drop the centered 880px reading-column cap so the table fills the
  // full width and wide screens avoid horizontal scrolling.
  const body = page.locator('[data-editor-preview-scroll-container] .markdown-body');
  await expect(body).toHaveCSS('max-width', 'none');
});

test('schedule form editor commits content edits', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  const { schedulePuts } = installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible();

  // Edit the actual schedule content (a module name). The editor no longer edits the title -
  // that lives in the Terms & Sections view - so the H1 round-trips unchanged on commit.
  const moduleInput = page.getByPlaceholder('Module').first();
  await moduleInput.fill('Edited Module');

  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Discard' })).toBeDisabled();

  await expect.poll(() => schedulePuts.length).toBeGreaterThan(0);
  const latest = schedulePuts[schedulePuts.length - 1];
  expect(latest.path).toContain('instruction/schedule/');
  expect(latest.markdown).toContain('Edited Module');
  // The schedule name lives in the DB now, so no `# ` title heading is written to the markdown.
  expect(latest.markdown).not.toMatch(/^#\s+/m);
});

test('adding a schedule creates schedule template markdown and course schedule metadata', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: { schedule: undefined } });
  const { schedulePuts, courseJsonPuts } = installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.locator('.absolute.left-0\\.5').click();

  await page.getByText('+ Create schedule').click();

  await expect.poll(() => schedulePuts.some((entry) => entry.path.endsWith('schedule/schedule.md'))).toBeTruthy();

  const createdScheduleMd = [...schedulePuts].reverse().find((entry) => entry.path.endsWith('schedule/schedule.md'));
  expect(createdScheduleMd?.markdown || '').not.toMatch(/^#\s+/m);
  expect(createdScheduleMd?.markdown || '').toContain('| Week | Date | Module | Due | Topics Covered | Slides |');

  await expect.poll(() => courseJsonPuts.length).toBeGreaterThan(0);
  const latestCourseJson = courseJsonPuts[courseJsonPuts.length - 1];

  expect(latestCourseJson.schedule).toBeTruthy();
  expect(Array.isArray(latestCourseJson.schedule.files)).toBeTruthy();
  expect(latestCourseJson.schedule.files).toHaveLength(1);
  expect(latestCourseJson.schedule.files[0].title).toBe('Schedule');
  expect(latestCourseJson.schedule.files[0].path).toBe('schedule/schedule.md');
  expect(latestCourseJson.schedule.files[0].default).toBe(true);
  expect(latestCourseJson.schedule.files[0].id).toMatch(/^[0-9a-f-]{36}$/i);
});

test('schedule editor confirms before switching files with unsaved changes', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: scheduleCourseOverride() });
  installScheduleRoutes(page);

  await navigateToCourse(page);
  await page.getByText('Schedule').click();
  await page.locator('.absolute.left-0\\.5').click();

  const fileSelect = page.locator('select:has(option[value="joe"])').first();
  await expect(fileSelect).toHaveValue('default');

  // Make a schedule-content edit (the editor no longer edits title/dates - those live in the
  // Terms & Sections view - so dirty state comes from the actual schedule, e.g. a module name).
  const moduleInput = page.getByPlaceholder('Module').first();
  await expect(moduleInput).toHaveValue('Intro');
  await moduleInput.fill('Unsaved Module Change');

  await fileSelect.selectOption('joe');
  await page.locator('dialog:has-text("Discard unsaved schedule changes")').getByRole('button', { name: 'Cancel' }).click();

  await expect(fileSelect).toHaveValue('default');
  await expect(moduleInput).toHaveValue('Unsaved Module Change');

  await fileSelect.selectOption('joe');
  await page.locator('dialog:has-text("Discard unsaved schedule changes")').getByRole('button', { name: 'Discard', exact: true }).click();

  await expect(fileSelect).toHaveValue('joe');
  await expect(moduleInput).toHaveValue('Intro');
});

