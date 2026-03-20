import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

test('search returns results and can open a topic', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search...').fill('topic');
  await page.locator('form button[type="submit"]').click();

  await expect(page.getByText('matching topic')).toBeVisible();
  await expect(page.getByText('topic 1')).toBeVisible();

  await page.getByText('Result for topic').click();
  await expect(page).toHaveURL(/\/topic\/3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f$/);
});

test('search shows no-results and clear flow', async ({ page }) => {
  await initBasicCourse({ page, searchTopicsResults: [] });
  await navigateToCourse(page);

  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search...').fill('missing term');
  await page.locator('form button[type="submit"]').click();

  await expect(page.getByText('No results found')).toBeVisible();

  await page.locator('form button[type="button"]').click();
  await expect(page.getByPlaceholder('Search...')).toHaveValue('');
  await expect(page.getByText('No results found')).not.toBeVisible();
});

test('search shows error state', async ({ page }) => {
  await initBasicCourse({ page, searchTopicsError: true });
  await navigateToCourse(page);

  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search...').fill('topic');
  await page.locator('form button[type="submit"]').click();

  await expect(page.getByText('Failed to search. Try again later.')).toBeVisible();
});

test('code block renders copy button', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.resolve(),
      },
    });
  });

  await initBasicCourse({
    page,
    topicMarkdown: '```js\nconsole.log("copy me")\n```',
  });
  await navigateToCourse(page);

  await expect(page.getByTitle('Copy to clipboard')).toBeVisible();
});
