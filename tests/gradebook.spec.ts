import { test, expect } from './fixtures';
import { initBasicCourse, navigateToDashboard } from './testInit';

const LEARNER_ID = '15cb92ef-d2d0-4080-8770-999516448960';
const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';

function mockGradebookOverview(page: any) {
  return page.route(/.*supabase.co\/functions\/v1\/gradebookoverview(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (route.request().method() !== 'POST') {
      throw new Error(`Unexpected gradebookoverview method ${route.request().method()}`);
    }

    const payload = await route.request().postDataJSON();
    const courseId = String(payload?.courseId || '');

    await route.fulfill({
      status: 200,
      json: {
        rows: [
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
        ],
        totalCount: 1,
        page: Number(payload?.page || 1),
        limit: Number(payload?.limit || 50),
        hasMore: false,
      },
    });
  });
}

test('gradebook view loads learner overview for accessible course', async ({ page }) => {
  await initBasicCourse({ page });
  await mockGradebookOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'Gradebook' }).click();

  await expect(page.getByRole('heading', { name: 'Course Gradebook' })).toBeVisible();
  await expect(page.getByText('bud@cow.com')).toBeVisible();
  await expect(page.getByText('85%')).toBeVisible();

  await page.getByLabel('Search learner').fill('bud');
  await expect(page.getByRole('cell', { name: 'Bud', exact: true })).toBeVisible();

  await page.getByRole('cell', { name: 'Bud', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Instruction Item' })).toBeVisible();
});

test('learner gradebook view shows learner summary and topic detail', async ({ page }) => {
  await initBasicCourse({ page });
  await mockGradebookOverview(page);

  await navigateToDashboard(page);
  await page.goto(`/gradebook/learner/${LEARNER_ID}/course/${COURSE_ID}`);

  await expect(page.getByText('bud@cow.com')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Instruction Item' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /search learner/i })).not.toBeVisible();
});
