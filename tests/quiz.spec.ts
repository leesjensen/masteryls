import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse } from './testInit';

test('quiz multiple choice', async ({ page }) => {
  const quizMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"39283", "title":"Multiple choice", "type":"multiple-choice", "body":"Simple **multiple choice** question" }
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`
`;

  const quizHtml = `
<h1>Quiz</h1>
<pre lang="masteryls" class="notranslate"><code class="notranslate">{"id":"39283", "title":"Multiple choice", "type":"multiple-choice", "body":"Simple **multiple choice** question" }
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&amp;fit=crop&amp;w=400&amp;q=80)
</code></pre>
`;

  await page.route('*/**/topic1.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: quizMarkdown });
  });

  await initBasicCourse({ page, topicHtml: quizHtml });

  await page.goto('http://localhost:5173/');

  await page.getByText('topic 1').click();

  await expect(page.getByRole('radio', { name: 'This is the right answer' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'This is not the right answer' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'This one has a link' })).toBeVisible();
  await expect(page.getByRole('group')).toContainText('Simple multiple choice question');
  await expect(page.getByRole('img', { name: 'Stock Photo' })).toBeVisible();

  await page.getByRole('radio', { name: 'This is the right answer' }).check();
  await expect(page.getByRole('radio', { name: 'This is the right answer' })).toBeChecked();
});

test('quiz multiple select', async ({ page }) => {
  const quizMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"39283", "title":"Multiple select", "type":"multiple-select", "body":"Simple **multiple select** question" }
- [x] Good 1
- [ ] Bad 1
- [ ] Bad 2
- [x] Good 2
\`\`\`
`;

  const quizHtml = `
<h1>Quiz</h1>
<pre lang="masteryls" class="notranslate"><code class="notranslate">{"id":"39283", "title":"Multiple select", "type":"multiple-select", "body":"Simple **multiple select** question" }
- [x] Good 1
- [ ] Bad 1
- [ ] Bad 2
- [x] Good 2
</code></pre>
`;

  await page.route('*/**/topic1.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: quizMarkdown });
  });

  await initBasicCourse({ page, topicHtml: quizHtml });

  await page.goto('http://localhost:5173/');

  await page.getByText('topic 1').click();

  await expect(page.getByRole('checkbox', { name: 'Good 1' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Bad 1' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Bad 2' })).toBeVisible();
  await expect(page.getByRole('group')).toContainText('Simple multiple select question');

  await page.getByRole('checkbox', { name: 'Good 1' }).check();
  await expect(page.getByRole('checkbox', { name: 'Good 1' })).toBeChecked();
});

test('quiz essay', async ({ page }) => {
  const quizMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"39283", "title":"Essay", "type":"essay", "body":"Simple **essay** question" }
\`\`\`
`;

  const quizHtml = `
<h1>Quiz</h1>
<pre lang="masteryls" class="notranslate"><code class="notranslate">
{"id":"39283", "title":"Essay", "type":"essay", "body":"Simple **essay** question" }
</code></pre>
`;

  await page.route('*/**/topic1.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: quizMarkdown });
  });

  await initBasicCourse({ page, topicHtml: quizHtml });

  await page.goto('http://localhost:5173/');

  await page.getByText('topic 1').click();

  await expect(page.getByText('Essay', { exact: true })).toBeVisible();
  await expect(page.getByText('Simple essay question')).toBeVisible();

  await page.getByRole('textbox').click();
  await page.getByRole('textbox').fill('example text');
  await expect(page.getByRole('textbox')).toHaveValue('example text');
});

test('quiz submission file', async ({ page }) => {
  const quizMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"a1b2c3d4e5f6789012345678901234ab", "title":"File submission", "type":"file-submission", "allowComment":true, "body":"Simple **file submission** question" }
\`\`\`
`;

  const quizHtml = `
<h1>Quiz</h1>
<pre lang="masteryls" class="notranslate"><code class="notranslate">
{"id":"a1b2c3d4e5f6789012345678901234ab", "title":"File submission", "type":"file-submission", "allowComment":true, "body":"Simple **file submission** question" }
</code></pre>
`;

  await page.route('*/**/topic1.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: quizMarkdown });
  });

  await initBasicCourse({ page, topicHtml: quizHtml });

  await page.goto('http://localhost:5173/');

  await page.getByText('topic 1').click();

  await expect(page.getByText('EFile submission', { exact: true })).toBeVisible();
  await expect(page.getByText('Simple file submission question')).toBeVisible();

  await page.getByRole('textbox').click();
  await page.getByRole('textbox').fill('example text');
  await expect(page.getByRole('textbox')).toHaveValue('example text');
});
