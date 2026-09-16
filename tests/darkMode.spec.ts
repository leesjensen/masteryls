import { test, expect } from './fixtures';
import { initBasicCourse, navigateToDashboard } from './testInit';

// Relative luminance (WCAG): 0 is black, 1 is white. Painting the computed colour onto a canvas
// normalises any CSS format (rgb, oklch, ...) to sRGB, so this works whatever the theme is written in.
async function luminance(locator: any, property: 'backgroundColor' | 'color') {
  return locator.evaluate((element: Element, prop: string) => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.fillStyle = getComputedStyle(element)[prop];
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, alpha] = ctx.getImageData(0, 0, 1, 1).data;
    const linear = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    // A transparent colour isn't really "dark" or "light", so report it as a failure-friendly NaN.
    if (alpha < 255) return NaN;
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  }, property);
}

test('dark mode toggles from the user menu and persists across reloads', async ({ page }) => {
  await initBasicCourse({ page });
  await navigateToDashboard(page);

  const html = page.locator('html');
  const body = page.locator('body');
  const heading = page.getByRole('heading', { name: /You are enrolled in/ });
  const card = page.locator('section').filter({ has: heading });

  // Page, a bg-white card, and its text: covers both the body rule and the Tailwind variable remapping.
  async function expectDark() {
    await expect(html).toHaveClass(/\bdark\b/);
    await expect.poll(() => luminance(body, 'backgroundColor')).toBeLessThan(0.05);
    await expect.poll(() => luminance(card, 'backgroundColor')).toBeLessThan(0.05);
    await expect.poll(() => luminance(heading, 'color')).toBeGreaterThan(0.5);
  }

  async function expectLight() {
    await expect(html).not.toHaveClass(/\bdark\b/);
    await expect.poll(() => luminance(body, 'backgroundColor')).toBeGreaterThan(0.9);
    await expect.poll(() => luminance(card, 'backgroundColor')).toBeGreaterThan(0.9);
    await expect.poll(() => luminance(heading, 'color')).toBeLessThan(0.2);
  }

  await expectLight();

  await page.getByRole('button', { name: 'User Menu' }).click();
  const toggle = page.getByRole('switch', { name: 'Dark mode' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expectDark();

  await page.reload();
  await expectDark();

  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await expectLight();
});
