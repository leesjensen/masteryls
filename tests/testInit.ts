import { expect } from 'playwright-test-coverage';

const users = [
  {
    id: '15cb92ef-d2d0-4080-8770-999516448960',
    name: 'Bud',
    email: 'bud@cow.com',
    settings: {
      language: 'en',
    },
  },
  {
    id: 'afcfefde-6cab-4d49-bdf8-375972c6de3e',
    name: 'Sally',
    email: 'sally@bud.com',
    settings: {
      language: 'en',
    },
  },
];

const catalog = [
  {
    id: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
    name: 'rocksci',
    title: 'Rocket Science',
    description: 'This course provides you with the experience and skills necessary to deploy, manage, and ensure the quality of a modern software application. This includes automated testing at all levels, continuous integration and deployment pipelines, application monitoring, failure detection, alerting, and elastic application scaling.',
    settings: {
      state: 'published',
    },
    gitHub: {
      account: 'ghAccount',
      repository: 'ghRepo',
    },
  },
  {
    id: '8817e5a2-025e-467b-95cf-3afcf90f4cf0',
    name: 'cs240',
    title: 'Software construction',
    description: 'Advanced Software Construction provides you with the experience and skills necessary to use a modern programming language in an advanced development environment to design, test, and build a large multi-user application. Your application will have a client frontend program that communicates, over the network, with a centralized backend server.',
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
    gitHub: {
      account: 'webprogramming260',
      repository: '.github',
    },
  },
];

