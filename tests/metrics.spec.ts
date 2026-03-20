import { test, expect } from './fixtures';
import { initBasicCourse, navigateToMetrics } from './testInit';

test('metrics', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToMetrics(page);

  await expect(page.getByRole('main')).toContainText('Total Activities6');
  await page.getByText('Most Active Day2025-12-').click();
});

test('metrics date validation and presets', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToMetrics(page);

  const startDate = page.locator('#startDate');
  const endDate = page.locator('#endDate');

  await startDate.fill('2025-12-10');
  await endDate.fill('2025-12-01');
  await expect(page.getByText('Start date must be before end date')).toBeVisible();

  await page.getByRole('button', { name: 'This month' }).click();
  await expect(page.getByText('Start date must be before end date')).not.toBeVisible();

  await page.getByRole('button', { name: 'Yesterday' }).click();
  await expect(page.getByText('Showing data for:')).toBeVisible();

  await page.getByRole('button', { name: 'Last 24 hours' }).click();
  await expect(page.getByRole('main')).toContainText('Total Activities');
});

test('metrics user filter search and clear', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToMetrics(page);

  const userSearch = page.locator('#userSearch');
  await expect(userSearch).toBeVisible();

  await userSearch.fill('Bu');
  await expect(page.getByRole('button', { name: 'Bud bud@cow.com' })).toBeVisible();

  await page.getByRole('button', { name: 'Bud bud@cow.com' }).click();
  await expect(userSearch).toHaveValue('Bud');

  await page.getByTitle('Clear user filter').click();
  await expect(userSearch).toHaveValue('');
});
