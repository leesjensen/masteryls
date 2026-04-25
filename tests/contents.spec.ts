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
  await expect(page.getByRole('button', { name: 'Delete schedule' })).toBeVisible();
  await expect(page.getByText('+ Generate all stubbed topics')).not.toBeVisible();
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

test('adding a plain instruction topic creates the topic file and course entry', async ({ page }) => {
  await initBasicCourse({ page });

  const context = page.context();
  const courseJsonPuts: any[] = [];
  const topicFilePuts: { url: string; body: any; content: string }[] = [];

  await context.route('https://api.github.com/**/contents/course.json', async (route: any) => {
    if (route.request().method() === 'PUT') {
      const postData = route.request().postDataJSON();
      const decoded = Buffer.from(postData.content, 'base64').toString('utf8');
      courseJsonPuts.push(JSON.parse(decoded));
      await route.fulfill({ status: 201, json: { commit: { sha: 'coursejson-plain-topic-sha' } } });
      return;
    }

    await route.continue();
  });

  await context.route(/https:\/\/api\.github\.com\/repos\/ghAccount\/ghRepo\/contents\/instruction\/fresh-instruction-topic(?:\/fresh-instruction-topic\.md)?/, async (route: any) => {
    if (route.request().method() === 'PUT') {
      const postData = route.request().postDataJSON();
      topicFilePuts.push({
        url: route.request().url(),
        body: postData,
        content: Buffer.from(postData.content, 'base64').toString('utf8'),
      });
      await route.fulfill({ status: 201, json: { commit: { sha: 'plain-topic-commit-sha' } } });
      return;
    }

    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, json: [] });
      return;
    }

    await route.continue();
  });

  await navigateToCourse(page);
  await page.locator('.absolute.left-0\\.5').click();

  await page.getByRole('button', { name: '+ Add New Topic' }).first().click();
  await page.getByPlaceholder('Topic title').fill('Fresh Instruction Topic');
  await page.getByRole('combobox').selectOption('instruction');
  await page.getByRole('button', { name: 'Generate' }).click();

  await expect.poll(() => topicFilePuts.length).toBe(1);
  await expect.poll(() => courseJsonPuts.length).toBeGreaterThan(0);

  expect(topicFilePuts[0].url).toContain('/instruction/fresh-instruction-topic/fresh-instruction-topic.md');
  expect(topicFilePuts[0].body.message).toBe('add(topic) Fresh Instruction Topic');
  expect(topicFilePuts[0].content).toContain('# Fresh Instruction Topic');
  expect(topicFilePuts[0].content).toContain('overview content placeholder');

  const latestCourseJson = courseJsonPuts[courseJsonPuts.length - 1];
  const topics = (latestCourseJson.modules || []).flatMap((m: any) => m.topics || []);
  const addedTopic = topics.find((t: any) => t.title === 'Fresh Instruction Topic');

  expect(addedTopic).toMatchObject({
    title: 'Fresh Instruction Topic',
    type: 'instruction',
    path: 'instruction/fresh-instruction-topic/fresh-instruction-topic.md',
  });
  expect(addedTopic.id).toBeTruthy();
});

