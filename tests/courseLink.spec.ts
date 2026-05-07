import { test, expect } from './fixtures';
import { initBasicCourse, navigateToDashboard } from './testInit';

async function openCourseLinking(page: any) {
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'Link course', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Link a Course' })).toBeVisible();
}

async function mockLinkRequests(page: any) {
  let nextModuleId = 1000;
  let nextPageId = 5000;

  // verifyGitHubAccount() checks this endpoint before linking.
  await page.route('https://api.github.com/user', async (route: any) => {
    await route.fulfill({ status: 200, json: { login: 'mock-user' } });
  });

  // Canvas API is invoked via Supabase Edge Function.
  await page.route(/.*supabase.co\/functions\/v1\/canvas(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (route.request().method() !== 'POST') {
      throw new Error(`Unmocked canvas endpoint requested: ${route.request().url()} ${route.request().method()}`);
    }

    const body = await route.request().postDataJSON();
    const endpoint = body?.endpoint as string;
    const method = body?.method as string;

    if (method === 'POST' && endpoint?.match(/^\/courses\/\d+\/modules$/)) {
      nextModuleId += 1;
      await route.fulfill({ status: 200, json: { id: nextModuleId } });
      return;
    }

    if (method === 'POST' && endpoint?.match(/^\/courses\/\d+\/pages$/)) {
      nextPageId += 1;
      await route.fulfill({ status: 200, json: { page_id: nextPageId, url: `page-${nextPageId}`, title: `Page ${nextPageId}` } });
      return;
    }

    if (method === 'POST' && endpoint?.match(/^\/courses\/\d+\/modules\/\d+\/items$/)) {
      await route.fulfill({ status: 200, json: { id: 1 } });
      return;
    }

    if (method === 'PUT' && endpoint?.match(/^\/courses\/\d+\/modules\/\d+$/)) {
      await route.fulfill({ status: 200, json: { id: 1, published: true } });
      return;
    }

    if (method === 'PUT' && endpoint?.match(/^\/courses\/\d+\/pages\/\d+$/)) {
      await route.fulfill({ status: 200, json: { id: 1, published: true } });
      return;
    }

    throw new Error(`Unhandled canvas invoke payload: ${JSON.stringify(body)}`);
  });
}

test('course link form renders and validates required fields', async ({ page }) => {
  await initBasicCourse({ page });

  await navigateToDashboard(page);
  await openCourseLinking(page);

  const linkButton = page.getByRole('button', { name: 'Link course', exact: true });
  const unlinkButton = page.getByRole('button', { name: 'Unlink course' });
  const repairButton = page.getByRole('button', { name: 'Repair' });
  const viewCanvasButton = page.getByRole('button', { name: 'View Canvas' });
  const viewCourseButton = page.getByRole('button', { name: 'View Course' });

  await expect(linkButton).toBeDisabled();
  await expect(unlinkButton).toBeDisabled();
  await expect(repairButton).toBeDisabled();
  await expect(viewCanvasButton).toBeDisabled();
  await expect(viewCourseButton).toBeDisabled();

  await page.getByLabel('Course', { exact: true }).selectOption('14602d77-0ff3-4267-b25e-4a7c3c47848b');
  await page.waitForTimeout(300);
  await page.getByLabel('Canvas course ID', { exact: true }).fill('12345');

  await expect(page.getByLabel('Course', { exact: true })).toHaveValue('14602d77-0ff3-4267-b25e-4a7c3c47848b');
  await expect(page.getByLabel('Canvas course ID', { exact: true })).toHaveValue('12345');
});

test('course link performs successful link flow', async ({ page }) => {
  await initBasicCourse({ page });
  await mockLinkRequests(page);

  await navigateToDashboard(page);
  await openCourseLinking(page);

  await page.getByLabel('Course', { exact: true }).selectOption('14602d77-0ff3-4267-b25e-4a7c3c47848b');
  await page.waitForTimeout(300);
  await page.getByLabel('Canvas course ID', { exact: true }).fill('12345');
  await expect(page.getByRole('button', { name: 'Link course', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Link course', exact: true }).click();

  await expect(page.locator('#root')).toContainText('Rocket Science linked successfully');
});
