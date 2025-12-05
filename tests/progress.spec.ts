import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToProgress } from './testInit';

test('progress', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToProgress(page);

  await expect(page.locator('tbody')).toContainText('12/5/2025, 4:17:55 PM');
  await expect(page.locator('tbody tr')).toHaveCount(5);

  await page.getByRole('combobox').selectOption('instructionView');

  await expect(page.locator('tbody tr')).toHaveCount(1);

  await page.getByRole('button', { name: '▶' }).click();

  await expect(page.locator('tbody tr')).toHaveCount(4);
});
