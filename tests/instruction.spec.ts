import { test, expect } from 'playwright-test-coverage';

test('basic display', async ({ page }) => {
  const courseResponse = {
    title: 'QA & DevOps',
    schedule: 'schedule/schedule.md',
    syllabus: 'instruction/syllabus/syllabus.md',
    links: {
      canvas: 'https://byu.instructure.com/courses/31151',
      chat: 'https://discord.com/channels/748656649287368704',
    },
    modules: [
      {
        title: 'Module 1',
        topics: [{ title: 'Home', path: 'something/more/README.md' }],
      },
    ],
  };

  await page.route('*/**/course.json', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: courseResponse });
  });

  await page.route('*/**/README.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: '# Home\n\nsource markdown!' });
  });

  await page.route('*/**/markdown', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ body: '<h1>Home</h1><p>rendered markdown</p>' });
  });

  await page.goto('http://localhost:5173/');
  await expect(page.getByRole('banner')).toContainText('💡 QA & DevOps');
  await expect(page.getByText('▶')).toBeVisible();
  await expect(page.getByText('Module 1')).toBeVisible();
  await expect(page.getByText('rendered markdown')).toBeVisible();
});
