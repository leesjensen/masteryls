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

test('search hit click scrolls the topic page to the matched content', async ({ page }) => {
  await initBasicCourse({
    page,
    topicMarkdown: `
# Home

Intro text.

${Array.from({ length: 20 }, (_, index) => `Paragraph ${index + 1}.`).join('\n\n')}

## Deep section

This paragraph contains the exact search target phrase learners want to jump to.
`,
    searchTopicsResults: [
      {
        topic: {
          id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
          title: 'Home',
        },
        headlines: ['This paragraph contains the exact <mark>search target phrase</mark> learners want to jump to.'],
      },
    ],
  });
  await navigateToCourse(page);

  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search...').fill('search target phrase');
  await page.locator('form button[type="submit"]').click();
  await page.getByText('This paragraph contains the exact').click();

  await expect(page).toHaveURL(/\/topic\/2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e$/);
  await expect(page.getByText('This paragraph contains the exact search target phrase learners want to jump to.')).toBeInViewport();
});

test('search terms highlight inside topic headings with note affordances', async ({ page }) => {
  await initBasicCourse({
    page,
    topicMarkdown: `
# Home

## Cutting your AWS bill

Some supporting text.
`,
    searchTopicsResults: [
      {
        id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
        headline: 'Search result: <mark>Cutting</mark> your AWS bill',
      },
    ],
  });
  await navigateToCourse(page);

  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search...').fill('cutting');
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('.border-l-2')).toHaveCount(1);
  await page.locator('.border-l-2').first().click();

  await expect(page).toHaveURL(/\/topic\/3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f$/);
  await expect(page.locator('h2 mark')).toContainText('Cutting');
});

test('search terms highlight inside interaction text', async ({ page }) => {
  await initBasicCourse({
    page,
    topicMarkdown: `
# Home

\`\`\`masteryls
{"id":"39283", "title":"Multiple choice", "type":"multiple-choice"}
Pick the best cutting strategy.

- [x] Cutting spend is the right goal
- [ ] Ignore the bill
\`\`\`
`,
    searchTopicsResults: [
      {
        id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
        headline: 'Search result: Pick the best <mark>cutting</mark> strategy.',
      },
    ],
  });
  await navigateToCourse(page);

  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search...').fill('cutting');
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('.border-l-2')).toHaveCount(1);
  await page.locator('.border-l-2').first().click();

  await expect(page).toHaveURL(/\/topic\/3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f$/);
  await expect(page.locator('[data-plugin-masteryls-body] mark')).toContainText('cutting');
  await expect(page.locator('label mark')).toContainText('Cutting');
});

test('search result click collapses a full-screen mobile sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await expect(page.locator('#content')).toHaveCount(0);

  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search...').fill('topic');
  await page.locator('form button[type="submit"]').click();

  await expect(page.getByText('matching topic')).toBeVisible();
  await page.getByText('Result for topic').click();

  await expect(page).toHaveURL(/\/topic\/3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f$/);
  await expect(page.locator('#content')).toBeVisible();
});

test('mobile sidebar remembers the last selected tab when re-expanded', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search...').fill('topic');
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByPlaceholder('Search...')).toBeVisible();

  await page.getByText('Result for topic').click();
  await expect(page.locator('#content')).toBeVisible();

  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(page.getByPlaceholder('Search...')).toBeVisible();
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
