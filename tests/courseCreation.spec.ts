import { test, expect } from 'playwright-test-coverage';
import { initBasicCourse, navigateToDashboard } from './testInit';

test('create course', async ({ page }) => {
  // GitHub - get a user (used to validate token)
  await page.route('https://api.github.com/user', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: { msg: 'success' } });
  });

  // Google Gemini API - generate course structure
  await page.route('https://generativelanguage.googleapis.com/**/*:generateContent', async (route) => {
    expect(route.request().method()).toBe('POST');

    const query = route.request().postDataJSON().contents[0].parts[0].text;

    let response = 'this is a fake Gemini response';
    if (query.includes('Generate a JSON object that contains an appropriate number of modules and topics for a course')) {
      response = `{
        "title": "Example Course Title",
        "description": "Example course description that is relevant to the topics included.",
        "modules": [
            {
            "title": "Example module title",
            "description": "Description for example module.",
            "topics": [
                { "title": "Overview", "description": "Course introduction and objectives.", "path": "README.md", "type": "instruction", "state": "stable" },
                { "title": "Topic 1", "description": "Description for topic 1.", "path": "instruction/topic-1/topic-1.md", "type": "instruction", "state": "stub" },
                { "title": "Topic 2", "description": "Description for topic 2.", "path": "instruction/topic-2/topic-2.md", "type": "instruction", "state": "stub" },
                { "title": "Topic 3", "description": "Description for topic 3.", "path": "instruction/topic-3/topic-3.md", "type": "instruction", "state": "stub" }
            ]
            }
        ]
      }`;
    } else if (query.includes('Create markdown content that provides an overview for a course')) {
      response = `# Welcome to the Example Course Overview`;
    }

    await route.fulfill({
      status: 200,
      json: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: response,
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        modelVersion: 'gemini-2.0-flash',
        responseId: '5kUzaZSOGtmnmtkPkLLpkA4',
      },
    });
  });

  // GitHub - generate repository from template
  await page.route('https://api.github.com/repos/csinstructiontemplate/emptycourse/generate', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ status: 201, json: { msg: 'success' } });
  });

  await initBasicCourse({ page });
  await navigateToDashboard(page);

  await page.getByRole('button', { name: '+' }).click();

  await page.getByRole('textbox', { name: 'Name' }).fill('tacotruck');
  await page.getByRole('textbox', { name: 'Title' }).fill('Taco Truck');
  await page.getByRole('textbox', { name: 'Description' }).fill('All about the taco truck');
  await page.getByRole('textbox', { name: 'Course GitHub Account' }).fill('xyzGitHub');
  await page.getByRole('textbox', { name: 'Course GitHub Repo' }).fill('xyzRepo');
  await page.getByRole('textbox', { name: 'GitHub Token' }).fill('xyzGithubToken');
  await page.getByRole('button', { name: 'Create Course' }).click();

  await expect(page.locator('#root')).toContainText('Taco Truck');
});

test('create from modules.md', async ({ page }) => {
  // This needs to be converted from how it was done on load to where it is now on create
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

  await expect(page.getByRole('banner')).toContainText('💡 Rocket Science');
  await expect(page.getByText('안녕하세요')).toBeVisible();
  await expect(page.getByText('markdown!')).toBeVisible();
});
