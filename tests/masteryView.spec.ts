import { test, expect } from './fixtures';
import { initBasicCourse, navigateToDashboard } from './testInit';

const LEARNER_ID = '15cb92ef-d2d0-4080-8770-999516448960';
const KYLE_LEARNER_ID = '34df7526-484c-41d9-b905-7a4d0d92c14c';
const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';

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
    const courseId = String(payload?.courseId || '');
    const search = String(payload?.search || '').toLowerCase();
    const learnerId = String(payload?.learnerId || '');
    const allRows = [
      {
        enrollmentId: `enroll-${courseId}`,
        learnerId: LEARNER_ID,
        learnerName: 'Bud',
        learnerEmail: 'bud@cow.com',
        masteryPercent: 85,
        completedTopics: 4,
        examCompletedCount: 1,
        projectSubmittedCount: 2,
        lastActivityAt: '2026-05-09T12:00:00Z',
        totalTimeSpent: 148,
        progress: {},
      },
      {
        enrollmentId: `enroll-kyle-${courseId}`,
        learnerId: KYLE_LEARNER_ID,
        learnerName: 'Kyle Robinson',
        learnerEmail: 'krobin37@byu.edu',
        masteryPercent: 42,
        completedTopics: 6,
        examCompletedCount: 0,
        projectSubmittedCount: 1,
        lastActivityAt: '2026-05-12T12:00:00Z',
        totalTimeSpent: 3600,
        progress: {},
      },
    ];
    const rows = learnerId
      ? allRows.filter((row) => row.learnerId === learnerId)
      : search
        ? allRows.filter((row) => row.learnerName.toLowerCase().includes(search) || row.learnerEmail.toLowerCase().includes(search))
        : allRows.slice(0, 1);

    await route.fulfill({
      status: 200,
      json: {
        rows,
        totalCount: search || learnerId ? rows.length : 102,
        page: Number(payload?.page || 1),
        limit: Number(payload?.limit || 50),
        hasMore: false,
      },
    });
  }).then(() => requests);
}

// Builds a two-page dataset (60 rows; the view always requests limit 50). The globally
// alphabetically-first learner ("Aaron Aardvark") is placed LAST so that, in default order,
// it lands on page 2 - letting a test prove that sorting reorders the whole dataset rather
// than just the rows already on the current page.
function buildSortableRows() {
  const rows: any[] = [];
  const makeRow = (i: number, name: string, email: string, mastery: number) => ({
    enrollmentId: `enroll-${i}`,
    learnerId: `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`,
    learnerName: name,
    learnerEmail: email,
    masteryPercent: mastery,
    completedTopics: i,
    examCompletedCount: 0,
    projectSubmittedCount: 0,
    lastActivityAt: '2026-05-09T12:00:00Z',
    totalTimeSpent: i * 10,
    progress: {},
  });

  rows.push(makeRow(0, 'Zelda Zimmerman', 'zelda@test.edu', 5));
  for (let i = 1; i <= 58; i++) {
    rows.push(makeRow(i, `Learner ${String(i).padStart(2, '0')}`, `learner${String(i).padStart(2, '0')}@test.edu`, 40 + (i % 20)));
  }
  rows.push(makeRow(59, 'Aaron Aardvark', 'aaron@test.edu', 99));
  return rows;
}

// Mirrors the masteryoverview edge function: sorts the FULL set, then paginates. This is the
// behavior under test - the client must delegate sorting to the server, not sort locally.
function compareSortableRows(a: any, b: any, key: string) {
  if (key === 'learnerName') return String(a.learnerName || '').trim().localeCompare(String(b.learnerName || '').trim());
  if (key === 'learnerEmail') return String(a.learnerEmail || '').trim().localeCompare(String(b.learnerEmail || '').trim());
  if (key === 'lastActivityAt') {
    const ad = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bd = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return ad - bd;
  }
  return Number(a[key] || 0) - Number(b[key] || 0);
}

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

    const limit = Number(payload?.limit || 50);
    const pageNum = Number(payload?.page || 1);
    const sortKey = payload?.sortKey;
    const direction = String(payload?.sortDirection || 'asc') === 'desc' ? -1 : 1;

    const ordered = sortKey ? [...allRows].sort((a, b) => compareSortableRows(a, b, sortKey) * direction) : allRows;
    const offset = (pageNum - 1) * limit;
    const pageRows = ordered.slice(offset, offset + limit);

    await route.fulfill({
      status: 200,
      json: {
        rows: pageRows,
        totalCount: allRows.length,
        page: pageNum,
        limit,
        hasMore: offset + limit < allRows.length,
      },
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

  // Default (unsorted) page 1 shows the default-first learner; the global alphabetical first
  // ("Aaron Aardvark") is on page 2, so it must NOT be visible yet.
  await expect(page.getByRole('cell', { name: 'Zelda Zimmerman', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Aaron Aardvark', exact: true })).toHaveCount(0);

  // Click the Learner header -> ascending by name. The server sorts the whole dataset, so the
  // page-2 learner is pulled to the top of page 1. A client-only page sort could never do this.
  await page.getByRole('button', { name: 'Learner' }).click();
  await expect.poll(() => overviewRequests.some((r) => r.sortKey === 'learnerName' && r.sortDirection === 'asc')).toBe(true);
  await expect(page.locator('tbody tr').first()).toContainText('Aaron Aardvark');
  await expect(page.getByRole('cell', { name: 'Zelda Zimmerman', exact: true })).toHaveCount(0);

  // Click again -> descending. The global last name now leads page 1.
  await page.getByRole('button', { name: 'Learner' }).click();
  await expect.poll(() => overviewRequests.some((r) => r.sortKey === 'learnerName' && r.sortDirection === 'desc')).toBe(true);
  await expect(page.locator('tbody tr').first()).toContainText('Zelda Zimmerman');
  await expect(page.getByRole('cell', { name: 'Aaron Aardvark', exact: true })).toHaveCount(0);
});

test('masteryview header click sends sort params to the server and resets to page one', async ({ page }) => {
  await initBasicCourse({ page });
  const overviewRequests = await mockSortableOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Zelda Zimmerman', exact: true })).toBeVisible();

  // Advance to page 2 so we can prove sorting snaps back to page 1.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect.poll(() => overviewRequests.some((r) => !r.sortKey && Number(r.page) === 2)).toBe(true);

  // Sorting by a numeric column must send that column's key and reset paging to page 1.
  await page.getByRole('button', { name: 'Mastery' }).click();
  await expect
    .poll(() => {
      const sorted = overviewRequests.filter((r) => r.sortKey === 'masteryPercent');
      return sorted.length > 0 && Number(sorted[sorted.length - 1].page) === 1;
    })
    .toBe(true);
});

test('masteryview loads learner overview for accessible course', async ({ page }) => {
  await initBasicCourse({ page });
  const overviewRequests = await mockGradebookOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  await expect(page.getByText('bud@cow.com')).toBeVisible();
  await expect(page.getByText('85%')).toBeVisible();

  await page.getByLabel('Filter learner').fill('kyle');
  await expect(page.getByRole('cell', { name: 'Kyle Robinson', exact: true })).toBeVisible();
  await expect(page.getByText('Matching learners: 1')).toBeVisible();
  await expect.poll(() => overviewRequests.some((request) => request.search === 'kyle')).toBe(true);

  // Navigate to learner gradebook
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
  await expect(page.getByRole('button', { name: 'Observe' })).toBeVisible();
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
});
