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

// Records whether <html> is dark when <body> first appears: after index.html's pre-paint script, before
// React. Without it a reload check passes even if that script breaks, because the hook adds the class later.
async function recordFirstPaintTheme(page: any) {
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (!document.body) return;
      (window as any).__darkAtFirstPaint = document.documentElement.classList.contains('dark');
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
}

function darkAtFirstPaint(page: any) {
  return page.evaluate(() => (window as any).__darkAtFirstPaint);
}

async function setup(page: any) {
  await recordFirstPaintTheme(page);
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

  function themeButton(label: 'Auto' | 'Light' | 'Dark') {
    return page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: label });
  }

  async function chooseTheme(label: 'Auto' | 'Light' | 'Dark') {
    const button = themeButton(label);
    if (!(await button.isVisible())) await page.getByRole('button', { name: 'User Menu' }).click();
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }

  return { expectDark, expectLight, chooseTheme, themeButton };
}

test('dark mode can be chosen from the user menu and persists across reloads', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const { expectDark, expectLight, chooseTheme } = await setup(page);

  await expectLight();

  await chooseTheme('Dark');
  await expectDark();

  await page.reload();
  expect(await darkAtFirstPaint(page)).toBe(true);
  await expectDark();

  await chooseTheme('Light');
  await expectLight();
});

test('the Auto theme follows the system setting, live and on first paint', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const { expectDark, expectLight, chooseTheme, themeButton } = await setup(page);

  await expectDark();
  await page.getByRole('button', { name: 'User Menu' }).click();
  await expect(themeButton('Auto')).toHaveAttribute('aria-pressed', 'true');

  await page.emulateMedia({ colorScheme: 'light' });
  await expectLight();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectDark();

  await chooseTheme('Light');
  await expectLight();
  await page.reload();
  expect(await darkAtFirstPaint(page)).toBe(false);
  await expectLight();

  await chooseTheme('Auto');
  await expectDark();
  await page.reload();
  expect(await darkAtFirstPaint(page)).toBe(true);
  await expectDark();
});

test('a theme chosen in one tab is applied in the other open tabs', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const { chooseTheme } = await setup(page);

  const otherTab = await page.context().newPage();
  await otherTab.emulateMedia({ colorScheme: 'light' });
  await otherTab.goto(page.url());
  // Wait for the app to mount; otherwise it could just read the stored choice on startup and pass
  // without the cross-tab listener doing anything.
  await expect(otherTab.getByRole('button', { name: 'User Menu' })).toBeVisible();
  const otherHtml = otherTab.locator('html');
  await expect(otherHtml).not.toHaveClass(/\bdark\b/);

  await chooseTheme('Dark');
  await expect(otherHtml).toHaveClass(/\bdark\b/);

  // Auto removes the stored key, which the other tab reads as "follow the system" (light here).
  await chooseTheme('Auto');
  await expect(otherHtml).not.toHaveClass(/\bdark\b/);
});

test('the system theme still applies when theme storage is blocked', async ({ page }) => {
  // Only the theme key throws, as it would with blocked site data, so the rest of the app runs normally.
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      const original = Storage.prototype[method] as (...args: any[]) => any;
      (Storage.prototype as any)[method] = function (key: string, ...rest: any[]) {
        if (key === 'theme') throw new DOMException('Storage blocked', 'SecurityError');
        return original.call(this, key, ...rest);
      };
    }
  });
  // An uncaught throw from a click handler only reaches the console, so collect it instead.
  const pageErrors: Error[] = [];
  page.on('pageerror', (error: Error) => pageErrors.push(error));
  await page.emulateMedia({ colorScheme: 'dark' });
  const { expectDark, expectLight, chooseTheme } = await setup(page);

  // With nothing stored, a dark first paint looks the same whether or not storage is blocked.
  const storageBlocked = await page.evaluate(() => {
    try {
      localStorage.getItem('theme');
      return false;
    } catch {
      return true;
    }
  });
  expect(storageBlocked).toBe(true);

  expect(await darkAtFirstPaint(page)).toBe(true);
  await expectDark();

  await chooseTheme('Light');
  await expectLight();
  expect(pageErrors).toEqual([]);
});
