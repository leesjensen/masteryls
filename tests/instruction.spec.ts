import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.route('**/course.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'QA & DevOps',
        schedule: 'schedule/schedule.md',
        syllabus: 'instruction/syllabus/syllabus.md',
        links: {
          canvas: 'https://byu.instructure.com/courses/31151',
          chat: 'https://discord.com/channels/748656649287368704',
          gitHub: {
            url: 'https://github.com/devops329/devops/blob/main',
            apiUrl: 'https://api.github.com/repos/devops329/devops/contents',
            rawUrl: 'https://raw.githubusercontent.com/devops329/devops/main',
          },
        },
        modules: [
          {
            title: 'Course info',
            topics: [
              {
                title: 'Home',
                path: 'README.md',
                id: '690b3872aab6442fac17c6730d7502ed',
              },
              {
                title: 'Syllabus',
                path: 'instruction/syllabus/syllabus.md',
                id: 'eb84677c4b7c47b1a40402c63ed07db8',
              },
              {
                title: 'Schedule',
                path: 'schedule/schedule.md',
                id: '4d398bdff38f40108c07a336314519d4',
              },
            ],
          },
        ],
      }),
    })
  );

  await page.route('**/README.md', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '# BYU QA and DevOps `cs329`',
    })
  );

  await page.route('api.github.com/markdown', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '<h1 dir="auto">BYU QA and DevOps <code class="notranslate">cs329</code></h1>',
    })
  );

  https: await page.goto('http://localhost:5173/');

  // await expect(page.locator('section')).toContainText('BYU QA and DevOps cs329');
});
