import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToProgress } from './testInit';

test('progress', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToProgress(page);

  await expect(page.locator('tbody')).toContainText('12/5/2025, 10:13:00 AM');
  await expect(page.locator('tbody tr')).toHaveCount(5);

  await page.getByRole('button', { name: '▶' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(7);
});
