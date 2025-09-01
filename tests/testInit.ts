import { expect } from 'playwright-test-coverage';

const courseJson = {
  title: 'QA & DevOps',
  schedule: 'schedule/schedule.md',
  syllabus: 'instruction/syllabus/syllabus.md',
  links: {
    canvas: 'https://byu.instructure.com/courses/31151',
    chat: 'https://discord.com/channels/748656649287368704',
  },
  modules: [
    {
      title: 'Module 1',
      topics: [
        { title: 'Home', path: 'README.md' },
        { title: 'topic 1', type: 'quiz', path: 'something/more/topic1.md' },
      ],
    },
    {
      title: 'Module 2',
      topics: [
        { title: 'topic 2', path: 'something/more/topic2.md' },
        { title: 'topic 3', type: 'video', path: 'https://youtu.be/4-LwodVujTg' },
      ],
    },
  ],
};

const topicContents = [
  {
    name: 'README.md',
    path: 'README.md',
    sha: 'cd54f565190cb64e5b8fb63d05df57b975997385',
    size: 2691,
    url: 'https://api.github.com/repos/devops329/devops/contents/README.md?ref=main',
    html_url: 'https://github.com/devops329/devops/blob/main/README.md',
    git_url: 'https://api.github.com/repos/devops329/devops/git/blobs/cd54f565190cb64e5b8fb63d05df57b975997385',
    download_url: 'https://raw.githubusercontent.com/devops329/devops/main/README.md',
    type: 'file',
    _links: {
      self: 'https://api.github.com/repos/devops329/devops/contents/README.md?ref=main',
      git: 'https://api.github.com/repos/devops329/devops/git/blobs/cd54f565190cb64e5b8fb63d05df57b975997385',
      html: 'https://github.com/devops329/devops/blob/main/README.md',
    },
  },
  {
    name: 'byuLogo.png',
    path: 'byuLogo.png',
    sha: 'e9d693e97087e22e0c4d4dde4123287d457e25e8',
    size: 16355,
    url: 'https://api.github.com/repos/devops329/devops/contents/byuLogo.png?ref=main',
    html_url: 'https://github.com/devops329/devops/blob/main/byuLogo.png',
    git_url: 'https://api.github.com/repos/devops329/devops/git/blobs/e9d693e97087e22e0c4d4dde4123287d457e25e8',
    download_url: 'https://raw.githubusercontent.com/devops329/devops/main/byuLogo.png',
    type: 'file',
    _links: {
      self: 'https://api.github.com/repos/devops329/devops/contents/byuLogo.png?ref=main',
      git: 'https://api.github.com/repos/devops329/devops/git/blobs/e9d693e97087e22e0c4d4dde4123287d457e25e8',
      html: 'https://github.com/devops329/devops/blob/main/byuLogo.png',
    },
  },
];

const defaultMarkdown = `
# Home

markdown!

## Lists

* Item 1
1. Item 2


## Emoji

:smile: :rocket: :tada: :+1:

## Alert

> [!NOTE]
> This is a note.

> [!TIP]
> This is a tip.

> [!CAUTION]
> This is a caution.

> [!WARNING]
> This is a warning.

> [!IMPORTANT]
>
> This is an important.


## Blockquote

> This is a blockquote.

## Horizontal Rule

---

## Mermaid Diagram

\`\`\`mermaid
graph TD;
  A[Start] --> B{Is it working?};
  B -- Yes --> C[Great!];
\`\`\`

# Images

![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=100)

![relative image](path/relative.svg)
`;

async function initBasicCourse({ page, topicMarkdown = defaultMarkdown }: { page: any; topicMarkdown?: string }) {
  const context = page.context();

  // Handle OPTIONS separately with a more specific pattern
  await context.route('**/auth/v1/signup', async (route) => {
    if (route.request().method() === 'POST') {
      console.log('POST intercepted for:', route.request().url());
      await route.fulfill({
        json: {
          id: '15cb92ef-d2d0-4080-8770-999516448960',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'bud@cow.com',
          phone: '',
          confirmation_sent_at: '2025-09-01T14:16:59.817650523Z',
          app_metadata: {
            provider: 'email',
            providers: ['email'],
          },
          user_metadata: {
            email: 'bud@cow.com',
            email_verified: false,
            phone_verified: false,
            sub: '15cb92ef-d2d0-4080-8770-999516448960',
          },
          identities: [
            {
              identity_id: 'da62636e-7136-4157-b189-fabd7e220a30',
              id: '15cb92ef-d2d0-4080-8770-999516448960',
              user_id: '15cb92ef-d2d0-4080-8770-999516448960',
              identity_data: {
                email: 'bud@cow.com',
                email_verified: false,
                phone_verified: false,
                sub: '15cb92ef-d2d0-4080-8770-999516448960',
              },
              provider: 'email',
              last_sign_in_at: '2025-09-01T14:13:46.21866Z',
              created_at: '2025-09-01T14:13:46.218719Z',
              updated_at: '2025-09-01T14:13:46.218719Z',
              email: 'bud@cow.com',
            },
          ],
          created_at: '2025-09-01T14:13:46.154132Z',
          updated_at: '2025-09-01T14:17:00.166842Z',
          is_anonymous: false,
        },
      });
      return;
    }
    await route.continue();
  });

  await context.route('*/**/path/relative.svg', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({
      body: '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="blue"/></svg>',
      contentType: 'image/svg+xml',
    });
  });

  await context.route('*/**/course.json', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: courseJson });
  });

  await context.route('*/**/README.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: topicMarkdown });
  });

  await context.route('*/**/contents', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: topicContents });
  });

  await context.route('*/**/topic1.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: topicMarkdown });
  });
}

async function navigateToCourse(page: any) {
  await page.goto('http://localhost:5173/');

  // await page.getByRole('button', { name: 'Login / Register' }).click();
  await page.getByRole('button', { name: "Don't have an account? Create" }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Bud');
  await page.getByRole('textbox', { name: 'Email' }).fill('bud@cow.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('toomanysecrets');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.getByRole('button', { name: 'Q QA & DevOps Description for' }).click();
  await page.getByRole('button', { name: 'Q QA & DevOps Description for' }).click();
}

async function register(page: any) {
  await page.goto('http://localhost:5173/');

  await page.getByRole('button', { name: "Don't have an account? Create" }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Bud');
  await page.getByRole('textbox', { name: 'Email' }).fill('bud@cow.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('toomanysecrets');
  await page.getByRole('button', { name: 'Create Account' }).click();
}

export { initBasicCourse, navigateToCourse, register };
