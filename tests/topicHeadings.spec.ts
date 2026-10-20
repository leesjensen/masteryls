import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

// The TOC sidebar lists the currently-viewed topic's level-2 (##) headings indented under it,
// so a learner can jump around within the topic. (The default test topic markdown has the
// level-2 headings "Lists", "Emoji", and "Alert".)
test('TOC shows the current topic level-2 headings and jumps to a section', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);
  await page.getByText('topic 1').click();

  const toc = page.locator('#content');

  // The current topic's headings appear as in-topic anchor links in the TOC.
  const listsLink = toc.getByRole('link', { name: 'Lists', exact: true });
  await expect(listsLink).toHaveAttribute('href', /\/topic\/[0-9a-f-]+#lists$/);
  await expect(toc.getByRole('link', { name: 'Emoji', exact: true })).toBeVisible();
  await expect(toc.getByRole('link', { name: 'Alert', exact: true })).toBeVisible();

  // Clicking one jumps to that section — the URL hash becomes the heading slug.
  await toc.getByRole('link', { name: 'Alert', exact: true }).click();
  await expect(page).toHaveURL(/#alert$/);
});
