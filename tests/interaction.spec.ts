import { test, expect } from './fixtures';
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
  await page.getByRole('button', { name: 'Submit' }).click();

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
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.locator('pre')).toContainText('Fantastic job');
});

test('interaction web page renders relative html file', async ({ page }) => {
  const interactionMarkdown = `
# Web Page
\`\`\`masteryls
{"id":"a3b2a9f8-25e3-4ca4-8cca-42f3eb20537e", "title":"Web page", "type":"web-page" "file":"index.html", "height":520}
\`\`\`
`;

  await page.route(/https:\/\/raw\.githubusercontent\.com\/ghAccount\/ghRepo\/main\/(something\/more\/)?index\.html/, async (route) => {
    await route.fulfill({
      body: '<!doctype html><html><body style="margin:24px"><h1>Embedded Web Page</h1><div style="width:2000px;height:2000px"></div></body></html>',
      contentType: 'text/html; charset=utf-8',
    });
  });

  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();
  await expect(page).toHaveURL(/\/topic\/3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f/);

  const iframe = page.locator('iframe[title="Web page"]');
  const frameContainer = page.locator('[data-plugin-masteryls-web-page]');
  const resizeHandle = page.locator('[data-plugin-masteryls-web-page-resize-handle]');
  await expect(iframe).toBeVisible();
  await expect(page.getByText('Web page', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-plugin-masteryls-root][data-plugin-masteryls-type="web-page"]')).toHaveCount(0);
  await expect(frameContainer).toHaveCSS('height', '520px');
  await expect(frameContainer).toHaveCSS('border-top-width', '0px');
  await expect(frameContainer).toHaveCSS('resize', 'vertical');
  await expect(iframe).toHaveAttribute('data-src', 'https://raw.githubusercontent.com/ghAccount/ghRepo/main/something/more/index.html');
  await expect(iframe).toHaveAttribute('scrolling', 'no');
  await expect(page.frameLocator('iframe[title="Web page"]').getByRole('heading', { name: 'Embedded Web Page' })).toBeVisible();

  const iframeHandle = await iframe.elementHandle();
  const frame = await iframeHandle?.contentFrame();
  if (!frame) throw new Error('Expected web page iframe to have a frame');
  const frameSizing = await frame.evaluate(() => ({
    bodyMargin: getComputedStyle(document.body).margin,
    bodyOverflow: getComputedStyle(document.body).overflow,
    clientHeight: document.documentElement.clientHeight,
    clientWidth: document.documentElement.clientWidth,
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
  }));
  expect(frameSizing.bodyMargin).toBe('0px');
  expect(frameSizing.bodyOverflow).toBe('hidden');
  expect(frameSizing.htmlOverflow).toBe('hidden');
  expect(Math.abs(frameSizing.innerHeight - frameSizing.clientHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(frameSizing.innerWidth - frameSizing.clientWidth)).toBeLessThanOrEqual(1);

  const box = await frameContainer.boundingBox();
  if (!box) throw new Error('Expected web page frame to have a bounding box');
  await resizeHandle.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 80);
  await page.mouse.up();

  await expect
    .poll(async () => {
      const resizedBox = await frameContainer.boundingBox();
      return resizedBox?.height || 0;
    })
    .toBeGreaterThan(580);

  const expandedBox = await frameContainer.boundingBox();
  if (!expandedBox) throw new Error('Expected resized web page frame to have a bounding box');
  await resizeHandle.hover();
  await page.mouse.down();
  await page.mouse.move(expandedBox.x + expandedBox.width / 2, expandedBox.y + 120);
  await expect(iframe).toHaveCSS('pointer-events', 'none');
  await page.mouse.up();
  await expect(iframe).toHaveCSS('pointer-events', 'auto');

  await expect
    .poll(async () => {
      const resizedBox = await frameContainer.boundingBox();
      return resizedBox?.height || 0;
    })
    .toBeLessThan(expandedBox.height - 100);
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

test('interaction ai web page stores generated html submission', async ({ page }) => {
  const generatedHtml = '<!doctype html><html><body><main><h1>Generated AI Page</h1><p>Responsive layout submitted.</p></main></body></html>';
  const interactionMarkdown = `
# AI Web Page
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123460", "title":"AI web page", "type":"ai-web-page", "height":420}
Create an HTML page from your prompt.
\`\`\`
`;

  const feedbackText = 'Great work! Your page matches the prompt well.';
  let geminiCallCount = 0;
  await page.route(/.*supabase\.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    if (route.request().method() === 'POST') {
      geminiCallCount++;
      const text = geminiCallCount === 1 ? `\`\`\`html\n${generatedHtml}\n\`\`\`` : `{"percentCorrect": 85}\n${feedbackText}`;
      await route.fulfill({ json: { candidates: [{ content: { parts: [{ text }], role: 'model' }, finishReason: 'STOP', index: 0 }] } });
      return;
    }
    throw new Error(`Unmocked endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();
  await expect(page).toHaveURL(/\/topic\/3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f/);
  await expect(page.getByText('AI web page', { exact: true })).toBeVisible();
  await expect(page.getByText('Create an HTML page from your prompt.')).toBeVisible();

  const promptInput = page.getByPlaceholder('Describe the web page you want to generate ...');
  const generateButton = page.getByRole('button', { name: 'Generate page' });
  await promptInput.click();
  await promptInput.fill('Make a responsive page about CSS grid.');
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  const iframe = page.locator('iframe[title="AI web page"]');
  await expect(iframe).toBeVisible();
  await expect(page.frameLocator('iframe[title="AI web page"]').getByRole('heading', { name: 'Generated AI Page' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Execute prompt' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();

  const progressPost = page.waitForRequest((request) => request.method() === 'POST' && /supabase\.co\/rest\/v1\/progress/.test(request.url()));
  await page.getByRole('button', { name: 'Submit' }).click();

  const progressRequest = await progressPost;
  const progressBody = progressRequest.postDataJSON()[0];
  expect(progressBody.type).toBe('quizSubmit');
  expect(progressBody.interactionId).toBe('a1b2c3d4-e5f6-7890-1234-567890123460');
  expect(progressBody.details.prompt).toBe('Make a responsive page about CSS grid.');
  expect(progressBody.details.html).toContain('Generated AI Page');
  expect(progressBody.details.percentCorrect).toBe(85);
  expect(progressBody.details.feedback).toBe(feedbackText);

  await page.getByRole('button', { name: 'View source' }).click();
  const sourceEditor = page.locator('[data-plugin-masteryls-ai-web-page-source]');
  await expect(sourceEditor).toBeVisible();
  await expect(sourceEditor).toHaveValue(/Generated AI Page/);

  const editedHtml = generatedHtml.replace('Generated AI Page', 'Edited AI Page');
  const sourceProgressPost = page.waitForRequest((request) => request.method() === 'POST' && /supabase\.co\/rest\/v1\/progress/.test(request.url()));
  await sourceEditor.fill(editedHtml);
  await expect(page.getByRole('button', { name: 'Apply source' })).toBeEnabled();
  await page.getByRole('button', { name: 'Apply source' }).click();

  const sourceProgressRequest = await sourceProgressPost;
  const sourceProgressBody = sourceProgressRequest.postDataJSON()[0];
  expect(sourceProgressBody.details.prompt).toBe('Make a responsive page about CSS grid.');
  expect(sourceProgressBody.details.html).toContain('Edited AI Page');
  await expect(page.frameLocator('iframe[title="AI web page"]').getByRole('heading', { name: 'Edited AI Page' })).toBeVisible();
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

test('interaction teaching submit session', async ({ page }) => {
  const interactionMarkdown = `
# Teaching
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123472", "title":"Teach me", "type":"teaching" }
Help the learner understand testing.
\`\`\`
`;

  await setAiResponse(page, 'Nice explanation.\n\nUnderstanding Score: 82%');
  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  const respondButton = page.getByRole('button', { name: '▶ Respond' });
  const submitSession = page.getByRole('button', { name: 'Submit session' });
  const clearButton = page.getByRole('button', { name: 'Clear' });
  const input = page.getByPlaceholder('As a teacher, respond to the learner ...');

  await expect(submitSession).toBeDisabled();
  await expect(clearButton).toBeDisabled();

  await input.click();
  await input.type('I would explain testing with small examples.');
  await expect(respondButton).toBeEnabled();
  await respondButton.click();

  await expect(page.getByText('Understanding: 82%')).toBeVisible();
  await expect(submitSession).toBeEnabled();
  await expect(clearButton).toBeEnabled();

  await submitSession.click();
  await expect(page.getByText('Session submitted')).toBeVisible();
});

test('interaction teaching shows ai error message', async ({ page }) => {
  const interactionMarkdown = `
# Teaching
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123473", "title":"Teach me", "type":"teaching" }
Help the learner understand testing.
\`\`\`
`;

  await setAiErrorResponse(page, 'service down');
  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();
  const input = page.getByPlaceholder('As a teacher, respond to the learner ...');
  const respondButton = page.getByRole('button', { name: '▶ Respond' });
  await input.click();
  await input.type('A response that will fail.');
  await expect(respondButton).toBeEnabled();
  await respondButton.click();

  await expect(page.getByText('Sorry, I encountered an error: service down')).toBeVisible();
});

test('interaction survey single-select', async ({ page }) => {
  const interactionMarkdown = `
# Survey
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123470", "title":"Survey", "type":"survey"}
How do you feel about this topic?

- [ ] Great
- [ ] Okay
- [ ] Needs work
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  const submit = page.getByRole('button', { name: 'Submit' });
  const great = page.getByRole('radio', { name: 'Great' });
  const okay = page.getByRole('radio', { name: 'Okay' });

  await expect(submit).toBeDisabled();
  await great.check();
  await expect(submit).toBeEnabled();
  await expect(great).toBeChecked();

  await okay.check();
  await expect(okay).toBeChecked();
  await expect(great).not.toBeChecked();

  await submit.click();
  await expect(page.getByText('Total respondents:')).toBeVisible();
});

test('interaction survey multi-select', async ({ page }) => {
  const interactionMarkdown = `
# Survey
\`\`\`masteryls
{"id":"a1b2c3d4-e5f6-7890-1234-567890123471", "title":"Survey Multi", "type":"survey", "multipleSelect":"true"}
Pick all that apply.

- [ ] Great
- [ ] Helpful
- [ ] Confusing
\`\`\`
`;

  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();

  const submit = page.getByRole('button', { name: 'Submit' });
  const great = page.getByRole('checkbox', { name: 'Great' });
  const helpful = page.getByRole('checkbox', { name: 'Helpful' });

  await expect(submit).toBeEnabled();
  await great.check();
  await helpful.check();
  await expect(great).toBeChecked();
  await expect(helpful).toBeChecked();

  await submit.click();
  await expect(page.getByText('Total respondents:')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
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

async function setAiErrorResponse(page, message) {
  await page.route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'OPTIONS':
        await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
        return;
      case 'POST':
        await route.fulfill({ json: { error: { message } } });
        return;
    }
    throw new Error(`Unmocked endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });
}
