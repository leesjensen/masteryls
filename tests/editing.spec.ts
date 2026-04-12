import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

async function initAndOpenBasicCourse({ page }: { page: any }) {
  await initBasicCourse({ page });
  await navigateToCourse(page);
}

test('editor markdown', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await expect(page.getByRole('code')).toContainText('# Home');
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).click();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).toBeChecked();
});

test('editor commit', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await expect(page.getByRole('code')).toContainText('# Home');

  await page.getByText('# Home').click();
  await page.getByRole('textbox', { name: 'Editor content' }).press('End');
  await page.getByRole('textbox', { name: 'Editor content' }).fill('\n# Home altered!');
  // await page.getByRole('textbox').fill('# Home\n\naltered!');
  await expect(page.getByRole('code')).toContainText('altered!');

  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeDisabled();
});

test('settings', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.getByText('Settings').click();
  await expect(page.getByRole('textbox', { name: 'Course Title' })).toHaveValue('Rocket Science');
});

test('settings editing', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  await expect(page.getByRole('textbox', { name: 'Course Title' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Enter course title' }).click();
  await page.getByRole('textbox', { name: 'Enter course title' }).fill('Rocket Sciencex');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Settings saved')).toBeVisible();
});

test('settings repair and state changes', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  const saveButton = page.getByRole('button', { name: 'Save changes' });
  await expect(saveButton).toBeDisabled();

  const courseTitleInput = page.getByRole('textbox', { name: 'Enter course title' });
  const currentTitle = await courseTitleInput.inputValue();
  await courseTitleInput.fill(`${currentTitle} ${Math.floor(Math.random() * 100000)}`);
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  await expect(page.getByText('Settings saved')).toBeVisible();
});

test('settings editor management requires at least one editor', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  await expect(page.getByText('2 editors assigned')).toBeVisible();
  await page.getByRole('button', { name: 'Manage editors' }).click();

  await expect(page.getByRole('heading', { name: 'Manage editors' })).toBeVisible();

  const userSearch = page.getByPlaceholder('Search by name or email');

  await userSearch.fill('bu');
  const addedButtons = page.getByRole('button', { name: 'Added' });
  await expect(addedButtons).toHaveCount(2);
  await addedButtons.nth(0).click();
  await addedButtons.nth(0).click();

  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('At least one editor must be selected')).toBeVisible();
});

test('settings delete dialog can be opened and canceled', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  await page.getByRole('button', { name: 'Delete course' }).click();
  await expect(page.getByRole('heading', { name: '⚠️ Delete course' })).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: '⚠️ Delete course' })).not.toBeVisible();
});

test('editor toolbar and files panel actions', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();

  await page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).click();
  await page.getByRole('button', { name: 'Insert' }).click();
  await expect(page.getByRole('button', { name: 'Insert' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' })).not.toBeVisible();

  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Image' }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Word Wrap: On' }).click();
  await expect(page.getByRole('button', { name: 'Word Wrap: Off' })).toBeVisible();
});

