import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToCourse } from './testInit';

test('interaction multiple choice', async ({ page }) => {
  const interactionMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123456", "title":"Multiple choice", "type":"multiple-choice" }
Simple **multiple choice** question

- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  await expect(page.getByRole('radio', { name: 'This is the right answer' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'This is not the right answer' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'This one has a link' })).toBeVisible();
  await expect(page.getByText('Simple multiple choice')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Stock Photo' })).toBeVisible();

  await page.getByRole('radio', { name: 'This is the right answer' }).check();
  await expect(page.getByRole('radio', { name: 'This is the right answer' })).toBeChecked();

  await expect(page.locator('pre')).toContainText('Fantastic job');
});

test('interaction multiple select', async ({ page }) => {
  const interactionMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123499", "title":"Multiple select", "type":"multiple-select"}
Simple **multiple select** question

- [x] Good 1
- [ ] Bad 1
- [ ] Bad 2
- [x] Good 2
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  await expect(page.getByRole('checkbox', { name: 'Good 1' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Bad 1' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Bad 2' })).toBeVisible();
  await expect(page.getByText('Simple multiple select')).toBeVisible();

  await page.getByRole('checkbox', { name: 'Good 1' }).check();
  await expect(page.getByRole('checkbox', { name: 'Good 1' })).toBeChecked();
});

test('interaction prompt', async ({ page }) => {
  const markdown = `
# Quiz
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123459", "title":"Prompt", "type":"prompt" }
Simple **prompt** question
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: markdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  await expect(page.getByText('Prompt', { exact: true })).toBeVisible();
  await expect(page.getByText('Simple prompt question')).toBeVisible();

  await page.getByRole('textbox').click();
  await page.getByRole('textbox').fill('example prompt');

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.locator('pre')).toContainText('Fantastic job on this question!');
});

test('interaction submission file', async ({ page }) => {
  const interactionMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123451", "title":"File submission", "type":"file-submission", "allowComment":true }
Simple **file submission** question
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  await expect(page.getByText('File submission', { exact: true })).toBeVisible();
  await expect(page.getByText('Simple file submission question')).toBeVisible();

  // Set the files using a file chooser interception
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Click to upload').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'test.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('test file content'),
  });

  // Wait for the file to be processed and displayed in the UI
  await expect(page.locator('text=Selected files')).toBeVisible();
  await expect(page.locator('text=test.txt')).toBeVisible();

  await page.getByRole('button', { name: 'Submit files' }).click();
  await expect(page.locator('pre')).toContainText('Submission received. Total files: 1. Total size: 17 Bytes.');
});

test('interaction submission url', async ({ page }) => {
  const interactionMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123457", "title":"URL submission", "type":"url-submission", "allowComment":true }
Simple **url submission** question
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  await expect(page.getByText('URL submission', { exact: true })).toBeVisible();
  await expect(page.getByText('Simple url submission question')).toBeVisible();

  const urlInput = page.locator('input[type="url"]');
  await urlInput.click();
  await urlInput.clear();
  await urlInput.fill('https://cow.com');
  await expect(urlInput).toHaveValue('https://cow.com');

  await page.getByRole('button', { name: 'Submit URL' }).click();

  //await page.getByText('Submission received.').waitFor({ timeout: 10000 });
  await expect(page.getByText('Submission received.')).toBeVisible();
});

test('interaction essay', async ({ page }) => {
  await verifyAiEssayResponse(page, 'Good job joe', 'Good job joe');
});

test('interaction essay with student name', async ({ page }) => {
  await verifyAiEssayResponse(page, 'Hi [Student Name]\nwell done', 'Hi Bud well done');
});

test('interaction essay with student name possessive', async ({ page }) => {
  await verifyAiEssayResponse(page, "Hi [Student's Name]\nwell done", 'Hi Bud well done');
});

async function verifyAiEssayResponse(page, generatedResponse, expectedResponse) {
  const interactionMarkdown = `
# Quiz
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123452", "title":"Essay", "type":"essay" }
Simple **essay** question
\`\`\`
`;

  await setAiResponse(page, generatedResponse);
  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();
  await page.getByRole('textbox').click();
  await page.getByRole('textbox').fill('example text');

  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.locator('pre')).toContainText(expectedResponse);
}

async function setAiResponse(page, response) {
  await page.route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'OPTIONS':
        await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
        return;
      case 'POST':
        await route.fulfill({
          json: {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: response,
                    },
                  ],
                  role: 'model',
                },
                finishReason: 'STOP',
                index: 0,
              },
            ],
          },
        });
        return;
    }
    throw new Error(`Unmocked endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });
}
