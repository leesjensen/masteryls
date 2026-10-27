import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

// The classroom toolbar's navigation icons render as real anchors (not plain buttons) so the
// browser offers "Open in new tab/window" on a right/modifier-click, matching the TOC sidebar
// links. A plain left-click still navigates inside the app.
test('classroom toolbar navigation icons are links with hrefs and still navigate on a plain click', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);
  await page.getByText('topic 1').click();

  // MasteryView: an in-app anchor pointing at the in-course mastery route (rendered in the content pane).
  await expect(page.getByRole('link', { name: 'MasteryView' })).toHaveAttribute('href', /\/course\/[^/]+\/mastery$/);

  // GitHub: an external anchor that opens the repo in a new tab.
  const github = page.getByRole('link', { name: 'GitHub repository' });
  await expect(github).toHaveAttribute('target', '_blank');
  await expect(github).toHaveAttribute('href', /github\.com/i);

  // Next topic: an in-app anchor to the adjacent topic whose plain click navigates in-app.
  const next = page.getByRole('link', { name: 'Next topic' });
  await expect(next).toHaveAttribute('href', /\/course\/.*\/topic\/[0-9a-f-]+$/);
  // A plain click navigates in-app to a different topic (rather than opening a new tab).
  const beforeUrl = page.url();
  await next.click();
  await expect(page).toHaveURL(/\/course\/.*\/topic\/[0-9a-f-]+$/);
  expect(page.url()).not.toBe(beforeUrl);
});
