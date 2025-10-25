import { expect } from 'playwright-test-coverage';

const catalog = [
  {
    id: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
    name: 'cs329',
    title: 'QA & DevOps',
    description: 'This course provides you with the experience and skills necessary to deploy, manage, and ensure the quality of a modern software application. This includes automated testing at all levels, continuous integration and deployment pipelines, application monitoring, failure detection, alerting, and elastic application scaling.',
    links: {
      chat: 'https://discord.com/channels/748656649287368704',
      canvas: 'https://byu.instructure.com/courses/31151',
    },
    gitHub: {
      account: 'devops329',
      repository: 'devops',
    },
  },
  {
    id: '8817e5a2-025e-467b-95cf-3afcf90f4cf0',
    name: 'cs240',
    title: 'Software construction',
    description: 'Advanced Software Construction provides you with the experience and skills necessary to use a modern programming language in an advanced development environment to design, test, and build a large multi-user application. Your application will have a client frontend program that communicates, over the network, with a centralized backend server.',
    links: {
      chat: 'https://discord.com/channels/748656649287368704',
      canvas: 'https://byu.instructure.com/courses/31151',
    },
    gitHub: {
      account: 'softwareconstruction240',
      repository: 'softwareconstruction',
    },
  },
  {
    id: 'e453da9a-b61d-45fa-894e-de4f221462a8',
    name: 'cs260',
    title: 'Web Programming',
    description: 'Web programming gives you practical experience with important aspects of computer science. This includes distributed systems, security, concurrency, networking, caching, data structures, databases, asynchronous execution, protocols, and efficiency.',
    links: {
      chat: 'https://discord.com/channels/748656649287368704',
      canvas: 'https://byu.instructure.com/courses/31151',
    },
    gitHub: {
      account: 'webprogramming260',
      repository: '.github',
    },
  },
];

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
        { title: 'topic 1', type: 'exam', path: 'something/more/topic1.md' },
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

const topicFiles = [
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

const defaultTopicMarkdown = `
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

async function initBasicCourse({ page, topicMarkdown = defaultTopicMarkdown }: { page: any; topicMarkdown?: string }) {
  const context = page.context();

  // Supabase - Catalog table access
  await context.route(/.*supabase.co\/rest\/v1\/catalog(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'GET':
        await route.fulfill({
          json: catalog,
        });
        break;
    }
  });

  // Supabase - user table access
  await context.route(/.*supabase.co\/rest\/v1\/user(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        await route.fulfill({ status: 201 });
        break;
      case 'GET':
        await route.fulfill({
          json: [
            {
              id: '15cb92ef-d2d0-4080-8770-999516448960',
              name: 'Bud',
              email: 'bud@cow.com',
              settings: {
                language: 'en',
              },
            },
          ],
        });
        break;
    }
  });

  // Supabase - role table access
  await context.route(/.*supabase.co\/rest\/v1\/role(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        await route.fulfill({ status: 201 });
        break;
      case 'GET':
        await route.fulfill({
          json: [
            {
              user: '15cb92ef-d2d0-4080-8770-999516448960',
              right: 'editor',
              object: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
              settings: {
                token: 'xxxx',
              },
            },
            {
              user: '15cb92ef-d2d0-4080-8770-999516448960',
              right: 'editor',
              object: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
              settings: {
                token: 'xxxx',
              },
            },
          ],
        });
        break;
    }
  });

  // Supabase - Enrollment table access
  await context.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        await route.fulfill({ status: 201 });
        break;
      case 'GET':
        await route.fulfill({
          json: [
            {
              id: '50a0dcd2-2b5a-4c4a-b5c3-0751c874d6f5',
              catalogId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
              learnerId: '15cb92ef-d2d0-4080-8770-999516448960',
              settings: {},
              progress: {
                mastery: 0,
              },
            },
          ],
        });
        break;
      case 'DELETE':
        await route.fulfill({ status: 204 });
        break;
    }
  });

  // Supabase - Sign up
  await context.route('**/auth/v1/signup', async (route) => {
    if (route.request().method() === 'POST') {
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

  // Supabase - Progress
  await context.route(/.*supabase.co\/rest\/v1\/progress(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        await route.fulfill({
          status: 201,
          json: {
            id: '0546cf7c-697b-4bc5-b98d-f409d78ec550',
            createdAt: '2025-10-21T23:13:47.033173+00:00',
            userId: '158e4c68-732a-4e8c-ae3e-bf06ee1cec6f',
            enrollmentId: null,
            activityId: '77166861-eaec-440b-b701-b45445853514',
            duration: 6,
            type: 'instructionView',
            details: {},
            catalogId: 'dd48e7ef-8b47-4d99-88df-1c0295ef1c29',
            topicId: '77166861-eaec-440b-b701-b45445853514',
          },
        });
        break;
    }
  });

  // GitHub - API request for to list contents of a directory
  await context.route('https://api.github.com/**/contents', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: topicFiles });
  });

  // GitHub - API request for specific file
  await context.route('https://api.github.com/**/contents/README.md', async (route) => {
    switch (route.request().method()) {
      case 'PUT':
        await route.fulfill({ status: 201 });
        break;
      case 'GET':
        await route.fulfill({ json: topicFiles[0] });
        break;
      default:
        await route.continue();
        break;
    }
  });

  // GitHub - Get a specific topic SVG file
  await context.route('https://raw.githubusercontent.com/**/path/relative.svg', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({
      body: '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="blue"/></svg>',
      contentType: 'image/svg+xml',
    });
  });

  // GitHub - Get the course description file
  await context.route('https://raw.githubusercontent.com/**/course.json', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: courseJson });
  });

  // GitHub - Get any markdown file
  await context.route('https://raw.githubusercontent.com/**/*.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: topicMarkdown });
  });
}

async function navigateToCourse(page: any) {
  await page.goto('http://localhost:5173/');

  await _register(page);

  await page.getByRole('button', { name: 'Q QA & DevOps' }).click();
}

async function register(page: any) {
  await page.goto('http://localhost:5173/');
  await _register(page);
}

async function _register(page: any) {
  await page.getByRole('button', { name: "Don't have an account? Create" }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Bud');
  await page.getByRole('textbox', { name: 'Email' }).fill('bud@cow.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('toomanysecrets');
  await page.getByRole('button', { name: 'Create Account' }).click();
}

export { initBasicCourse, navigateToCourse, register };