const courseJson = {
  title: 'Rocket Science',
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
        { id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', title: 'Home', path: 'README.md' },
        { id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f', title: 'topic 1', type: 'instruction', path: 'something/more/topic1.md' },
        { id: '564d5e6f-9999-9c0d-1e2f-ffff5c6d7777', title: 'exam', type: 'exam', path: 'something/exam.md' },
      ],
    },
    {
      title: 'Module 2',
      topics: [
        { id: '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b', title: 'topic 2', path: 'something/more/topic2.md' },
        { id: '6f7a8b9c-0d1e-2f3a-4b5c-6d7e8f9a0b1c', title: 'topic 3', type: 'video', path: 'https://youtu.be/4-LwodVujTg' },
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
    url: 'https://api.github.com/repos/ghAccount/ghRepo/contents/README.md?ref=main',
    html_url: 'https://github.com/ghAccount/ghRepo/blob/main/README.md',
    git_url: 'https://api.github.com/repos/ghAccount/ghRepo/git/blobs/cd54f565190cb64e5b8fb63d05df57b975997385',
    download_url: 'https://raw.githubusercontent.com/ghAccount/ghRepo/main/README.md',
    type: 'file',
    _links: {
      self: 'https://api.github.com/repos/ghAccount/ghRepo/contents/README.md?ref=main',
      git: 'https://api.github.com/repos/ghAccount/ghRepo/git/blobs/cd54f565190cb64e5b8fb63d05df57b975997385',
      html: 'https://github.com/ghAccount/ghRepo/blob/main/README.md',
    },
  },
  {
    name: 'byuLogo.png',
    path: 'byuLogo.png',
    sha: 'e9d693e97087e22e0c4d4dde4123287d457e25e8',
    size: 16355,
    url: 'https://api.github.com/repos/ghAccount/ghRepo/contents/byuLogo.png?ref=main',
    html_url: 'https://github.com/ghAccount/ghRepo/blob/main/byuLogo.png',
    git_url: 'https://api.github.com/repos/ghAccount/ghRepo/git/blobs/e9d693e97087e22e0c4d4dde4123287d457e25e8',
    download_url: 'https://raw.githubusercontent.com/ghAccount/ghRepo/main/byuLogo.png',
    type: 'file',
    _links: {
      self: 'https://api.github.com/repos/ghAccount/ghRepo/contents/byuLogo.png?ref=main',
      git: 'https://api.github.com/repos/ghAccount/ghRepo/git/blobs/e9d693e97087e22e0c4d4dde4123287d457e25e8',
      html: 'https://github.com/ghAccount/ghRepo/blob/main/byuLogo.png',
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

const progress = [
  {
    id: 'baae3d83-0859-4e13-ad9b-6310f272ce95',
    createdAt: '2025-12-05T10:00:00',
    userId: '158e4c68-732a-4e8c-ae3e-bf06ee1cec6f',
    enrollmentId: 'd5384777-4137-41fa-bfb6-bfdb9f4c7aa3',
    interactionId: null,
    duration: 0,
    type: 'userLogin',
    details: {
      method: 'inApp',
    },
    catalogId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
    topicId: 'b6c7df2a-699f-43a8-8508-08630dcc5cc6',
  },
  {
    id: '0546cf7c-697b-4bc5-b98d-f409d78ec550',
    createdAt: '2025-12-05T10:10:00',
    userId: '158e4c68-732a-4e8c-ae3e-bf06ee1cec6f',
    enrollmentId: null,
    interactionId: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
    duration: 6,
    type: 'instructionView',
    details: {},
    catalogId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
    topicId: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
  },
  {
    id: 'c1d243cc-3384-4f74-8319-65f6e9281481',
    createdAt: '2025-12-05T10:11:00',
    userId: '158e4c68-732a-4e8c-ae3e-bf06ee1cec6f',
    enrollmentId: 'bea019b9-46b4-4593-9dcd-0db2e87cbb90',
    interactionId: 'b6c7df2a-699f-43a8-8508-08630dcc5cc6',
    duration: 15,
    type: 'instructionView',
    details: {},
    catalogId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
    topicId: 'b6c7df2a-699f-43a8-8508-08630dcc5cc6',
  },
  {
    id: '42b0d4e3-d558-48aa-836b-034260571c1e',
    createdAt: '2025-12-05T10:12:00',
    userId: '158e4c68-732a-4e8c-ae3e-bf06ee1cec6f',
    enrollmentId: 'bea019b9-46b4-4593-9dcd-0db2e87cbb90',
    interactionId: 'a3b2a9f8-25e3-4ca4-8cca-42f3eb20537d',
    duration: 0,
    type: 'quizSubmit',
    details: {
      type: 'multiple-choice',
      correct: [2],
      feedback: 'Great job! You correctly identified "The right answer" as the correct choice.\n\nKeep up the great work! You\'re on the right track.',
      selected: [2],
      percentCorrect: 100,
    },
    catalogId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
    topicId: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
  },
  {
    id: '8373eef7-eb64-4eed-bf4d-cc600df9148c',
    createdAt: '2025-12-05T10:13:00',
    userId: '158e4c68-732a-4e8c-ae3e-bf06ee1cec6f',
    enrollmentId: 'bea019b9-46b4-4593-9dcd-0db2e87cbb90',
    interactionId: 'b6c7df2a-699f-43a8-8508-08630dcc5cc6',
    duration: 4175,
    type: 'instructionView',
    details: {},
    catalogId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
    topicId: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
  },
];

const supabaseAuthTokenResponse = {
  access_token: 'eyJhbGce1iJIUzI1NiIsImtpZCI6IjZoWjRjczBYNDFhcB2OaGoiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3ZsY3NhdnRmanl2eXByeWpmd2lzLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJjZmNmZWZkZS02Y2FiLTRkMTktYmRmOC0zNzU5NzJjNmRlM2UiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY0OTYzMzc0LCJpYXQiOjE3NjQ5NTk3NzQsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiY2ZjZmVmZGUtNmNhYi00ZDE5LWJkZjgtMzc1OTcyYzZkZTNlIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NjQ5NTk3NzR9XSwic2Vzc2lvbl9pZCI6Ijc0ZDY4NmU4LTAxZDYtNGQyNS05NDFkLWQ2Y2I0MDJmNmVhMiIsImlzX2Fub255bW91cyI6ZmFsc2V9.IhIVaQtdMUrLn5brBPAM9DvGfna-F5MDe2KLifjGuhI',
  token_type: 'bearer',
  expires_in: 360000,
  refresh_token: 'gvk2nv5a3qf6',
  user: {
    id: 'cfcfefde-6cab-4d19-bdf8-375972c6de3e',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'bud@cow.com',
    email_confirmed_at: '2025-12-05T18:36:14.729328472Z',
    phone: '',
    last_sign_in_at: '2025-12-05T18:36:14.745357585Z',
    app_metadata: {
      provider: 'email',
      providers: ['email'],
    },
    user_metadata: {
      email: 'bud@cow.com',
      email_verified: true,
      phone_verified: false,
      sub: 'cfcfefde-6cab-4d19-bdf8-375972c6de3e',
    },
    identities: [
      {
        identity_id: 'dfe107de-6dbe-4188-810c-7676e493937d',
        id: 'cfcfefde-6cab-4d19-bdf8-375972c6de3e',
        user_id: 'cfcfefde-6cab-4d19-bdf8-375972c6de3e',
        identity_data: {
          email: 'bud@cow.com',
          email_verified: true,
          phone_verified: false,
          sub: 'cfcfefde-6cab-4d19-bdf8-375972c6de3e',
        },
        provider: 'email',
        last_sign_in_at: '2025-12-05T18:36:14.69506583Z',
        created_at: '2025-12-05T18:36:14.695757Z',
        updated_at: '2025-12-05T18:36:14.695757Z',
        email: 'bud@cow.com',
      },
    ],
    created_at: '2025-12-05T18:36:14.648528Z',
    updated_at: '2025-12-05T18:36:14.797412Z',
    is_anonymous: false,
  },
};

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
      case 'POST':
        const postData = route.request().postDataJSON();
        const responseJson = Array.isArray(postData) ? postData[0] : postData;
        responseJson.id = '6660aaa7-0ff3-4267-b25e-4a7c3c99999';
        await route.fulfill({ status: 201, json: responseJson });
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
        let json: any = users;
        if (route.request().url().includes('id=eq.')) {
          json = users[0];
        }
        await route.fulfill({
          json,
        });
        break;
    }
  });

  // Supabase - role table access
  await context.route(/.*supabase.co\/rest\/v1\/role(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        const responseJson = route.request().postDataJSON();
        responseJson.id = 'aaa0aaa7-0ff3-4267-b25e-4a7c3cfffff';
        await route.fulfill({ status: 201, json: responseJson });
        break;
      case 'GET':
        await route.fulfill({
          json: [
            {
              user: '15cb92ef-d2d0-4080-8770-999516448960',
              right: 'root',
              settings: {},
            },
            {
              user: '15cb92ef-d2d0-4080-8770-999516448960',
              right: 'editor',
              object: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
              settings: {
                gitHubToken: 'yyyy',
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
        console.log('Enrollment POST called');
        await route.fulfill({
          status: 201,
          json: {
            id: '50a0dcd2-2b5a-4c4a-b5c3-0751c874d6f5',
            catalogId: '14602d77-0ff3-4267-b25e-4a7c3c47848b',
            learnerId: '15cb92ef-d2d0-4080-8770-999516448960',
            settings: {},
            progress: {
              mastery: 0,
            },
          },
        });
        return;
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
        return;
      case 'DELETE':
        await route.fulfill({ status: 204 });
        return;
    }
    throw new Error(`Unmocked endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  // Supabase - Gemini function access
  await context.route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'OPTIONS':
        await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
        return;
      case 'POST':
        await route.fulfill({
          json: {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: 'Fantastic job on this question! You correctly selected the right answer.',
                    },
                  ],
                  role: 'model',
                },
                finishReason: 'STOP',
                index: 0,
              },
            ],
            usageMetadata: {
              promptTokenCount: 245,
              candidatesTokenCount: 56,
              totalTokenCount: 863,
              promptTokensDetails: [
                {
                  modality: 'TEXT',
                  tokenCount: 245,
                },
              ],
              thoughtsTokenCount: 562,
            },
            modelVersion: 'gemini-2.5-flash',
            responseId: 'Rt1GaZm-Ns6sjMcPrMj-mAk',
          },
        });
        return;
    }
    throw new Error(`Unmocked endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  // Supabase - Refresh token
  await context.route(/.*supabase.co\/auth\/v1\/token(\?.+)?/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        json: supabaseAuthTokenResponse,
      });
      return;
    }
    throw new Error(`Unmocked endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  // Supabase - Sign up
  await context.route('**/auth/v1/signup', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        json: supabaseAuthTokenResponse,
      });
      return;
    }
    throw new Error(`Unmocked endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  // Supabase - Progress
  await context.route(/.*supabase.co\/rest\/v1\/progress(\?.+)?/, async (route) => {
    switch (route.request().method()) {
      case 'POST':
        await route.fulfill({
          status: 200,
          json: progress[0],
        });
        return;
      case 'GET':
        let json: any = progress;
        const viewType = route
          .request()
          .url()
          .match(/type=eq\.(\w+)/)?.[1];
        json = viewType ? progress.filter((p) => p.type === viewType) : progress;
        await route.fulfill({
          status: 200,
          json,
        });
        return;
    }
    throw new Error(`Unmocked endpoint requested: ${route.request().url()} ${route.request().method()}`);
  });

  // GitHub - API request for to list contents of a directory
  await context.route('https://api.github.com/**/contents', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: topicFiles });
  });

  // GitHub - request for README.md file
  await context.route('https://api.github.com/**/contents/README.md', async (route) => {
    switch (route.request().method()) {
      case 'PUT':
        await route.fulfill({ status: 201, json: { commit: { sha: 'fakecommitsha123' } } });
        break;
      case 'GET':
        await route.fulfill({ json: topicFiles[0] });
        break;
    }
  });

  // GitHub - request for course.json
  await context.route('https://api.github.com/**/contents/course.json', async (route) => {
    switch (route.request().method()) {
      case 'PUT':
        await route.fulfill({ status: 201, json: { commit: { sha: 'fakecommitsha123' } } });
        break;
      case 'GET':
        await route.fulfill({ json: courseJson });
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
    await route.fulfill({
      body: topicMarkdown,
      contentType: 'text/plain; charset=utf-8',
    });
  });

  // Google Gemini API - generateContent
  await context.route('https://generativelanguage.googleapis.com/**/*:generateContent', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 200,
      json: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Great job! You correctly identified "The right answer" as the correct choice.\n\nKeep up the great work! You\'re on the right track.\n',
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
}

async function navigateToDashboard(page: any) {
  await page.goto('http://localhost:5173/');

  await _register(page);
}

async function navigateToMetrics(page: any) {
  await page.goto('http://localhost:5173/');

  await _register(page);

  await page.getByRole('button').nth(2).click();
  await page.getByRole('button', { name: 'Metrics' }).click();
}

async function navigateToProgress(page: any) {
  await page.goto('http://localhost:5173/');

  await _register(page);

  await page.getByRole('button').nth(2).click();
  await page.getByRole('button', { name: 'Activity' }).click();
}

async function navigateToCourse(page: any) {
  await page.goto('http://localhost:5173/');

  await _register(page);

  // Open the course
  await page.getByRole('button', { name: 'Rocket Science' }).click();
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

export { initBasicCourse, navigateToDashboard, navigateToCourse, navigateToMetrics, navigateToProgress, register };
