import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToCourse } from './testInit';

test('editor enabled', async ({ page }) => {});

// test('editor markdown', async ({ page }) => {
//   await initBasicCourse({ page });
//   await navigateToCourse(page);

//   await page.getByRole('button', { name: '✏️' }).click();
//   await expect(page.getByRole('textbox')).toContainText('# Home markdown!');

//   await expect(page.getByRole('button', { name: 'README.md markdown • 2.6 KB' })).toBeVisible();
//   await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).not.toBeChecked();
//   await page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).click();
//   await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).toBeChecked();
// });

// test('settings', async ({ page }) => {
//   await initBasicCourse({ page });
//   await navigateToCourse(page);

//   await page.getByText('Settings').click();
//   await expect(page.getByRole('textbox', { name: 'Enter schedule URL' })).toHaveValue('schedule/schedule.md');
// });

// test('settings editing', async ({ page }) => {
//   await initBasicCourse({ page });
//   await navigateToCourse(page);

//   await page.getByRole('button', { name: '✏️' }).click();
//   await page.getByText('Settings').click();

//   await expect(page.getByRole('textbox', { name: 'Enter schedule URL' })).toBeVisible();

//   await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();

//   let dialogDisplayed = false;
//   page.once('dialog', (dialog) => {
//     dialogDisplayed = true;
//     dialog.dismiss().catch(() => {});
//   });
//   await page.getByRole('button', { name: 'Save Changes' }).click();

//   expect(dialogDisplayed).toBe(true);
// });
