import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';

mermaid.initialize({ startOnLoad: false });

function Instruction({ config, topicUrl }) {
  const [content, setContent] = useState('');

  useEffect(() => {
    if (topicUrl) {
      loadTopic(config, topicUrl).then((html) => {
        setContent(html);
      });
    }
  }, [topicUrl]);

  // Re-render mermaid diagrams when content changes
  useEffect(() => {
    if (content) {
      setTimeout(() => {
        mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      }, 0);
    }
  }, [content]);

  return (
    <div id="content" className="h-full overflow-auto">
      <div className="markdown-body p-4" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}

async function loadTopic(config, topicUrl) {
  try {
    const markdown = await downloadTopicMarkdown(config, topicUrl);
    const html = await convertTopicToHtml(config, topicUrl, markdown);

    return postProcessTopicHTML(html);
  } catch (e) {
    console.error(e);
    return '<p>Error loading content.</p>';
  }
}

async function downloadTopicMarkdown(config, topicUrl) {
  const fileResponse = await fetch(topicUrl, {
    headers: {
      accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.github.token}`,
    },
  });
  const fileData = await fileResponse.json();
  return new TextDecoder('utf-8').decode(Uint8Array.from(atob(fileData.content), (c) => c.charCodeAt(0)));
}

async function convertTopicToHtml(config, topicUrl, markdown) {
  let baseUrl = `https://raw.githubusercontent.com/softwareconstruction240/softwareconstruction/main`;
  let contentPath = topicUrl.split('/contents/')[1];
  contentPath = contentPath.substring(0, contentPath.lastIndexOf('/'));
  if (contentPath) {
    baseUrl += `/${contentPath}`;
  }

  markdown = replaceRelativeLinks(baseUrl, markdown);

  const response = await fetch('https://api.github.com/markdown', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.github.token}`,
    },
    body: JSON.stringify({
      text: markdown,
      mode: 'gfm',
      context: `${config.github.account}/${config.github.repository}`,
    }),
  });
  return response.text();
}

function postProcessTopicHTML(html) {
  // Replace mermaid diagrams
  html = html.replace(/<section[^>]*class="[^"]*render-needs-enrichment[^"]*"[^>]*>[\s\S]*?<div[^>]*data-plain="([^"]+)"[^>]*>[\s\S]*?<\/section>/g, (_, diagram) => {
    return `<div class="mermaid">${diagram.trim()}</div>`;
  });

  return html;
}

function replaceRelativeLinks(baseUrl, text) {
  // Replace images: ![alt](./img.png) or ![alt](img.png)
  text = text.replace(/!\[([^\]]*)\]\((?!https?:\/\/|\/)([^)]+)\)/g, (match, alt, url) => {
    const absUrl = `${baseUrl}/${url.replace(/^\.\//, '')}`;
    return `![${alt}](${absUrl})`;
  });
  // Replace links: [label](./file.md) or [label](file.md)
  text = text.replace(/\[([^\]]+)\]\((?!https?:\/\/|\/)([^)]+)\)/g, (match, label, url) => {
    const absUrl = baseUrl + url.replace(/^\.\//, '');
    return `[${label}](${absUrl})`;
  });
  return text;
}

export default Instruction;
