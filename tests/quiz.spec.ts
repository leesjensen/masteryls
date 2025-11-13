import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToCourse } from './testInit';

test('quiz multiple choice', async ({ page }) => {
  const quizMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123456", "title":"Multiple choice", "type":"multiple-choice", "body":"Simple **multiple choice** question" }
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: quizMarkdown });
  await navigateToCourse(page);

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
{"id":"a1b2c3d4-e5f6-7890-1234-567890123499", "title":"Multiple select", "type":"multiple-select", "body":"Simple **multiple select** question" }
- [x] Good 1
- [ ] Bad 1
- [ ] Bad 2
- [x] Good 2
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: quizMarkdown });
  await navigateToCourse(page);

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
{"id":"a1b2c3d4-e5f6-7890-1234-567890123452", "title":"Essay", "type":"essay", "body":"Simple **essay** question" }
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: quizMarkdown });
  await navigateToCourse(page);

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
{"id":"a1b2c3d4-e5f6-7890-1234-567890123451", "title":"File submission", "type":"file-submission", "allowComment":true, "body":"Simple **file submission** question" }
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: quizMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  await expect(page.getByText('File submission', { exact: true })).toBeVisible();
  await expect(page.getByText('Simple file submission question')).toBeVisible();
});

test('quiz submission url', async ({ page }) => {
  const quizMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123457", "title":"URL submission", "type":"url-submission", "allowComment":true, "body":"Simple **url submission** question" }
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: quizMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  await expect(page.getByText('URL submission', { exact: true })).toBeVisible();
  await expect(page.getByText('Simple url submission question')).toBeVisible();
});
