import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';

mermaid.initialize({ startOnLoad: false });

function Instruction({ topicUrl }) {
  const [content, setContent] = useState('Loading...');

  useEffect(() => {
    if (topicUrl) {
      loadTopic(topicUrl).then((html) => {
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

async function loadTopic(topicUrl) {
  try {
    let baseUrl = `https://raw.githubusercontent.com/softwareconstruction240/softwareconstruction/main`;
    let contentPath = topicUrl.split('/contents/')[1];
    contentPath = contentPath.substring(0, contentPath.lastIndexOf('/'));
    if (contentPath) {
      baseUrl += `/${contentPath}`;
    }

    const html = await downloadTopicHTML(baseUrl, topicUrl);

    return postProcessTopicHTML(html);
  } catch (e) {
    console.error(e);
    return '<p>Error loading content.</p>';
  }
}

async function downloadTopicHTML(baseUrl, topicUrl) {
  const fileResponse = await fetch(topicUrl);
  const fileData = await fileResponse.json();
  let markdownContent = new TextDecoder('utf-8').decode(Uint8Array.from(atob(fileData.content), (c) => c.charCodeAt(0)));

  markdownContent = replaceRelativeLinks(baseUrl, markdownContent);

  const response = await fetch('https://api.github.com/markdown', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      text: markdownContent,
      mode: 'gfm',
      context: 'leesjensen/masteryls',
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
