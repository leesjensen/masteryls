import { test, expect } from './fixtures';
import { initBasicCourse, navigateToDashboard } from './testInit';

const LEARNER_ID = '15cb92ef-d2d0-4080-8770-999516448960';
const KYLE_LEARNER_ID = '34df7526-484c-41d9-b905-7a4d0d92c14c';
const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';

// The edge function returns identity + progress (trimmed for the list, full for a single learner)
// and does no sorting/search/pagination - the client derives metrics and does all of that locally.
function mockGradebookOverview(page: any) {
  const requests: any[] = [];
  return page.route(/.*supabase.co\/functions\/v1\/masteryoverview(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (route.request().method() !== 'POST') {
      throw new Error(`Unexpected masteryoverview method ${route.request().method()}`);
    }

    const payload = await route.request().postDataJSON();
    requests.push(payload);
    const learnerId = String(payload?.learnerId || '');
    const allRows = [
      {
        enrollmentId: 'enroll-bud',
        learnerId: LEARNER_ID,
        learnerName: 'Bud',
        learnerEmail: 'bud@cow.com',
        progress: { 'topic-a': { completedCount: 0, timeSpent: 100 }, 'topic-b': { completedCount: 0, timeSpent: 48, examCompleted: true } },
      },
      {
        enrollmentId: 'enroll-kyle',
        learnerId: KYLE_LEARNER_ID,
        learnerName: 'Kyle Robinson',
        learnerEmail: 'krobin37@byu.edu',
        progress: {},
      },
    ];
    const rows = learnerId ? allRows.filter((row) => row.learnerId === learnerId) : allRows;

    await route.fulfill({
      status: 200,
      json: { rows, totalCount: rows.length },
    });
  }).then(() => requests);
}

// Builds a two-page dataset (60 rows; the view paginates locally at 50/page). The globally
// alphabetically-first learner ("Aaron Aardvark") is placed LAST, and also given the globally
// SMALLEST time-spent, so that in default order it lands on page 2 - letting a test prove that
// sorting reorders the whole dataset rather than just the rows already on the current page.
// Each row carries a progress blob so the client derives a distinct Time Spent (course-independent).
function buildSortableRows() {
  const rows: any[] = [];
  const makeRow = (i: number, name: string, email: string, timeSpent: number) => ({
    enrollmentId: `enroll-${i}`,
    learnerId: `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`,
    learnerName: name,
    learnerEmail: email,
    progress: { 'topic-a': { completedCount: 0, timeSpent } },
  });

  rows.push(makeRow(0, 'Zelda Zimmerman', 'zelda@test.edu', 1000));
  for (let i = 1; i <= 58; i++) {
    rows.push(makeRow(i, `Learner ${String(i).padStart(2, '0')}`, `learner${String(i).padStart(2, '0')}@test.edu`, 1000 + i));
  }
  // Aaron: alphabetically first AND smallest time-spent, but last in default order (page 2).
  rows.push(makeRow(59, 'Aaron Aardvark', 'aaron@test.edu', 1));
  return rows;
}

// The edge function returns the whole roster unsorted/unpaginated; the client does both locally.
function mockSortableOverview(page: any) {
  const requests: any[] = [];
  const allRows = buildSortableRows();
  return page.route(/.*supabase.co\/functions\/v1\/masteryoverview(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    if (route.request().method() !== 'POST') {
      throw new Error(`Unexpected masteryoverview method ${route.request().method()}`);
    }

    const payload = await route.request().postDataJSON();
    requests.push(payload);

    await route.fulfill({
      status: 200,
      json: { rows: allRows, totalCount: allRows.length },
    });
  }).then(() => requests);
}

