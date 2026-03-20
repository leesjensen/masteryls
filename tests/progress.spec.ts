import { test, expect } from './fixtures';
import { initBasicCourse, navigateToProgress } from './testInit';

test('progress', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToProgress(page);

  await expect(page.locator('tbody')).toContainText('12/5/2025, 10:13:00 AM');
  await expect(page.locator('tbody tr')).toHaveCount(5);

  await page.getByRole('button', { name: '▶' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(7);
});

test('progress filters apply and clear', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToProgress(page);

  const tableRows = page.locator('tbody tr');
  await expect(tableRows).toHaveCount(5);

  await page.getByRole('combobox').selectOption('["note"]');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByText('note', { exact: true })).toBeVisible();
  await expect(tableRows).toHaveCount(1);

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByRole('combobox').selectOption('[]');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(tableRows).toHaveCount(5);
});

test('progress sorting and topic navigation', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToProgress(page);

  await page.getByRole('columnheader', { name: /Activity Type/ }).click();
  await expect(page.getByRole('columnheader', { name: /Activity Type/ })).toContainText('↑');

  await page.getByRole('columnheader', { name: /Activity Type/ }).click();
  await expect(page.getByRole('columnheader', { name: /Activity Type/ })).toContainText('↓');

  await page.getByRole('button', { name: 'Go to Topic' }).first().click();
  await expect(page).toHaveURL(/\/course\/14602d77-0ff3-4267-b25e-4a7c3c47848b\/topic\//);
});
