import { test, expect } from './fixtures';
import { initBasicCourse, register } from './testInit';
import { Enrollment } from '../src/model';

test('dashboard one time password error', async ({ page }) => {
  await page.route('**/auth/v1/verify', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'otp_expired', message: 'Token has expired or is invalid' }),
      });
      return;
    }
    throw new Error(`Unmocked endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  await initBasicCourse({ page });

  await register(page);

  await expect(page.locator('#root')).toContainText('Login failed. Please try again.');
});

test('dashboard join/leave course', async ({ page }) => {
  let enrollments: Enrollment[] = [];
  await initBasicCourse({ page });

  await page.route(/.*\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        await route.fulfill({ status: 201, json: enrollments.length > 0 ? enrollments[0] : {} });
        break;
      case 'GET':
        await route.fulfill({
          json: enrollments,
        });
        break;
      case 'DELETE':
        await route.fulfill({ status: 204 });
        break;
    }
  });

  await register(page);

  await expect(page.getByRole('heading', { name: 'Find a new course' })).toBeVisible();

  await expect(page.locator('#root')).toContainText('You are not enrolled in any courses');

  enrollments = [
    {
      id: '50a0dcd2-2b5a-4c4a-b5c3-0751c874d6f5',
      catalogId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
      learnerId: '15cb92ef-d2d0-4080-8770-999516448960',
      settings: {},
      progress: {
        mastery: 0,
      },
    },
  ];

  await page.getByRole('button', { name: 'R Rocket Science' }).click();
  // Enrolling converts the course card from a button into a link (courseCard.jsx), so wait
  // for the enrolled link to appear rather than racing the just-clicked button's removal.
  await expect(page.getByRole('link', { name: /Rocket Science/ })).toBeVisible();
  await expect(page.getByRole('link')).toContainText('Progress0%');

  enrollments = [];

  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('#root')).toContainText('You are not enrolled in any courses');
});

test('dashboard enroll prompts for a section when the course has more than one', async ({ page }) => {
  const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';
  let enrollments: Enrollment[] = [];
  const enrollPosts: any[] = [];
  await initBasicCourse({ page });

  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, async (route) => {
    await route.fulfill({
      json: [
        { id: 'b1111111-0000-4000-8000-000000000001', catalogId: COURSE_ID, title: 'Morning Section' },
        { id: 'b1111111-0000-4000-8000-000000000002', catalogId: COURSE_ID, title: 'Evening Section' },
      ],
    });
  });

  await page.route(/.*\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        enrollPosts.push(route.request().postDataJSON());
        await route.fulfill({ status: 201, json: enrollments.length > 0 ? enrollments[0] : {} });
        break;
      case 'GET':
        await route.fulfill({ json: enrollments });
        break;
      case 'DELETE':
        await route.fulfill({ status: 204 });
        break;
    }
  });

  await register(page);
  await expect(page.getByRole('heading', { name: 'Find a new course' })).toBeVisible();

  enrollments = [{ id: '50a0dcd2-2b5a-4c4a-b5c3-0751c874d6f5', catalogId: COURSE_ID, learnerId: '15cb92ef-d2d0-4080-8770-999516448960', settings: {}, progress: { mastery: 0 } }];

  await page.getByRole('button', { name: 'R Rocket Science' }).click();

  // The section picker appears for a multi-section course; pick the evening section and enroll.
  await expect(page.getByRole('heading', { name: 'Choose a section' })).toBeVisible();
  await page.locator('dialog').getByRole('combobox').selectOption({ label: 'Evening Section' });
  await page.getByRole('button', { name: 'Enroll', exact: true }).click();

  await expect(page.getByRole('link', { name: /Rocket Science/ })).toBeVisible();
  const lastPost = enrollPosts.at(-1);
  const row = Array.isArray(lastPost) ? lastPost[0] : lastPost;
  expect(row.sectionId).toBe('b1111111-0000-4000-8000-000000000002');
});

test('dashboard enroll offers only sections whose schedule is currently active', async ({ page }) => {
  const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';
  let enrollments: Enrollment[] = [];
  const enrollPosts: any[] = [];
  await initBasicCourse({ page });

  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, async (route) => {
    await route.fulfill({
      json: [
        { id: 'sec-active', catalogId: COURSE_ID, title: 'Active Section', scheduleId: 'sch-active' },
        { id: 'sec-past', catalogId: COURSE_ID, title: 'Past Section', scheduleId: 'sch-past' },
      ],
    });
  });
  await page.route(/.*supabase.co\/rest\/v1\/schedule(\?.+)?/, async (route) => {
    await route.fulfill({
      json: [
        { id: 'sch-active', catalogId: COURSE_ID, startDate: '2000-01-01', endDate: '2099-12-31' },
        { id: 'sch-past', catalogId: COURSE_ID, startDate: '2000-01-01', endDate: '2000-12-31' },
      ],
    });
  });
  await page.route(/.*\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        enrollPosts.push(route.request().postDataJSON());
        await route.fulfill({ status: 201, json: enrollments.length > 0 ? enrollments[0] : {} });
        break;
      case 'GET':
        await route.fulfill({ json: enrollments });
        break;
      case 'DELETE':
        await route.fulfill({ status: 204 });
        break;
    }
  });

  await register(page);
  await expect(page.getByRole('heading', { name: 'Find a new course' })).toBeVisible();
  enrollments = [{ id: '50a0dcd2-2b5a-4c4a-b5c3-0751c874d6f5', catalogId: COURSE_ID, learnerId: '15cb92ef-d2d0-4080-8770-999516448960', settings: {}, progress: { mastery: 0 } }];

  await page.getByRole('button', { name: 'R Rocket Science' }).click();

  // Only the active section is open, so no picker appears and the learner enrolls into it directly.
  await expect(page.getByRole('link', { name: /Rocket Science/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose a section' })).toHaveCount(0);
  const lastPost = enrollPosts.at(-1);
  const row = Array.isArray(lastPost) ? lastPost[0] : lastPost;
  expect(row.sectionId).toBe('sec-active');
});

test('dashboard logout', async ({ page }) => {
  await initBasicCourse({ page });
  await register(page);

  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page.getByRole('heading', { name: 'MasteryLS', exact: true })).toBeVisible();
});
