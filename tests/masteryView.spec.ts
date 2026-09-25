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
