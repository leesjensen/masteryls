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

test('adding a topic with an existing slug generates a unique path', async ({ page }) => {
  await initBasicCourse({
    page,
    courseJsonOverride: {
      modules: [
        {
          title: 'Module 1',
          topics: [
            { id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', title: 'Home', path: 'README.md' },
            { id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f', title: 'Topic 1', type: 'instruction', path: 'instruction/topic-1/topic-1.md' },
          ],
        },
      ],
    },
  });

  const context = page.context();
  const courseJsonPuts: any[] = [];

  await context.route('https://api.github.com/**/contents/course.json', async (route: any) => {
    if (route.request().method() === 'PUT') {
      const postData = route.request().postDataJSON();
      const decoded = Buffer.from(postData.content, 'base64').toString('utf8');
      courseJsonPuts.push(JSON.parse(decoded));
      await route.fulfill({ status: 201, json: { commit: { sha: 'coursejson-unique-topic-sha' } } });
      return;
    }

    await route.continue();
  });

  await context.route(/https:\/\/api\.github\.com\/repos\/ghAccount\/ghRepo\/contents\/instruction\/.*\.md$/, async (route: any) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 201, json: { commit: { sha: 'topic-commit-sha' } } });
      return;
    }

    await route.continue();
  });

  await navigateToCourse(page);
  await page.locator('.absolute.left-0\\.5').click();

  await page.getByRole('button', { name: '+ Add New Topic' }).first().click();
  await page.getByPlaceholder('Topic title').fill('Topic 1');
  await page.getByRole('button', { name: 'Generate' }).click();

  await expect.poll(() => courseJsonPuts.length).toBeGreaterThan(0);
  const latestCourseJson = courseJsonPuts[courseJsonPuts.length - 1];
  const topics = (latestCourseJson.modules || []).flatMap((m: any) => m.topics || []);
  const duplicateTitleTopics = topics.filter((t: any) => t.title === 'Topic 1');

  expect(duplicateTitleTopics).toHaveLength(2);
  expect(duplicateTitleTopics.some((t: any) => t.path === 'instruction/topic-1/topic-1.md')).toBeTruthy();
  expect(duplicateTitleTopics.some((t: any) => t.path === 'instruction/topic-1-2/topic-1-2.md')).toBeTruthy();
});
