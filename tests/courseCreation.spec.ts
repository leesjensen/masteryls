import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToDashboard, navigateToCourse } from './testInit';

async function blockExternalProviders(page: any) {
  const context = page.context();

  await context.route(/https:\/\/api\.github\.com\/.*/, async (route) => {
    throw new Error(`Unmocked GitHub endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  await context.route(/https:\/\/raw\.githubusercontent\.com\/.*/, async (route) => {
    throw new Error(`Unmocked raw GitHub endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  await context.route(/.*supabase\.co\/.*/, async (route) => {
    throw new Error(`Unmocked Supabase endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  await context.route(/https:\/\/generativelanguage\.googleapis\.com\/.*/, async (route) => {
    throw new Error(`Unmocked Gemini endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });
}

async function mockCourseCreationExternalRequests(
  page: any,
  {
    tokenValid = true,
    hasCourseJson = true,
    templateReposByAccount = {
      csinstructiontemplate: ['examplecourse'],
      byucs: ['project-template', 'capstone-template'],
    },
    modulesMarkdown = '## Module 1\n- [Topic 1](topic1.md)\n',
  }: {
    tokenValid?: boolean;
    hasCourseJson?: boolean;
    templateReposByAccount?: Record<string, string[]>;
    modulesMarkdown?: string;
  } = {},
) {
  const context = page.context();

  await context.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    const templateAccountMatch = path.match(/^\/users\/([^/]+)\/repos$/);
    if (templateAccountMatch && method === 'GET') {
      const account = templateAccountMatch[1];
      const repos = (templateReposByAccount[account] || []).map((name) => ({ name, is_template: true }));
      await route.fulfill({ status: 200, json: repos });
      return;
    }

    if (path === '/user' && method === 'GET') {
      await route.fulfill({ status: tokenValid ? 200 : 401, json: tokenValid ? { login: 'mock-user' } : { message: 'Bad credentials' } });
      return;
    }

    if (/^\/repos\/[^/]+\/[^/]+\/generate$/.test(path) && method === 'POST') {
      await route.fulfill({ status: 201, json: { id: 123, name: 'generated-course-repo' } });
      return;
    }

    if (/^\/repos\/[^/]+\/[^/]+$/.test(path) && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: {
          name: 'generated-course-repo',
          default_branch: 'main',
        },
      });
      return;
    }

    if (/^\/repos\/[^/]+\/[^/]+\/git\/trees\/[^/]+$/.test(path) && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: {
          sha: 'treesha123',
          tree: [
            { path: 'README.md', type: 'blob' },
            { path: 'instruction/modules.md', type: 'blob' },
            { path: 'instruction/topic1.md', type: 'blob' },
          ],
          truncated: false,
        },
      });
      return;
    }

    if (/^\/repos\/[^/]+\/[^/]+\/contents$/.test(path) && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: [{ name: 'README.md', path: 'README.md', type: 'file' }],
      });
      return;
    }

    if (/\/contents\/course\.json$/.test(path) && method === 'GET') {
      await route.fulfill({ status: 200, json: { sha: 'previoussha123' } });
      return;
    }

    if (/\/contents\/(course\.json|README\.md)$/.test(path) && method === 'PUT') {
      await route.fulfill({ status: 201, json: { commit: { sha: 'fakecommitsha123' } } });
      return;
    }

    throw new Error(`Unmocked GitHub endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  await context.route('https://raw.githubusercontent.com/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/course.json')) {
      if (!hasCourseJson) {
        await route.fulfill({ status: 404, body: 'Not found' });
        return;
      }
      await route.fulfill({
        status: 200,
        json: {
          title: 'Loaded Course Definition',
          modules: [{ title: 'Module 1', topics: [{ title: 'Topic 1', path: 'instruction/topic1.md' }] }],
        },
      });
      return;
    }

    if (path.endsWith('/instruction/modules.md')) {
      await route.fulfill({ status: 200, body: modulesMarkdown, contentType: 'text/plain; charset=utf-8' });
      return;
    }

    if (path.endsWith('.md')) {
      await route.fulfill({ status: 200, body: '# Mock Topic', contentType: 'text/plain; charset=utf-8' });
      return;
    }

    throw new Error(`Unmocked raw GitHub endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });
}

