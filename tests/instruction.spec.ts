import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse } from './testInit';

test('load from course.json', async ({ page }) => {
  await initBasicCourse({ page });

  await page.goto('http://localhost:5173/');
  await expect(page.getByRole('banner')).toContainText('💡 QA & DevOps');
  await expect(page.getByRole('button', { name: '▶', exact: true })).toBeVisible();
  await expect(page.getByText('Module 1')).toBeVisible();
  await expect(page.getByText('markdown!')).toBeVisible();
});

test('load from modules.md', async ({ page }) => {
  const modulesMarkdown = `
# Modules

## Module 1

- [Topic 1](something/more/topic1.md)

## Module 2

- [Topic 2](something/more/topic2.md)
- [Topic 3](https://youtu.be/4-LwodVujTg)
  `;
  await initBasicCourse({ page });

  await page.route('*/**/course.json', async (route) => {
    await route.fulfill({ status: 404, body: 'Not Found' });
  });

  await page.route('*/**/modules.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: modulesMarkdown });
  });

  await page.goto('http://localhost:5173/');
  await expect(page.getByRole('banner')).toContainText('💡 devops');
  await expect(page.getByText('Course info')).toBeVisible();
  await expect(page.getByText('markdown!')).toBeVisible();
});

test('editor', async ({ page }) => {
  await initBasicCourse({ page });

  await page.goto('http://localhost:5173/');

  await page.getByRole('button', { name: '✏️' }).click();
  await expect(page.getByRole('textbox')).toContainText('# Home markdown!');

  await expect(page.getByRole('button', { name: 'README.md markdown • 2.6 KB' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).click();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).toBeChecked();
});

test('video', async ({ page }) => {
  await initBasicCourse({ page });

  await page.goto('http://localhost:5173/');

  await page.getByRole('button', { name: '▶ Module 2' }).click();
  await page.getByText('topic 3').click();

  await expect(page.locator('iframe[title="YouTube video player"]')).toBeVisible();
});
