import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

// Guards the back-button fix: opening a bare /course/:id redirects to its canonical topic URL, and
// that redirect must REPLACE (not push). Otherwise the bare /course/:id stays in history, pressing
// back lands on it, it re-redirects to the topic, and the back button is trapped inside the course.
test('back from an opened course returns to the dashboard and stays there', async ({ page }) => {
  await initBasicCourse({ page });

  // Dashboard -> open a course. It lands on the canonical topic URL.
  await navigateToCourse(page);
  await expect(page).toHaveURL(/\/course\/[^/]+\/topic\/[^/]+/);

  // Back must land on the dashboard...
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);

  // ...and must not bounce back into the course a beat later (the trap the fix removes).
  await page.waitForTimeout(600);
  await expect(page).toHaveURL(/\/dashboard$/);
});
