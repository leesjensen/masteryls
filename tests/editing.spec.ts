import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

async function initAndOpenBasicCourse({ page }) {
  await initBasicCourse({ page });
  await navigateToCourse(page);
}

test('editor markdown', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await expect(page.getByRole('code')).toContainText('# Home');
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).click();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).toBeChecked();
});

test('editor commit', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
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

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  await expect(page.getByRole('textbox', { name: 'Course Title' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Enter course title' }).click();
  await page.getByRole('textbox', { name: 'Enter course title' }).fill('Rocket Sciencex');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Settings saved')).toBeVisible();
});

test('settings repair and state changes', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  const saveButton = page.getByRole('button', { name: 'Save changes' });
  await expect(saveButton).toBeDisabled();

  const courseTitleInput = page.getByRole('textbox', { name: 'Enter course title' });
  const currentTitle = await courseTitleInput.inputValue();
  await courseTitleInput.fill(`${currentTitle} ${Math.floor(Math.random() * 100000)}`);
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  await expect(page.getByText('Settings saved')).toBeVisible();
});

test('settings editor management requires at least one editor', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  await expect(page.getByText('2 editors assigned')).toBeVisible();
  await page.getByRole('button', { name: 'Manage editors' }).click();

  await expect(page.getByRole('heading', { name: 'Manage editors' })).toBeVisible();

  const userSearch = page.getByPlaceholder('Search by name or email');

  await userSearch.fill('bu');
  const addedButtons = page.getByRole('button', { name: 'Added' });
  await expect(addedButtons).toHaveCount(2);
  await addedButtons.nth(0).click();
  await addedButtons.nth(0).click();

  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('At least one editor must be selected')).toBeVisible();
});

test('settings delete dialog can be opened and canceled', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  await page.getByRole('button', { name: 'Delete course' }).click();
  await expect(page.getByRole('heading', { name: '⚠️ Delete course' })).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: '⚠️ Delete course' })).not.toBeVisible();
});

test('editor toolbar and files panel actions', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();

  await page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).click();
  await page.getByRole('button', { name: 'Insert' }).click();
  await expect(page.getByRole('button', { name: 'Insert' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' })).not.toBeVisible();

  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Image' }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Word Wrap: On' }).click();
  await expect(page.getByRole('button', { name: 'Word Wrap: Off' })).toBeVisible();
});

test('editor commits can be shown with diff and apply actions', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByRole('button', { name: 'Show Commits' }).click();

  await expect(page.getByText('Initial topic commit')).toBeVisible();
  await expect(page.getByText('Improve topic wording')).toBeVisible();

  await page.getByRole('button', { name: 'Diff' }).first().click();
  await expect(page.getByRole('button', { name: 'Diff' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Apply' }).first().click();
  await expect(page.getByRole('button', { name: 'Discard' })).toBeEnabled();

  await page.getByRole('button', { name: 'Hide Commits' }).click();
  await expect(page.getByText('Initial topic commit')).not.toBeVisible();
});
