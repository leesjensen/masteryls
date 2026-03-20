import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse, navigateToCourseNoLogin } from './testInit';

test('unregistered user', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourseNoLogin(page);

  await expect(page.getByText('markdown!')).toBeVisible();
});

test('load from course.json', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourseNoLogin(page);

  await expect(page.getByRole('banner')).toContainText('Rocket Science');

  await page.getByRole('button', { name: 'Topics' }).click();
  await expect(page.getByRole('button', { name: '▼ Module 1' })).toBeVisible();
  await expect(page.getByText('markdown!')).toBeVisible();
});

test('instruction types all', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourseNoLogin(page);

  await expect(page.getByRole('banner')).toContainText('Rocket Science');
  await page.getByRole('button', { name: 'Topics' }).click();
  await expect(page.getByRole('button', { name: '▼ Module 1' })).toBeVisible();

  await expect(page.getByText('markdown!')).toBeVisible();

  await expect(page.getByRole('list').filter({ hasText: 'Item 1' })).toBeVisible();

  await expect(page.getByText('NOTE This is a note.')).toBeVisible();
  await expect(page.getByText('TIP This is a tip.')).toBeVisible();
  await expect(page.getByText('CAUTION This is a caution.')).toBeVisible();
  await expect(page.getByText('WARNING This is a warning.')).toBeVisible();
  await expect(page.getByText('IMPORTANT This is an important.')).toBeVisible();

  await expect(page.locator('div').filter({ hasText: /^Is it working\?$/ })).toBeVisible();

  await expect(page.getByRole('blockquote')).toBeVisible();

  await expect(page.getByRole('separator')).toBeVisible();

  await expect(page.getByText('😄 🚀 🎉 👍')).toBeVisible();

  await expect(page.getByRole('img', { name: 'Stock Photo' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'relative image' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'relative image' })).toHaveAttribute('src', 'https://raw.githubusercontent.com/ghAccount/ghRepo/main/path/relative.svg');
});

test('embedded', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourseNoLogin(page);

  await page.getByRole('button', { name: '▶ Module 2' }).click();
  await page.getByText('topic 3').click();

  await expect(page.locator('iframe[title="Embedded content"]')).toBeVisible();
});

test('exam', async ({ page }) => {
  let progress: any = [];

  await page.route(/.*supabase.co\/rest\/v1\/progress(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        const body: any = (await route.request().postDataJSON())[0];
        progress.push(body);
        await route.fulfill({
          status: 200,
          json: progress,
        });
        return;
      case 'GET':
        let json: any = progress;
        const viewType = route
          .request()
          .url()
          .match(/type=eq\.(\w+)/)?.[1];
        json = viewType ? progress.filter((p) => p.type === viewType) : progress;
        await route.fulfill({
          status: 200,
          json,
        });
        return;
    }
    throw new Error(`Unmocked endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  const quizMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123456", "title":"Multiple choice", "type":"multiple-choice" }
Simple **multiple choice** question

- [ ] This is **not** the right answer
- [x] This is _the_ right answer
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: quizMarkdown });
  await navigateToCourse(page);

  await page.getByText('exam').click();
  await page.getByRole('button', { name: 'Start exam' }).click();
  await expect(page.getByRole('main')).toContainText('Carefully review your answers before submitting.');
  await expect(page.getByRole('radio', { name: 'This is the right answer' })).toBeVisible();

  await page.getByRole('radio', { name: 'This is the right answer' }).check();
  await expect(page.getByRole('radio', { name: 'This is the right answer' })).toBeChecked();

  await page.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect(page.locator('pre')).not.toContainText('Great job!');

  await page.getByRole('button', { name: 'Submit exam', exact: true }).click();

  await expect(page.getByRole('main')).toContainText('Submitted');
  await expect(page.getByRole('main')).toContainText('1/1 questions submitted');
  await expect(page.locator('pre')).toContainText('Fantastic job');
});

test('markdown heading note icon opens filtered notes discussion', async ({ page }) => {
  const headingMarkdown = `
# Topic with Notes

## Outcomes

This section should map to saved notes.
`;

  await initBasicCourse({ page, topicMarkdown: headingMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();
  await expect(page.getByRole('heading', { name: 'Outcomes' })).toBeVisible();

  await page.locator('h2:has-text("Outcomes")').getByTitle('View notes for this section').click();

  await expect(page.getByTitle('Close discussion')).toBeVisible();
  await expect(page.getByText('Filtered by: Outcomes')).toBeVisible();
});

test('markdown custom links navigate to relative and root-relative destinations', async ({ page }) => {
  const linkMarkdown = `
# Link Topic

[Go To Topic 2](topic2.md)

[Go To Home](/course/14602d77-0ff3-4267-b25e-4a7c3c47848b/topic/2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e)
`;

  await initBasicCourse({ page, topicMarkdown: linkMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();
  await page.getByRole('link', { name: 'Go To Topic 2' }).click();
  await expect(page).toHaveURL(/\/course\/14602d77-0ff3-4267-b25e-4a7c3c47848b\/topic\/5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b/);

  await page.getByRole('link', { name: 'Go To Home' }).click();
  await expect(page).toHaveURL(/\/course\/14602d77-0ff3-4267-b25e-4a7c3c47848b\/topic\/2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e/);
});

test('markdown anchor links keep current route', async ({ page }) => {
  const anchorMarkdown = `
# Anchors

[Jump to Lists](#lists)

## Lists

Anchor target section
`;

  await initBasicCourse({ page, topicMarkdown: anchorMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();
  const currentUrl = page.url();

  await page.getByRole('link', { name: 'Jump to Lists' }).click();
  await expect(page).toHaveURL(currentUrl);
});

test('markdown iframe renderer allows https and blocks non-https sources', async ({ page }) => {
  const iframeMarkdown = `
# Frame Test

<iframe title="Insecure frame" src="http://insecure.example.com/embed"></iframe>
<iframe title="Secure frame" src="https://example.com/embed"></iframe>
`;

  await initBasicCourse({ page, topicMarkdown: iframeMarkdown });
  await navigateToCourseNoLogin(page);

  await expect(page.locator('iframe[title="Insecure frame"]')).toHaveCount(0);
  await expect(page.locator('iframe[title="Secure frame"]')).toBeVisible();
});
