import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToCourse } from './testInit';

async function initAndOpenBasicCourse({ page }) {
  await initBasicCourse({ page });
  await navigateToCourse(page);
}

test('editor markdown', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.getByRole('button', { name: '✏️' }).click();
  await expect(page.getByRole('code')).toContainText('# Home');
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).click();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).toBeChecked();
});

test('editor commit', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.getByRole('button', { name: '✏️' }).click();
  await expect(page.getByRole('code')).toContainText('# Home');

  await page.getByText('# Home').click();
  await page.getByRole('textbox', { name: 'Editor content' }).press('End');
  await page.getByRole('textbox', { name: 'Editor content' }).fill('\n# Home altered!');
  // await page.getByRole('textbox').fill('# Home\n\naltered!');
  await expect(page.getByRole('code')).toContainText('altered!');

  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeDisabled();
});

test('settings', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.getByText('Settings').click();
  await expect(page.getByRole('textbox', { name: 'Course Title' })).toHaveValue('Rocket Science');
});

test('settings editing', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.getByRole('button', { name: '✏️' }).click();
  await page.getByText('Settings').click();

  await expect(page.getByRole('textbox', { name: 'Course Title' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Enter course title' }).click();
  await page.getByRole('textbox', { name: 'Enter course title' }).fill('Rocket Sciencex');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Settings saved')).toBeVisible();
});
