import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('route course.json robustly', async ({ context, page }) => {
  // Log everything to discover redirects/final URLs
  context.on('request', (r) => console.log('>>', r.method(), r.url()));
  context.on('response', (r) => console.log('<<', r.status(), r.url()));

  // Very broad match to catch initial + redirected URLs
  await context.route('**/course.json*', async (route) => {
    console.log('ROUTE HIT', route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cow: 3 }),
      // If the real request is cross-origin, CORS headers can help:
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-credentials': 'true',
      },
    });
  });

  await page.goto('http://localhost:5173/');
});

test('mocks course.json via fetch stub', async ({ page }) => {
  // Stub fetch before navigation
  console.log('adding init script');
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    console.log('init script');
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      console.log('*****\n\nIntercepted (context):\n\n******************', url);
      if (url.includes('/course.json')) {
        // Return your mock payload
        const body = JSON.stringify({ cow: 3 });

        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input as any, init);
    };
  });

  await page.goto('http://localhost:5173/');

  // ...assert your UI that depends on course.json...
});

test('intercept via context', async ({ context, page }) => {
  context.on('request', (req) => console.log('CTX >>', req.method(), req.url()));
  context.on('response', (res) => console.log('CTX <<', res.status(), res.url()));

  // Intercept everything named course.json, any origin
  await context.route('**/course.json', (route) => {
    console.log('*****\n\nIntercepted (context):\n\n******************', route.request().url());
    route.fulfill({ json: { cow: 3 } });
  });

  await context.route('https://raw.githubusercontent.com/**/course.json', (route) => {
    console.log('*****\n\nIntercepted (context):\n\n******************', route.request().url());
    route.fulfill({ json: { cow: 3 } });
  });

  await page.goto('http://localhost:5173/');
});

test('test', async ({ page }) => {
  // await page.route(
  //   (url) => {
  //     console.log(url.href);
  //     if (url.pathname.endsWith('/course.json')) return true;
  //     return false;
  //   },
  //   async (route) => {
  //     console.log('Intercepted course.json request:', route.request().url());
  //     expect(route.request().method()).toBe('GET');
  //     await route.fulfill({ json: { cow: 3 } });
  //   }
  // );

  await page.goto('http://localhost:5173/');
});

// await page.route('*/**', async (route) => {
//   const r = route.request();
//   console.log(r.url());
//   await route.fulfill({ json: { cow: 4 } });
// });

// await page.route('*/**/course.json', async (route) => {
//   console.log('mock');
//   route.fulfill({
//     status: 200,
//     contentType: 'application/json',
//     body: '# BYU QA and DevOps `xcs329`',
//   });
// });

// await page.route('**/course.json', (route) => {
//   console.log('course.json');
//   route.fulfill({
//     status: 200,
//     contentType: 'application/json',
//     body: JSON.stringify({
//       title: 'QA & DevOps',
//       schedule: 'schedule/schedule.md',
//       syllabus: 'instruction/syllabus/syllabus.md',
//       links: {
//         canvas: 'https://byu.instructure.com/courses/31151',
//         chat: 'https://discord.com/channels/748656649287368704',
//         gitHub: {
//           url: 'https://github.com/devops329/devops/blob/main',
//           apiUrl: 'https://api.github.com/repos/devops329/devops/contents',
//           rawUrl: 'https://raw.githubusercontent.com/devops329/devops/main',
//         },
//       },
//       modules: [
//         {
//           title: 'Course info',
//           topics: [
//             {
//               title: 'Home',
//               path: 'README.md',
//               id: '690b3872aab6442fac17c6730d7502ed',
//             },
//             {
//               title: 'Syllabus',
//               path: 'instruction/syllabus/syllabus.md',
//               id: 'eb84677c4b7c47b1a40402c63ed07db8',
//             },
//             {
//               title: 'Schedule',
//               path: 'schedule/schedule.md',
//               id: '4d398bdff38f40108c07a336314519d4',
//             },
//           ],
//         },
//       ],
//     }),
//   });
// });

// await page.route('**/README.md', (route) =>
//   route.fulfill({
//     status: 200,
//     contentType: 'application/json',
//     body: '# BYU QA and DevOps `cs329`',
//   })
// );

// await page.route('api.github.com/markdown', (route) =>
//   route.fulfill({
//     status: 200,
//     contentType: 'application/json',
//     body: '<h1 dir="auto">BYU QA and DevOps <code class="notranslate">cs329</code></h1>',
//   })
// );

// await expect(page.locator('section')).toContainText('BYU QA and DevOps cs329');
