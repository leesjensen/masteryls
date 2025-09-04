import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToCourse } from './testInit';

test('editor enabled', async ({ page }) => {});

async function initWithEditingRights({ page }) {
  await initBasicCourse({ page });

  await page.route(/.*\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        await route.fulfill({ status: 201 });
        break;
      case 'GET':
        await route.fulfill({
          json: [
            {
              id: '50a0dcd2-2b5a-4c4a-b5c3-0751c874d6f5',
              catalogId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
              learnerId: '15cb92ef-d2d0-4080-8770-999516448960',
              ui: {
                tocIndexes: [0],
                currentTopic: 'https://raw.githubusercontent.com/devops329/devops/main/instruction/awsAccount/awsAccount.md',
                sidebarVisible: true,
                token: 'xyz',
              },
              progress: {
                mastery: 0,
              },
            },
          ],
        });
        break;
      case 'DELETE':
        await route.fulfill({ status: 204 });
        break;
    }
  });
}

test('editor markdown', async ({ page }) => {
  await initWithEditingRights({ page });
  await navigateToCourse(page);

  await page.getByRole('button', { name: '✏️' }).click();
  await expect(page.getByRole('textbox')).toContainText('# Home markdown!');

  await expect(page.getByRole('button', { name: 'README.md markdown • 2.6 KB' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).click();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).toBeChecked();
});

test('settings', async ({ page }) => {
  await initWithEditingRights({ page });
  await navigateToCourse(page);

  await page.getByText('Settings').click();
  await expect(page.getByRole('textbox', { name: 'Enter schedule URL' })).toHaveValue('schedule/schedule.md');
});

test('settings editing', async ({ page }) => {
  await initWithEditingRights({ page });
  await navigateToCourse(page);

  await page.getByRole('button', { name: '✏️' }).click();
  await page.getByText('Settings').click();

  await expect(page.getByRole('textbox', { name: 'Enter schedule URL' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();

  let dialogDisplayed = false;
  page.once('dialog', (dialog) => {
    dialogDisplayed = true;
    dialog.dismiss().catch(() => {});
  });
  await page.getByRole('button', { name: 'Save Changes' }).click();

  expect(dialogDisplayed).toBe(true);
});
