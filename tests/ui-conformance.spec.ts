import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, register } from './testInit';

type ViewportName = 'desktop' | 'tablet' | 'mobile';

type BaselineScenario = {
  id: string;
  route: string;
  screenId: string;
  state: string;
  viewport: ViewportName;
  setupProfile: string;
  status: 'required' | 'recommended';
};

type BaselineManifest = {
  uiContract: string;
  baselineVersion: string;
  captureStandard: {
    locale: string;
    timezone: string;
    reducedMotion: boolean;
    colorScheme: 'light' | 'dark';
    viewports: Record<ViewportName, { width: number; height: number }>;
  };
  scenarios: BaselineScenario[];
};

const baselinePath = path.resolve(process.cwd(), 'specification/ui/baselines/ui-conformance-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as BaselineManifest;

const defaultRouteParams = {
  courseId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
  topicId: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
};

test.use({
  locale: baseline.captureStandard.locale,
  timezoneId: baseline.captureStandard.timezone,
});

function resolveRoute(rawRoute: string) {
  return rawRoute.replace(':courseId', defaultRouteParams.courseId).replace(':topicId', defaultRouteParams.topicId);
}

function profileRequiresAuth(setupProfile: string) {
  return !(setupProfile === 'public' || setupProfile === 'publicCatalogSeeded');
}

function scenarioNotYetSupported(scenario: BaselineScenario) {
  if (scenario.route === '/about') return 'about route is specified but not yet implemented';
  if (scenario.route.startsWith('/error/')) return 'typed /error/:code route is specified but not yet implemented';
  if (scenario.state === 'readonlyObserver' || scenario.setupProfile.includes('observer')) return 'observer-mode UI state capture needs observer-mode runtime controls';
  return null;
}

async function applySetupProfile(page: any, setupProfile: string) {
  const context = page.context();

  if (setupProfile === 'learnerNoEnrollment') {
    await context.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
      switch (route.request().method()) {
        case 'GET':
          await route.fulfill({ status: 200, json: [] });
          return;
        case 'POST':
          await route.fulfill({
            status: 201,
            json: {
              id: '50a0dcd2-2b5a-4c4a-b5c3-0751c874d6f5',
              catalogId: defaultRouteParams.courseId,
              learnerId: '15cb92ef-d2d0-4080-8770-999516448960',
              settings: {},
              progress: { mastery: 0 },
            },
          });
          return;
        case 'DELETE':
          await route.fulfill({ status: 204 });
          return;
      }
      throw new Error(`Unmocked enrollment endpoint in setup profile: ${route.request().method()} ${route.request().url()}`);
    });
  }
}

async function stubExternalMedia(page: any) {
  const context = page.context();

  await context.route('https://images.unsplash.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1470" height="980"><rect width="1470" height="980" fill="#e5e7eb"/></svg>',
    });
  });

  await context.route('https://www.youtube.com/embed/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body style="margin:0;background:#e5e7eb;"></body></html>',
    });
  });
}

async function overrideUiCaptureGitHubReads(page: any) {
  const context = page.context();

  await context.route(/https:\/\/api\.github\.com\/users\/[^/]+\/repos\?per_page=100/, async (route) => {
    await route.fulfill({
      status: 200,
      json: [
        { name: 'emptycourse', is_template: true },
        { name: 'starter-template', is_template: true },
      ],
    });
  });

  await context.route(/https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\/.+/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        json: [],
      });
      return;
    }

    throw new Error(`Unmocked GitHub contents call in UI capture override: ${route.request().method()} ${route.request().url()}`);
  });
}

async function disableMotion(page: any) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
      * {
        caret-color: transparent !important;
      }
    `,
  });
}

async function waitForStableUI(page: any) {
  await page.waitForLoadState('networkidle');
  await disableMotion(page);
  await page.waitForTimeout(150);
}

async function applyScenarioState(page: any, scenario: BaselineScenario) {
  if (scenario.screenId === 'ClassroomScreen' && scenario.state === 'editorMode') {
    await page.locator('[title=\"Switch to Edit mode\"]').click();
    await page.waitForTimeout(100);
  }
}

test.describe('UI conformance capture', () => {
  test.skip(!process.env.UI_CONFORMANCE, 'Set UI_CONFORMANCE=1 to run UI conformance captures');

  for (const scenario of baseline.scenarios) {
    test(scenario.id, async ({ page }, testInfo) => {
      const unsupportedReason = scenarioNotYetSupported(scenario);
      test.fixme(!!unsupportedReason, unsupportedReason || '');

      await initBasicCourse({ page });
      await stubExternalMedia(page);
      await overrideUiCaptureGitHubReads(page);
      await applySetupProfile(page, scenario.setupProfile);

      const viewport = baseline.captureStandard.viewports[scenario.viewport];
      await page.setViewportSize(viewport);

      if (profileRequiresAuth(scenario.setupProfile)) {
        await register(page);
      } else {
        await page.goto('/');
      }

      const route = resolveRoute(scenario.route);
      await page.goto(route);
      await waitForStableUI(page);
      await applyScenarioState(page, scenario);
      await waitForStableUI(page);

      const snapshotName = `${scenario.id}.png`;
      if (process.env.UI_CONFORMANCE_ASSERT) {
        await expect(page).toHaveScreenshot(snapshotName, {
          animations: 'disabled',
          caret: 'hide',
        });
      } else {
        const outputPath = testInfo.outputPath(snapshotName);
        await page.screenshot({
          path: outputPath,
          fullPage: false,
          animations: 'disabled',
          caret: 'hide',
        });

        testInfo.attachments.push({
          name: `capture-${scenario.id}`,
          path: outputPath,
          contentType: 'image/png',
        });

        expect(fs.existsSync(outputPath)).toBe(true);
      }
    });
  }
});