async function mockAiCourseGenerationRequests(page: any) {
  const context = page.context();

  await context.route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        json: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify(
                      {
                        title: 'Generated Course',
                        description: 'Generated description',
                        modules: [
                          {
                            title: 'Module 1',
                            description: 'Module overview',
                            topics: [
                              {
                                title: 'Overview',
                                description: 'Course intro',
                                path: 'README.md',
                                type: 'instruction',
                                state: 'published',
                              },
                            ],
                          },
                        ],
                      },
                      null,
                      2,
                    ),
                  },
                ],
              },
            },
          ],
        },
      });
      return;
    }

    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    throw new Error(`Unmocked Gemini endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });
}

async function openCourseCreationForm(page: any) {
  await page.getByRole('button', { name: 'New course' }).click();
  await expect(page.getByRole('heading', { name: 'Create a Course' })).toBeVisible();
}

async function fillRequiredCourseFields(page: any) {
  await page.getByLabel('Name').fill('cs999');
  await page.getByLabel('Title').fill('Advanced Testing');
  await page.locator('#course-description').fill('A course to validate robust testing and tooling workflows.');
  await page.getByLabel('Course GitHub Account').fill('mock-owner');
  await page.getByLabel('Course GitHub Repo').fill('mock-repo');
  await page.getByLabel('GitHub Token').fill('mock-token');
}

test('Course Creation displays course creation form', async ({ page }) => {
  await blockExternalProviders(page);
  await initBasicCourse({ page });
  await mockCourseCreationExternalRequests(page);

  await navigateToDashboard(page);
  await openCourseCreationForm(page);

  await expect(page.getByRole('button', { name: 'Create Course' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('Course Creation prevents creation when required fields are empty', async ({ page }) => {
  await blockExternalProviders(page);
  await initBasicCourse({ page });
  await mockCourseCreationExternalRequests(page);

  await navigateToDashboard(page);
  await openCourseCreationForm(page);

  await expect(page.getByRole('button', { name: 'Create Course' })).toBeDisabled();
  await page.getByLabel('Title').fill('Only title');
  await expect(page.getByRole('button', { name: 'Create Course' })).toBeDisabled();
});

test('Course Creation shows error for invalid GitHub token', async ({ page }) => {
  await blockExternalProviders(page);
  await initBasicCourse({ page });
  await mockCourseCreationExternalRequests(page, { tokenValid: false });

  await navigateToDashboard(page);
  await openCourseCreationForm(page);
  await fillRequiredCourseFields(page);

  await page.getByRole('button', { name: 'Create Course' }).click();

  await expect(page.getByText('The provided GitHub token does not have the necessary permissions to create a course.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create a Course' })).toBeVisible();
});

test('Course Creation toggles template fields when AI checkbox is toggled', async ({ page }) => {
  await blockExternalProviders(page);
  await initBasicCourse({ page });
  await mockCourseCreationExternalRequests(page);

  await navigateToDashboard(page);
  await openCourseCreationForm(page);

  const sourceAccountInput = page.getByLabel('Source GitHub Account');
  await expect(sourceAccountInput).toBeVisible();

  await page.getByLabel('Generate course from description').check();
  await expect(sourceAccountInput).not.toBeVisible();

  await page.getByLabel('Generate course from description').uncheck();
  await expect(sourceAccountInput).toBeVisible();
});

test('Course Creation creates course with AI generation', async ({ page }) => {
  await blockExternalProviders(page);
  await initBasicCourse({ page });
  await mockCourseCreationExternalRequests(page);
  await mockAiCourseGenerationRequests(page);

  await navigateToDashboard(page);
  await openCourseCreationForm(page);

  await fillRequiredCourseFields(page);
  await page.getByLabel('Generate course from description').check();

  await page.getByRole('button', { name: 'Create Course' }).click();

  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Error creating course')).not.toBeVisible();
});

test('Course Creation updates template options when source account changes', async ({ page }) => {
  await blockExternalProviders(page);
  await initBasicCourse({ page });
  await mockCourseCreationExternalRequests(page, {
    templateReposByAccount: {
      csinstructiontemplate: ['examplecourse'],
      byucs: ['alpha-template', 'beta-template'],
    },
  });

  await navigateToDashboard(page);
  await openCourseCreationForm(page);

  await expect(page.locator('select#source-gitHub-template option[value="examplecourse"]')).toHaveCount(1);
  await page.getByLabel('Source GitHub Account').fill('byucs');

  await expect(page.locator('select#source-gitHub-template option[value="alpha-template"]')).toHaveCount(1);
  await expect(page.locator('select#source-gitHub-template option[value="beta-template"]')).toHaveCount(1);
});

test('Course Creation creates course from template', async ({ page }) => {
  await blockExternalProviders(page);
  await initBasicCourse({ page });
  await mockCourseCreationExternalRequests(page);

  await navigateToDashboard(page);
  await openCourseCreationForm(page);
  await fillRequiredCourseFields(page);

  await page.getByLabel('Source GitHub Template').selectOption('examplecourse');
  await page.getByRole('button', { name: 'Create Course' }).click();

  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Error creating course')).not.toBeVisible();
});

test('Course Creation falls back to modules.md when course.json is missing', async ({ page }) => {
  await blockExternalProviders(page);
  await initBasicCourse({ page });
  await mockCourseCreationExternalRequests(page, {
    hasCourseJson: false,
    modulesMarkdown: '## Week 1\n- [Introduction](intro.md)\n- [Project setup](setup.md)\n',
  });

  await navigateToDashboard(page);
  await openCourseCreationForm(page);
  await fillRequiredCourseFields(page);

  await page.getByRole('button', { name: 'Create Course' }).click();

  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Error creating course')).not.toBeVisible();
});

test('Course Creation closes when Cancel button is clicked', async ({ page }) => {
  await blockExternalProviders(page);
  await initBasicCourse({ page });
  await mockCourseCreationExternalRequests(page);

  await navigateToDashboard(page);
  await openCourseCreationForm(page);

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible();
});
