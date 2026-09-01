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
  await expect(page.getByRole('button', { name: 'Module 1' })).toBeVisible();
  await expect(page.getByText('markdown!')).toBeVisible();
});

test('instruction types all', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourseNoLogin(page);

  await expect(page.getByRole('banner')).toContainText('Rocket Science');
  await page.getByRole('button', { name: 'Topics' }).click();
  await expect(page.getByRole('button', { name: 'Module 1' })).toBeVisible();

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

  await page.getByRole('button', { name: 'Module 2' }).click();
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

  await page.getByRole('link', { name: 'exam' }).click();
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

test('exam is disabled when not logged in', async ({ page }) => {
  await initBasicCourse({ page, topicMarkdown: '# Exam\n' });
  await navigateToCourseNoLogin(page);

  await page.getByRole('link', { name: 'exam' }).click();

  await expect(page.getByText('This interaction is disabled.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start exam' })).toBeDisabled();
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

  // The href attribute itself must be a resolved app URL (not the raw `topic2.md`), so that
  // opening the link in a new tab / middle-click / cmd-click - which bypass the SPA click
  // handler - land on a valid topic route instead of the "we have gotten lost" error page.
  await expect(page.getByRole('link', { name: 'Go To Topic 2' })).toHaveAttribute('href', /\/course\/14602d77-0ff3-4267-b25e-4a7c3c47848b\/topic\/5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b/);

  await page.getByRole('link', { name: 'Go To Topic 2' }).click();
  await expect(page).toHaveURL(/\/course\/14602d77-0ff3-4267-b25e-4a7c3c47848b\/topic\/5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b/);

  await page.getByRole('link', { name: 'Go To Home' }).click();
  await expect(page).toHaveURL(/\/course\/14602d77-0ff3-4267-b25e-4a7c3c47848b\/topic\/2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e/);
});

// Regression guard: relative links inside a `masteryls` interaction code fence are rendered by
// inlineLiteMarkdown. Previously it emitted a raw `<a href={url}>` with no relative-path
// resolution and no SPA click interception, so a link like [x](../foo.md) kept its raw relative
// href and resolved against the current /course/:id/topic/:id URL - landing on the "we have
// gotten lost" error page - both when opened in a new tab AND on an ordinary click. Links now
// resolve through InteractionLink just like the main topic content.
test('relative links inside a masteryls interaction resolve to a topic route', async ({ page }) => {
  const interactionMarkdown = `
# Interaction Links

\`\`\`masteryls
{"id":"57d595a3-6ae5-40a9-a512-041c1c1cd198", "title":"Phase 0: Getting started", "type":"multiple-choice" }
Which of the following did you complete?

- [x] I used the [Go To Topic 2](topic2.md) template to create a repository.
- [ ] I was not able to create the repo and am reaching out to a TA for help.
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  const link = page.getByRole('link', { name: 'Go To Topic 2' });
  await expect(link).toBeVisible();

  // Like a normal markdown link, the relative `topic2.md` should resolve to topic 2's route so
  // the link is valid whether clicked or opened in a new tab. Today it renders the raw
  // `topic2.md` instead, so this assertion fails - demonstrating the bug.
  await expect(link).toHaveAttribute('href', /\/course\/14602d77-0ff3-4267-b25e-4a7c3c47848b\/topic\/5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b/);
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
