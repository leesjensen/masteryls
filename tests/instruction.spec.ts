import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse } from './testInit';

test('load from course.json', async ({ page }) => {
  await initBasicCourse({ page });

  await page.goto('http://localhost:5173/');
  await expect(page.getByRole('banner')).toContainText('💡 QA & DevOps');
  await expect(page.getByRole('button', { name: '▶', exact: true })).toBeVisible();
  await expect(page.getByText('Module 1')).toBeVisible();

  await expect(page.getByText('markdown!')).toBeVisible();

  await expect(page.getByRole('list').filter({ hasText: 'Item 1' })).toBeVisible();

  await expect(page.getByText('NOTE This is a note.')).toBeVisible();
  await expect(page.getByText('TIP This is a tip.')).toBeVisible();
  await expect(page.getByText('CAUTION This is a caution.')).toBeVisible();
  await expect(page.getByText('WARNING This is a warning.')).toBeVisible();
  await expect(page.getByText('IMPORTANT This is an important.')).toBeVisible();

  await page
    .locator('div')
    .filter({ hasText: /^Is it working\?$/ })
    .click();

  await page.getByRole('blockquote').click();

  await page.getByRole('separator').click();

  await expect(page.getByText('😄 🚀 🎉 👍')).toBeVisible();

  await expect(page.getByRole('img', { name: 'Stock Photo' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'relative image' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'relative image' })).toHaveAttribute('src', 'https://raw.githubusercontent.com/devops329/devops/main/path/relative.svg');
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
