import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse, navigateToCourseNoLogin } from './testInit';

test('toc toggling', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourseNoLogin(page);

  await expect(page.getByText('topic 1')).toBeVisible();
  await expect(page.getByText('topic 2')).not.toBeVisible();
  await page.getByRole('button', { name: '▶ Module 2' }).click();
  await expect(page.getByText('topic 2')).toBeVisible();
  await page.getByRole('button', { name: '▼ Module 1' }).click();
  await expect(page.getByText('topic 1')).not.toBeVisible();
});

test('editor contents actions are visible', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await page.locator('.absolute.left-0\\.5').click();

  await expect(page.getByRole('button', { name: '+ Add New Module' })).toBeVisible();
  await expect(page.getByText('+ Generate all stubbed topics')).toBeVisible();

  await page.getByText('+ Generate all stubbed topics').click();
  await expect(page.getByText('+ Generate all stubbed topics')).toBeVisible();
});

test('toc hides unpublished topics for learners', async ({ page }) => {
  await initBasicCourse({
    page,
    courseJsonOverride: {
      modules: [
        {
          title: 'Module 1',
          topics: [
            { id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', title: 'Home', path: 'README.md' },
            { id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f', title: 'topic 1', type: 'instruction', path: 'something/more/topic1.md' },
          ],
        },
        {
          title: 'Module 2',
          topics: [
            { id: '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b', title: 'topic 2', state: 'unpublished', path: 'something/more/topic2.md' },
            { id: '6f7a8b9c-0d1e-2f3a-4b5c-6d7e8f9a0b1c', title: 'topic 3', type: 'embedded', path: 'https://www.youtube.com/embed/HXNx_Gp0jyM' },
          ],
        },
      ],
    },
  });
  await navigateToCourseNoLogin(page);

  await page.getByRole('button', { name: '▶ Module 2' }).click();
  await expect(page.getByText('topic 2')).not.toBeVisible();
  await expect(page.getByText('topic 3')).toBeVisible();
});
