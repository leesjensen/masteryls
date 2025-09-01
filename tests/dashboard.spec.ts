import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, register } from './testInit';

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
  await initBasicCourse({ page });
  await register(page);

  await expect(page.getByRole('heading', { name: 'Join a course' })).toBeVisible();

  await expect(page.locator('#root')).toContainText('You are not enrolled in any courses. Select one below to get started.');
  await expect(page.locator('#root')).not.toContainText('0% complete');
  await page.getByRole('button', { name: 'Q QA & DevOps Description for' }).click();
  await expect(page.getByRole('button', { name: 'Q QA & DevOps Description for' })).toBeVisible();
  await expect(page.locator('#root')).toContainText('0% complete');
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('#root')).not.toContainText('0% complete');

  await page.getByRole('button', { name: 'Q QA & DevOps Description for' }).click();
  await page.getByRole('button', { name: 'S Software Construction' }).click();
  await page.getByRole('button', { name: 'W Web Programming Description' }).click();

  await expect(page.getByRole('heading', { name: 'Join a course' })).not.toBeVisible();
});

test('dashboard logout', async ({ page }) => {
  await initBasicCourse({ page });
  await register(page);

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('heading', { name: 'Mastery LS', exact: true })).toBeVisible();
});
