import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToCourse } from './testInit';

test('load from course.json', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await expect(page.getByRole('banner')).toContainText('Rocket Science');
  await expect(page.getByRole('button', { name: '☰' })).toBeVisible();
  await expect(page.getByRole('button', { name: '▼ Module 1' })).toBeVisible();
  await expect(page.getByText('markdown!')).toBeVisible();
});

test('instruction types all', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await expect(page.getByRole('banner')).toContainText('Rocket Science');
  await expect(page.getByRole('button', { name: '☰' })).toBeVisible();
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
  await expect(page.getByRole('img', { name: 'relative image' })).toHaveAttribute('src', 'https://raw.githubusercontent.com/devops329/devops/main/path/relative.svg');
});

test('video', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await page.getByRole('button', { name: '▶ Module 2' }).click();
  await page.getByText('topic 3').click();

  await expect(page.locator('iframe[title="YouTube video player"]')).toBeVisible();
});

test('exam', async ({ page }) => {
  let progress: any = [];

  await page.route(/.*supabase.co\/rest\/v1\/progress(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        const body: any = (await route.request().postDataJSON())[0];
        if (body.type.startsWith('exam-')) {
          progress.push(body);
        }
        console.log('Mocking progress POST', progress, body);
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
