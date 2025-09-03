import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToCourse } from './testInit';

test('load from course.json', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await expect(page.getByRole('banner')).toContainText('💡 QA & DevOps');
  await expect(page.getByRole('button', { name: '▶', exact: true })).toBeVisible();
  await expect(page.getByText('Module 1')).toBeVisible();
  await expect(page.getByText('markdown!')).toBeVisible();
});

test('load from modules.md', async ({ page }) => {
  const modulesMarkdown = `
# Modules

## 안녕하세요

- [Topic 1](something/more/topic1.md)

## 반갑습니다!

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

  await navigateToCourse(page);

  await expect(page.getByRole('banner')).toContainText('💡 QA & DevOps');
  await expect(page.getByText('안녕하세요')).toBeVisible();
  await expect(page.getByText('markdown!')).toBeVisible();
});

test('instruction types all', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

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

  await expect(page.locator('div').filter({ hasText: /^Is it working\?$/ })).toBeVisible();

  await expect(page.getByRole('blockquote')).toBeVisible();

  await expect(page.getByRole('separator')).toBeVisible();

  await expect(page.getByText('😄 🚀 🎉 👍')).toBeVisible();

  await expect(page.getByRole('img', { name: 'Stock Photo' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'relative image' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'relative image' })).toHaveAttribute('src', 'https://raw.githubusercontent.com/devops329/devops/main/path/relative.svg');
});

test('video', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToCourse(page);

  await page.getByRole('button', { name: '▶ Module 2' }).click();
  await page.getByText('topic 3').click();

  await expect(page.locator('iframe[title="YouTube video player"]')).toBeVisible();
});
