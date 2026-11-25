import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

const TOPIC1_ID = '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f';

test('a public course topic page exposes indexable SEO metadata', async ({ page }) => {
  await initBasicCourse({ page, catalogSettingsOverride: { public: true } });
  await navigateToCourse(page);
  await page.getByText('topic 1').click();

  // The shell's single robots tag is flipped to index,follow (not duplicated) for a public topic.
  await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/course/[^/]+/topic/${TOPIC1_ID}$`));
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /topic 1/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
  await expect(page.locator('script[data-seo-jsonld]')).toHaveCount(1);
});

test('a non-public course topic page stays noindex', async ({ page }) => {
  await initBasicCourse({ page }); // default catalog is not public
  await navigateToCourse(page);
  await page.getByText('topic 1').click();

  await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
});
