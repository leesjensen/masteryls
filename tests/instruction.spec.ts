import { test, expect } from 'playwright-test-coverage';

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

source markdown!

* Item 1
1. Item 2
`;

const defaultHtml = `
<h1>Home</h1>
<p>rendered markdown</p>
<ul>
  <li>Item 1</li>
</ul>
<ol>
  <li>Item 2</li>
</ol>`;

async function initBasicCourse(props: { page: any; topicMarkdown?: string | undefined; topicHtml?: string | undefined }) {
  const topicMarkdown = props.topicMarkdown || defaultMarkdown;
  const topicHtml = props.topicHtml || defaultHtml;

  await props.page.route('*/**/course.json', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: courseJson });
  });

  await props.page.route('*/**/README.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: topicMarkdown });
  });

  await props.page.route('*/**/markdown', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ body: topicHtml });
  });

  await props.page.route('*/**/contents', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: topicContents });
  });
}

test('load from course.json', async ({ page }) => {
  await initBasicCourse({ page });

  await page.goto('http://localhost:5173/');
  await expect(page.getByRole('banner')).toContainText('💡 QA & DevOps');
  await expect(page.getByRole('button', { name: '▶', exact: true })).toBeVisible();
  await expect(page.getByText('Module 1')).toBeVisible();
  await expect(page.getByText('rendered markdown')).toBeVisible();
});

test('load from modules.md', async ({ page }) => {
  const modulesMarkdown = `
# Modules

## Module 1

- [Topic 1](something/more/topic1.md)

## Module 2

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

  await page.goto('http://localhost:5173/');
  await expect(page.getByRole('banner')).toContainText('💡 devops');
  await expect(page.getByText('Course info')).toBeVisible();
  await expect(page.getByText('rendered markdown')).toBeVisible();
});

test('toc toggling', async ({ page }) => {
  await initBasicCourse({ page });

  await page.goto('http://localhost:5173/');

  await expect(page.getByText('topic 1')).toBeVisible();
  await expect(page.getByText('topic 2')).not.toBeVisible();
  await page.getByRole('button', { name: '▶ Module 2' }).click();
  await expect(page.getByText('topic 2')).toBeVisible();
  await page.getByRole('button', { name: '▼ Module 1' }).click();
  await expect(page.getByText('topic 1')).not.toBeVisible();
});

test('editor', async ({ page }) => {
  await initBasicCourse({ page });

  await page.goto('http://localhost:5173/');

  await page.getByRole('button', { name: '✏️' }).click();
  await expect(page.getByRole('textbox')).toContainText('# Home source markdown!');

  await expect(page.getByRole('button', { name: 'README.md markdown • 2.6 KB' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).click();
  await expect(page.getByRole('button', { name: 'byuLogo.png image • 16.0 KB' }).getByRole('checkbox')).toBeChecked();
});

test('quiz multiple choice', async ({ page }) => {
  const quizMarkdown = `
# Quiz

Here is an example quiz

\`\`\`masteryls
{"id":"39283", "title":"Multiple choice", "type":"multiple-choice", "body":"Simple **multiple choice** question" }
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`
`;

  const quizHtml = `
<h1>Quiz</h1>
<p>Here is an example quiz</p>
<pre lang="masteryls" class="notranslate"><code class="notranslate">{"id":"39283", "title":"Multiple choice", "type":"multiple-choice", "body":"Simple **multiple choice** question" }
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&amp;fit=crop&amp;w=400&amp;q=80)
</code></pre>
`;

  await page.route('*/**/topic1.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: quizMarkdown });
  });

  await initBasicCourse({ page, topicHtml: quizHtml });

  await page.goto('http://localhost:5173/');

  await page.getByText('topic 1').click();

  await expect(page.getByRole('radio', { name: 'This is the right answer' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'This is not the right answer' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'This one has a link' })).toBeVisible();
  await expect(page.getByRole('group')).toContainText('Simple multiple choice question');
  await expect(page.getByRole('img', { name: 'Stock Photo' })).toBeVisible();

  await page.getByRole('radio', { name: 'This is the right answer' }).check();
  await expect(page.getByRole('radio', { name: 'This is the right answer' })).toBeChecked();
});

test('quiz essay', async ({ page }) => {
  const quizMarkdown = `
# Quiz

Here is an example quiz

\`\`\`masteryls
{"id":"39283", "title":"Essay", "type":"essay", "body":"Simple **essay** question" }
\`\`\`
`;

  const quizHtml = `
<h1>Quiz</h1>
<p>Here is an example quiz</p>
<pre lang="masteryls" class="notranslate"><code class="notranslate">
{"id":"39283", "title":"Essay", "type":"essay", "body":"Simple **essay** question" }
</code></pre>
`;

  await page.route('*/**/topic1.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: quizMarkdown });
  });

  await initBasicCourse({ page, topicHtml: quizHtml });

  await page.goto('http://localhost:5173/');

  await page.getByText('topic 1').click();

  await expect(page.getByText('Essay', { exact: true })).toBeVisible();
  await expect(page.getByText('Simple essay question')).toBeVisible();

  await page.getByRole('textbox').click();
  await page.getByRole('textbox').fill('example text');
  await expect(page.getByRole('textbox')).toHaveValue('example text');
});

test('video', async ({ page }) => {
  await initBasicCourse({ page });

  await page.goto('http://localhost:5173/');

  await page.getByRole('button', { name: '▶ Module 2' }).click();
  await page.getByText('topic 3').click();

  await expect(page.locator('iframe[title="YouTube video player"]')).toBeVisible();
});

test('settings', async ({ page }) => {
  await initBasicCourse({ page });

  await page.goto('http://localhost:5173/');

  await page.getByText('Settings').click();
  await expect(page.getByRole('complementary')).toContainText('schedule/schedule.md');
});

test('settings editing', async ({ page }) => {
  await initBasicCourse({ page });

  await page.goto('http://localhost:5173/');

  await page.getByRole('button', { name: '✏️' }).click();
  await page.getByText('Settings').click();

  await expect(page.getByRole('textbox', { name: 'Enter schedule URL' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();

  let dialogDisplayed = false;
  page.once('dialog', (dialog) => {
    dialogDisplayed = true;
    console.log(`Dialog message: ${dialog.message()}`);
    dialog.dismiss().catch(() => {});
  });
  await page.getByRole('button', { name: 'Save Changes' }).click();

  expect(dialogDisplayed).toBe(true);
});
