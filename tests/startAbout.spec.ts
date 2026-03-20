import { test, expect } from './fixtures';
import { initBasicCourse } from './testInit';

test('start page links to About and Demo Courses', async ({ page }) => {
  await initBasicCourse({ page });
  await page.goto('http://localhost:5173/');

  await expect(page.getByRole('heading', { name: 'MasteryLS', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Demo( courses)?/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'About' })).toBeVisible();

  await page.getByRole('button', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { name: 'What is Mastery LS?' })).toBeVisible();

  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: /Demo( courses)?/ }).click();
  await expect(page).toHaveURL(/\/demo-courses$/);
  await expect(page.getByRole('heading', { name: 'Try a course' })).toBeVisible();
});

test('about page shows intro, centered tour section, and feature section', async ({ page }) => {
  await initBasicCourse({ page });
  await page.goto('http://localhost:5173/about');

  await expect(page.getByRole('heading', { name: 'What is Mastery LS?' })).toBeVisible();
  await expect(page.getByText('Mastery LS is a modern learning platform')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Take a tour with us' })).toBeVisible();
  const video = page.locator('iframe[title="YouTube video player"]');
  await expect(video).toBeVisible();
  await expect(video.locator('xpath=..')).toHaveClass(/flex\s+justify-center/);

  await expect(page.getByRole('heading', { name: 'Why Learn with Mastery LS?' })).toBeVisible();
  await expect(page.getByText('AI Adaptive Learning')).toBeVisible();
});

test('demo courses page lists browseable course catalog and navigates to course', async ({ page }) => {
  await initBasicCourse({ page });
  await page.goto('http://localhost:5173/demo-courses');

  await expect(page.getByRole('heading', { name: 'Try a course' })).toBeVisible();
  await expect(page.getByRole('option', { name: /Rocket Science/ })).toBeVisible();

  await page.getByRole('option', { name: /Rocket Science/ }).click();
  await expect(page).toHaveURL(/\/course\//);
  await expect(page.getByRole('banner')).toContainText('Rocket Science');
});