test('adding an instruction topic with a description uses AI generated content', async ({ page }) => {
  await initBasicCourse({ page });

  const context = page.context();
  const courseJsonPuts: any[] = [];
  const topicFilePuts: { url: string; body: any; content: string }[] = [];
  let geminiPromptPayload = '';

  await context.route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (route.request().method() === 'POST') {
      geminiPromptPayload = route.request().postData() || '';
      await route.fulfill({
        json: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '# AI Generated Topic\n\nThis body came from the mocked AI topic generator.\n\n## Worked Example\n\nA concise generated example.',
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          modelVersion: 'gemini-2.5-flash',
          responseId: 'ai-topic-generation-test-response',
        },
      });
      return;
    }

    await route.fallback();
  });

  await context.route('https://api.github.com/**/contents/course.json', async (route: any) => {
    if (route.request().method() === 'PUT') {
      const postData = route.request().postDataJSON();
      const decoded = Buffer.from(postData.content, 'base64').toString('utf8');
      courseJsonPuts.push(JSON.parse(decoded));
      await route.fulfill({ status: 201, json: { commit: { sha: 'coursejson-ai-topic-sha' } } });
      return;
    }

    await route.continue();
  });

  await context.route(/https:\/\/api\.github\.com\/repos\/ghAccount\/ghRepo\/contents\/instruction\/ai-generated-topic(?:\/ai-generated-topic\.md)?/, async (route: any) => {
    if (route.request().method() === 'PUT') {
      const postData = route.request().postDataJSON();
      topicFilePuts.push({
        url: route.request().url(),
        body: postData,
        content: Buffer.from(postData.content, 'base64').toString('utf8'),
      });
      await route.fulfill({ status: 201, json: { commit: { sha: 'ai-topic-commit-sha' } } });
      return;
    }

    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, json: [] });
      return;
    }

    await route.continue();
  });

  await navigateToCourse(page);
  await page.locator('.absolute.left-0\\.5').click();

  await page.getByRole('button', { name: '+ Add New Topic' }).first().click();
  await page.getByPlaceholder('Topic title').fill('AI Generated Topic');
  await page.getByRole('combobox').selectOption('instruction');
  await page.getByRole('textbox', { name: 'Description' }).fill('Teach orbital staging with a short worked example.');
  await page.getByRole('button', { name: 'Generate' }).click();

  await expect.poll(() => topicFilePuts.length).toBe(1);
  await expect.poll(() => courseJsonPuts.length).toBeGreaterThan(0);

  expect(geminiPromptPayload).toContain('Create comprehensive markdown content for an instructional topic titled');
  expect(geminiPromptPayload).toContain('AI Generated Topic');
  expect(geminiPromptPayload).toContain('Teach orbital staging with a short worked example.');

  expect(topicFilePuts[0].url).toContain('/instruction/ai-generated-topic/ai-generated-topic.md');
  expect(topicFilePuts[0].body.message).toBe('add(topic) AI Generated Topic');
  expect(topicFilePuts[0].content).toContain('This body came from the mocked AI topic generator.');
  expect(topicFilePuts[0].content).toContain('## Worked Example');
  expect(topicFilePuts[0].content).not.toContain('overview content placeholder');

  const latestCourseJson = courseJsonPuts[courseJsonPuts.length - 1];
  const topics = (latestCourseJson.modules || []).flatMap((m: any) => m.topics || []);
  const addedTopic = topics.find((t: any) => t.title === 'AI Generated Topic');

  expect(addedTopic).toMatchObject({
    title: 'AI Generated Topic',
    type: 'instruction',
    path: 'instruction/ai-generated-topic/ai-generated-topic.md',
    description: 'Teach orbital staging with a short worked example.',
  });
  expect(addedTopic.id).toBeTruthy();
});

test('adding a topic with an existing slug generates a unique path', async ({ page }) => {
  test.setTimeout(15000);

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

  await context.route(/https:\/\/api\.github\.com\/repos\/ghAccount\/ghRepo\/contents\/instruction\/.*/, async (route: any) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 201, json: { commit: { sha: 'topic-commit-sha' } } });
      return;
    }

    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 404, json: { message: 'Not Found' } });
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

test('sidebar annotates topics with due dates from selected schedule', async ({ page }) => {
  await initBasicCourse({
    page,
    courseJsonOverride: {
      schedule: {
        id: 'a7db85a9-da40-4623-bce2-b99162b416f9',
        files: [{ id: 'default', title: 'Winter', path: 'instruction/schedule/schedule.md', default: true, state: 'published' }],
      },
      modules: [
        {
          title: 'Module 1',
          topics: [
            { id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', title: 'Home', path: 'README.md' },
            { id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f', title: 'Topic 1', type: 'instruction', path: 'instruction/topic-1.md' },
          ],
        },
      ],
    },
  });

  const context = page.context();
  await context.route(/https:\/\/raw\.githubusercontent\.com\/.*\/instruction\/schedule\/schedule\.md$/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: `# Winter 2026 Schedule\n\n| Week | Date | Module | Due | Topics Covered | Slides |\n| :--: | ---- | ------ | --- | -------------- | ------ |\n|  1   | Sat Apr 4, 2026 | Intro | [Topic 1](../topic-1.md) | | |\n`,
    });
  });

  await navigateToCourseNoLogin(page);

  await expect(page.getByRole('button', { name: '▼ Module 1' })).toBeVisible();
  await expect(page.getByText('Topic 1')).toBeVisible();
  await expect(page.getByText('Apr 4')).toBeVisible();
});
