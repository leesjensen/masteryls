import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToMetrics } from './testInit';

test('metrics', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToMetrics(page);

  await expect(page.getByRole('main')).toContainText('Total Activities6');
  await page.getByText('Most Active Day2025-12-').click();
});
