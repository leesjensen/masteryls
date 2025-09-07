import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, register } from './testInit';
import { Enrollment } from '../src/model';

test('dashboard register error', async ({ page }) => {
  await page.route('*/**/auth/v1/signup', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          message: 'User already registered',
          status: 400,
        },
      }),
    });
  });

  await initBasicCourse({ page });

  const dialogPromise = page.waitForEvent('dialog');

  await register(page);

  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('Login failed. Please try again.');
  await dialog.dismiss();
});

test('dashboard join/leave courses', async ({ page }) => {
  let enrollments: Enrollment[] = [];
  await initBasicCourse({ page });

  await page.route(/.*\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        await route.fulfill({ status: 201 });
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

  await expect(page.getByRole('heading', { name: 'Join a course' })).toBeVisible();

  await expect(page.locator('#root')).toContainText('You are not enrolled in any courses. Select one below to get started.');
  await expect(page.locator('#root')).not.toContainText('0% complete');

  enrollments = [
    {
      id: '50a0dcd2-2b5a-4c4a-b5c3-0751c874d6f5',
      catalogId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
      learnerId: '15cb92ef-d2d0-4080-8770-999516448960',
      settings: {
        tocIndexes: [0, 1],
        currentTopic: 'https://raw.githubusercontent.com/devops329/devops/main/instruction/awsAccount/awsAccount.md',
        sidebarVisible: true,
      },
      progress: {
        mastery: 0,
      },
    },
  ];

  await page.getByRole('button', { name: 'Q QA & DevOps' }).click();
  await expect(page.getByRole('button', { name: 'Q QA & DevOps' })).toBeVisible();
  await expect(page.locator('#root')).toContainText('0% complete');

  enrollments = [];

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('#root')).not.toContainText('0% complete');
});

test('dashboard logout', async ({ page }) => {
  await initBasicCourse({ page });
  await register(page);

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('heading', { name: 'Mastery LS', exact: true })).toBeVisible();
});
