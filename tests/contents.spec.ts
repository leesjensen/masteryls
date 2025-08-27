import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToCourse } from './testInit';

test('toc toggling', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await expect(page.getByText('topic 1')).toBeVisible();
  await expect(page.getByText('topic 2')).not.toBeVisible();
  await page.getByRole('button', { name: '▶ Module 2' }).click();
  await expect(page.getByText('topic 2')).toBeVisible();
  await page.getByRole('button', { name: '▼ Module 1' }).click();
  await expect(page.getByText('topic 1')).not.toBeVisible();
});

test('settings', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await page.getByText('Settings').click();
  await expect(page.getByRole('complementary')).toContainText('schedule/schedule.md');
});

test('settings editing', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await page.getByRole('button', { name: '✏️' }).click();
  await page.getByText('Settings').click();

  await expect(page.getByRole('textbox', { name: 'Enter schedule URL' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();

  let dialogDisplayed = false;
  page.once('dialog', (dialog) => {
    dialogDisplayed = true;
    console.log(`Dialog message: ${dialog.message()}`);
    dialog.dismiss().catch(() => {});
  });
  await page.getByRole('button', { name: 'Save Changes' }).click();

  expect(dialogDisplayed).toBe(true);
});