test('editor changed lines markers can be toggled', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();

  await expect(page.getByRole('textbox', { name: 'Editor content' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Changed Lines: On' })).toBeVisible();

  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeEnabled();

  await expect.poll(async () => await page.evaluate(() => document.querySelectorAll('.mls-line-changed-gutter').length)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Changed Lines: On' }).click();
  await expect(page.getByRole('button', { name: 'Changed Lines: Off' })).toBeVisible();

  await expect.poll(async () => await page.evaluate(() => document.querySelectorAll('.mls-line-changed-gutter').length)).toBe(0);
});

test('topic drag reorder stays in dropped position while save is pending', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  let delayedUpdateStarted = false;
  let delayedUpdateFinished = false;

  await page.context().route('https://api.github.com/**/contents/course.json', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }

    delayedUpdateStarted = true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    delayedUpdateFinished = true;
    await route.fulfill({ status: 201, json: { commit: { sha: 'delayed-reorder-commit' } } });
  });

  await page.locator('.absolute.left-0\\.5').click();
  await expect(page.getByRole('link', { name: 'topic 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'exam' })).toBeVisible();

  const dragHandles = page.locator('[title="Drag to reorder"]');
  await expect(dragHandles).toHaveCount(3);

  const source = dragHandles.nth(2);
  const target = dragHandles.nth(1);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error('Unable to resolve drag handle bounds for reorder test.');
  }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => delayedUpdateStarted).toBeTruthy();

  // Regression check: while persistence is still pending, the dropped order should already be reflected.
  const pendingCheckDeadline = Date.now() + 1000;
  while (!delayedUpdateFinished && Date.now() < pendingCheckDeadline) {
    const examBox = await page.getByRole('link', { name: 'exam' }).boundingBox();
    const topic1Box = await page.getByRole('link', { name: 'topic 1' }).boundingBox();
    expect(examBox && topic1Box && examBox.y < topic1Box.y).toBeTruthy();
    await page.waitForTimeout(100);
  }

  await expect.poll(() => delayedUpdateFinished).toBeTruthy();
});

test('editor link insertion uses topic dialog with search', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();

  await page.getByRole('button', { name: 'Link' }).click();
  await expect(page.getByRole('heading', { name: 'Insert topic link' })).toBeVisible();

  const searchInput = page.getByPlaceholder('Search topics by title, description, or path');
  await searchInput.fill('topic 2');
  await page
    .getByRole('button', { name: /^topic 2/i })
    .first()
    .click();
  await page.getByRole('button', { name: 'Insert link' }).click();

  await expect(page.getByRole('heading', { name: 'Insert topic link' })).not.toBeVisible();

  const insertedMarkdown = await page.evaluate(() => {
    const monaco = (window as any).monaco;
    const models = monaco?.editor?.getModels?.() || [];
    const matchingModel = models.find((model: any) => String(model.getValue()).includes('[topic 2](/course/14602d77-0ff3-4267-b25e-4a7c3c47848b/topic/5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b)'));
    return matchingModel ? String(matchingModel.getValue()) : '';
  });

  expect(insertedMarkdown).toContain('[topic 2](/course/14602d77-0ff3-4267-b25e-4a7c3c47848b/topic/5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b)');
});

test('editor can insert AI generated quiz markdown', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.context().route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (route.request().method() === 'POST') {
      await route.fulfill({
        json: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```masteryls\n{"id":"", "title":"AI Quiz", "type":"multiple-choice"}\nWhat is 2 + 2?\n\n- [ ] 3\n- [x] 4\n- [ ] 5\n- [ ] 22\n```',
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          modelVersion: 'gemini-2.5-flash',
          responseId: 'ai-quiz-test-response',
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByTitle('AI generated quiz').click();

  await page.getByPlaceholder('subject').fill('basic arithmetic');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();

  const editorCode = page.getByRole('code');
  await expect(editorCode).toContainText('"title":"AI Quiz"');
  await expect(editorCode).toContainText('What is 2 + 2?');
  await expect(editorCode).toContainText('- [x] 4');

  const insertedMarkdown = await page.evaluate(() => {
    const monaco = (window as any).monaco;
    const models = monaco?.editor?.getModels?.() || [];
    const matchingModel = models.find((model: any) => String(model.getValue()).includes('AI Quiz'));
    return matchingModel ? String(matchingModel.getValue()) : '';
  });

  expect(insertedMarkdown).toContain('```masteryls');
  expect(/```masteryls[\s\S]*```/.test(insertedMarkdown)).toBeTruthy();
});

test('editor commits can be shown with diff and apply actions', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByRole('button', { name: 'Show Commits' }).click();

  await expect(page.getByText('Initial topic commit')).toBeVisible();
  await expect(page.getByText('Improve topic wording')).toBeVisible();

  await page.getByRole('button', { name: 'Diff' }).first().click();
  await expect(page.getByRole('button', { name: 'Diff' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Apply' }).first().click();
  await expect(page.getByRole('button', { name: 'Discard' })).toBeEnabled();

  await page.getByRole('button', { name: 'Hide Commits' }).click();
  await expect(page.getByText('Initial topic commit')).not.toBeVisible();
});
