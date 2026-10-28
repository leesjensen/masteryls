import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

async function openDiscussionPanel(page) {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await page.getByText('topic 1').click();
  await page.getByTitle('Discuss this topic').click();

  await expect(page.getByTitle('Close discussion')).toBeVisible();
}

test('discussion panel opens, supports notes, and closes', async ({ page }) => {
  await openDiscussionPanel(page);

  await page.getByRole('button', { name: 'Notes' }).click();
  await expect(page.locator('#discussion-input')).toHaveAttribute('placeholder', 'Note...');
  await expect(page.getByText('note that appears on the TOC')).toBeVisible();

  await page.locator('#discussion-input').fill('My first note');
  await page.getByRole('button', { name: 'Add Note' }).click();

  await expect(page.getByText('My first note')).toBeVisible();

  await page.getByTitle('Close discussion').click();
  await expect(page.getByTitle('Discuss this topic')).toBeVisible();
});

test('discussion notes can be copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDiscussionPanel(page);

  await page.getByRole('button', { name: 'Notes' }).click();
  await expect(page.getByText('there should be a note that appears on the TOC')).toBeVisible();

  await page.getByTitle('Copy markdown').click();

  await expect(page.getByTitle('Copied')).toBeVisible();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe('there should be a note that appears on the TOC');
});

test('discussion panel supports AI discussion and clearing conversation', async ({ page }) => {
  await openDiscussionPanel(page);

  await page.locator('#discussion-input').fill('Can you summarize this topic?');
  await page.locator('form').getByRole('button', { name: 'Discuss', exact: true }).click();

  await expect(page.getByText('Can you summarize this topic?')).toBeVisible();
  await expect(page.getByText('Fantastic job on this question! You correctly selected the right answer.')).toBeVisible();

  await page.getByTitle('Clear discussion').click();

  await expect(page.getByText("Ask questions about this topic! I'll help explain concepts and provide additional insights.")).toBeVisible();
});

test('discussion AI request includes the current topic content as context', async ({ page }) => {
  // Regression: the Discuss assistant used to send no topic content in normal viewing (topicContent
  // was read from a prop that is null then). Capture the gemini request and confirm the loaded topic
  // markdown is in it. A page route takes precedence over the harness's context route.
  let geminiBody = '';
  await page.route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    geminiBody = route.request().postData() || '';
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'ok' }], role: 'model' }, finishReason: 'STOP', index: 0 }] } });
  });

  await openDiscussionPanel(page);

  await page.locator('#discussion-input').fill('Summarize this topic');
  await page.locator('form').getByRole('button', { name: 'Discuss', exact: true }).click();
  await expect(page.getByText('Summarize this topic')).toBeVisible();

  await expect.poll(() => geminiBody).toContain('This is a blockquote.'); // a distinctive line from the topic markdown
});

test('discussion panel can save AI response as note', async ({ page }) => {
  await openDiscussionPanel(page);

  await page.locator('#discussion-input').fill('What should I remember from this topic?');
  await page.locator('form').getByRole('button', { name: 'Discuss', exact: true }).click();

  await expect(page.getByText('Fantastic job on this question! You correctly selected the right answer.')).toBeVisible();

  await page.getByRole('button', { name: 'Save as Note' }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

  await page.getByRole('button', { name: 'Notes' }).click();

  await expect(page.getByText('Your Question:')).toBeVisible();
  await expect(page.getByText('What should I remember from this topic?')).toBeVisible();
  await expect(page.getByText('AI Response:')).toBeVisible();
});
