import { test as base, expect } from 'playwright-test-coverage';

function isLocalRequest(url: string) {
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:') || url.startsWith('file:')) {
    return true;
  }

  try {
    const parsed = new URL(url);
    // Keep app and Vite assets/dev-server traffic unblocked.
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}

function isProtectedApiRequest(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const host = parsed.hostname;

  // Domains that must always be mocked in tests.
  if (host === 'api.github.com' || host === 'raw.githubusercontent.com') {
    return true;
  }

  if (host.endsWith('.supabase.co')) {
    return true;
  }

  if (host === 'byu.instructure.com' || host.endsWith('.instructure.com')) {
    return true;
  }

  return false;
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (isLocalRequest(url)) {
        await route.continue();
        return;
      }

      if (isProtectedApiRequest(url)) {
        throw new Error(`Protected API call must be mocked: [${route.request().method()}] ${url}`);
      }

      await route.continue();
    });

    await use(context);
  },
});

export { expect };
