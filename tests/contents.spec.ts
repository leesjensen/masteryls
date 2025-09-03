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
