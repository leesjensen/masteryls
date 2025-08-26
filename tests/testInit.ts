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

async function initBasicCourse(props: { page: any; topicMarkdown?: string | undefined }) {
  const topicMarkdown = props.topicMarkdown || defaultMarkdown;

  await props.page.route('*/**/path/relative.svg', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({
      body: '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="blue"/></svg>',
      contentType: 'image/svg+xml',
    });
  });

  await props.page.route('*/**/course.json', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: courseJson });
  });

  await props.page.route('*/**/README.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: topicMarkdown });
  });

  await props.page.route('*/**/contents', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: topicContents });
  });

  await props.page.route('*/**/topic1.md', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ body: topicMarkdown });
  });
}

export { initBasicCourse };
