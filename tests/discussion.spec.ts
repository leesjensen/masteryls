import { test, expect } from 'playwright-test-coverage';
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

test('discussion panel supports AI discussion and clearing conversation', async ({ page }) => {
  await openDiscussionPanel(page);

  await page.locator('#discussion-input').fill('Can you summarize this topic?');
  await page.locator('form').getByRole('button', { name: 'Discuss', exact: true }).click();

  await expect(page.getByText('Can you summarize this topic?')).toBeVisible();
  await expect(page.getByText('Fantastic job on this question! You correctly selected the right answer.')).toBeVisible();

  await page.getByTitle('Clear discussion').click();

  await expect(page.getByText("Ask questions about this topic! I'll help explain concepts and provide additional insights.")).toBeVisible();
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
