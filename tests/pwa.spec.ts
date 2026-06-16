import { test, expect } from './fixtures';

test('app shell exposes PWA metadata', async ({ page }) => {
  await page.route('**/rest/v1/catalog*', async (route) => {
    await route.fulfill({ status: 200, json: [] });
  });
  await page.goto('/');

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#20508b');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test('app shell shows install affordance when beforeinstallprompt fires', async ({ page }) => {
  await page.route('**/rest/v1/catalog*', async (route) => {
    await route.fulfill({ status: 200, json: [] });
  });
  await page.goto('/');

  await page.evaluate(() => {
    class MockBeforeInstallPromptEvent extends Event {
      constructor() {
        super('beforeinstallprompt');
      }

      prompt() {
        return Promise.resolve();
      }

      get userChoice() {
        return Promise.resolve({ outcome: 'accepted', platform: 'web' });
      }
    }

    window.dispatchEvent(new MockBeforeInstallPromptEvent());
  });

  await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible();
});
