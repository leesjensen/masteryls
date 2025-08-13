import React, { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';

mermaid.initialize({ startOnLoad: false });

function Instruction({ config, topicUrl }) {
  const [content, setContent] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (topicUrl) {
      loadTopic(config, topicUrl).then((html) => {
        setContent(html);
      });
    }
  }, [topicUrl]);

  // Re-render mermaid diagrams when content changes and reset scroll to top
  useEffect(() => {
    if (content) {
      // Reset scroll to top of the scrollable container
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'auto' });
      }
      // Render mermaid diagrams after content is in the DOM
      setTimeout(() => {
        mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      }, 0);
    }
  }, [content]);

  return (
    <section ref={containerRef} className="flex-1 overflow-auto my-2 rounded-xs border border-gray-200">
      <div className="markdown-body p-4" dangerouslySetInnerHTML={{ __html: content }} />
    </section>
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
  let baseUrl = `https://raw.githubusercontent.com/${config.github.account}/${config.github.repository}/main`;
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
      Accept: 'application/vnd.github.v3+json',
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
  html = html.replace(/<div class="highlight highlight-source-mermaid"><pre class="notranslate">([\s\S]*?)<\/pre><\/div>/g, (_, diagramContent) => {
    const cleanDiagram = diagramContent.replace(/<[^>]*>/g, '').trim();
    return `<div class="mermaid">${cleanDiagram}</div>`;
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