test('masteryview sorts across the full dataset, not just the current page', async ({ page }) => {
  await initBasicCourse({ page });
  const overviewRequests = await mockSortableOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();

  // The whole roster is fetched in a single request; sorting and paging never fetch again.
  await expect.poll(() => overviewRequests.length).toBe(1);

  // Default (unsorted) page 1 shows the default-first learner; the global alphabetical first
  // ("Aaron Aardvark") is on page 2, so it must NOT be visible yet.
  await expect(page.getByRole('cell', { name: 'Zelda Zimmerman', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Aaron Aardvark', exact: true })).toHaveCount(0);

  // Click the Learner header -> ascending by name. The client sorts the whole dataset it holds,
  // so the page-2 learner is pulled to the top of page 1. A current-page-only sort could not.
  await page.getByRole('button', { name: 'Learner' }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Aaron Aardvark');
  await expect(page.getByRole('cell', { name: 'Zelda Zimmerman', exact: true })).toHaveCount(0);

  // Click again -> descending. The global last name now leads page 1.
  await page.getByRole('button', { name: 'Learner' }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Zelda Zimmerman');
  await expect(page.getByRole('cell', { name: 'Aaron Aardvark', exact: true })).toHaveCount(0);

  // Still just the one fetch after all that sorting.
  await expect.poll(() => overviewRequests.length).toBe(1);
});

test('masteryview numeric sort spans all pages and resets to page one', async ({ page }) => {
  await initBasicCourse({ page });
  await mockSortableOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Zelda Zimmerman', exact: true })).toBeVisible();

  // Pagination controls appear both above and below the list.
  await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(2);

  // Advance to page 2 so we can prove sorting snaps back to page 1 (either Next button works).
  await page.getByRole('button', { name: 'Next' }).first().click();
  await expect(page.getByText('Page 2').first()).toBeVisible();

  // Ascending Time Spent: Aaron has the globally smallest time (and sits on page 2 by default),
  // so sorting pulls it to the top of page 1 - and paging resets to page 1.
  await page.getByRole('button', { name: 'Time Spent' }).click();
  await expect(page.getByText('Page 1').first()).toBeVisible();
  await expect(page.locator('tbody tr').first()).toContainText('Aaron Aardvark');
});

// Three learners enrolled on distinct dates; the mock emulates the edge function's server-side
// createdAt window by filtering on the startDate/endDate the client sends.
function mockCohortOverview(page: any) {
  const requests: any[] = [];
  return page.route(/.*supabase.co\/functions\/v1\/masteryoverview(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    const payload = await route.request().postDataJSON();
    requests.push(payload);
    const allRows = [
      { enrollmentId: 'e-early', learnerId: 'l-early', learnerName: 'Early Learner', learnerEmail: 'early@test.edu', createdAt: '2026-01-10T12:00:00Z', progress: {} },
      { enrollmentId: 'e-mid', learnerId: 'l-mid', learnerName: 'Mid Learner', learnerEmail: 'mid@test.edu', createdAt: '2026-03-15T12:00:00Z', progress: {} },
      { enrollmentId: 'e-late', learnerId: 'l-late', learnerName: 'Late Learner', learnerEmail: 'late@test.edu', createdAt: '2026-06-20T12:00:00Z', progress: {} },
    ];
    let rows = allRows;
    if (payload?.startDate) rows = rows.filter((r) => r.createdAt >= payload.startDate);
    if (payload?.endDate) rows = rows.filter((r) => r.createdAt <= payload.endDate);
    await route.fulfill({ status: 200, json: { rows, totalCount: rows.length } });
  }).then(() => requests);
}

test('masteryview filters the roster by enrollment date range (server-side)', async ({ page }) => {
  await initBasicCourse({ page });
  const requests = await mockCohortOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  // The test course's schedule has no dates, so the window defaults to "all dates": everyone shows.
  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  await expect(page.getByText('Total learners: 3')).toBeVisible();

  // A March window: the server returns only the learner enrolled in March, and the client sends
  // the date bounds (refetch), rather than filtering locally.
  await page.getByLabel('Enrolled start date').fill('2026-03-01');
  await page.getByLabel('Enrolled end date').fill('2026-04-01');
  await expect(page.getByText('Total learners: 1')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Mid Learner', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Early Learner', exact: true })).toHaveCount(0);
  await expect.poll(() => requests.some((r) => r.startDate && r.endDate)).toBe(true);

  // Clearing the range refetches the whole roster.
  await page.getByRole('button', { name: 'All dates' }).click();
  await expect(page.getByText('Total learners: 3')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Late Learner', exact: true })).toBeVisible();
});

test('masteryview schedule dropdown drives the enrolled-between window', async ({ page }) => {
  await initBasicCourse({ page });
  await mockCohortOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  // The schedule picker defaults to the course's default schedule file ("Schedule").
  await expect(page.getByLabel('Schedule')).toHaveValue('default');
  // Editing a date detaches the window to "Custom".
  await page.getByLabel('Enrolled start date').fill('2026-03-01');
  await expect(page.getByLabel('Schedule')).toHaveValue('');
});

test('masteryview loads learner overview for accessible course', async ({ page }) => {
  await initBasicCourse({ page });
  const overviewRequests = await mockGradebookOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  // The whole roster arrives in one request; both learners are listed and counted locally.
  await expect(page.getByText('bud@cow.com')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Kyle Robinson', exact: true })).toBeVisible();
  await expect(page.getByText('Total learners: 2')).toBeVisible();

  // Filtering is client-side: no extra request, just a local filter + recount.
  await page.getByLabel('Filter learner').fill('kyle');
  await expect(page.getByRole('cell', { name: 'Kyle Robinson', exact: true })).toBeVisible();
  await expect(page.getByText('bud@cow.com')).toHaveCount(0);
  await expect(page.getByText('Matching learners: 1')).toBeVisible();
  await expect.poll(() => overviewRequests.filter((r) => !r.learnerId).length).toBe(1);

  // Navigate to learner gradebook (this issues the single-learner full-blob request).
  await page.getByRole('cell', { name: 'Kyle Robinson', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Instruction Item' })).toBeVisible();
});

test('mentor can view course mastery and observe learners without edit controls', async ({ page }) => {
  await initBasicCourse({ page });
  await page.context().route(/.*supabase.co\/rest\/v1\/role(\?.+)?/, async (route: any) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      json: [
        {
          user: LEARNER_ID,
          right: 'mentor',
          object: COURSE_ID,
          settings: {},
        },
      ],
    });
  });
  await mockGradebookOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Observe' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'User Menu' }).click();
  await expect(page.getByRole('button', { name: 'New course' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Link course' })).not.toBeVisible();
});

test('learner masteryview shows learner summary and topic detail', async ({ page }) => {
  await initBasicCourse({ page });
  await mockGradebookOverview(page);

  await navigateToDashboard(page);
  await page.goto(`/masteryview/learner/${LEARNER_ID}/course/${COURSE_ID}`);

  await expect(page.getByText('bud@cow.com')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Instruction Item' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /search learner/i })).not.toBeVisible();

  // An overseer can jump straight into observing this learner from the drill-down header.
  await expect(page.getByRole('button', { name: 'Observe' })).toBeVisible();
});
