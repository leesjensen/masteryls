import React, { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';

mermaid.initialize({ startOnLoad: false });

function Instruction({ config, topicUrl, setTopic }) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (topicUrl) {
      setIsLoading(true);
      setContent('');
      loadTopic(config, topicUrl).then((html) => {
        setContent(html);
        setIsLoading(false);
      });
    }
  }, [topicUrl]);

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
    <section ref={containerRef} className="flex-1 overflow-auto my-2 rounded-xs border border-gray-200" onClick={(e) => handleContainerClick(e, setTopic, topicUrl, containerRef)}>
      <div className={`markdown-body p-4 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-0 bg-black' : 'opacity-100 bg-transparent'}`} dangerouslySetInnerHTML={{ __html: content || '<div class="flex items-center justify-center"></div>' }} />
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
  let baseUrl = config.links.gitHub.rawUrl;
  let contentPath = topicUrl.split('/contents/')[1];
  contentPath = contentPath.substring(0, contentPath.lastIndexOf('/'));
  if (contentPath) {
    baseUrl += `/${contentPath}`;
  }

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

  const html = replaceImageLinks(baseUrl, await response.text());

  return html;
}

function postProcessTopicHTML(html) {
  html = html.replace(/<div class="highlight highlight-source-mermaid"><pre class="notranslate">([\s\S]*?)<\/pre><\/div>/g, (_, diagramContent) => {
    const cleanDiagram = diagramContent.replace(/<[^>]*>/g, '').trim();
    return `<div class="mermaid">${cleanDiagram}</div>`;
  });
  return html;
}

function replaceImageLinks(baseUrl, html) {
  html = html.replace(/<img([^>]+)src=["'](?!https?:\/\/|\/)([^"']+)["']([^>]*)>/g, (match, beforeSrc, url, afterSrc) => {
    const absUrl = `${baseUrl}/${url.replace(/^\.\//, '')}`;
    return `<img${beforeSrc}src="${absUrl}"${afterSrc}>`;
  });

  return html;
}

function handleContainerClick(event, setTopic, topicUrl, containerRef) {
  const anchor = event.target.closest('a');
  if (anchor && anchor.href) {
    event.preventDefault();
    const href = anchor.getAttribute('href');

    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      if (href.startsWith('#')) {
        const headings = containerRef.current?.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings) {
          const targetId = href.substring(1).replace('-', ' ');
          const targetElement = Array.from(headings).find((h) => h.textContent.trim().toLowerCase() === targetId.toLowerCase());
          if (targetElement) {
            targetElement.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
          }
        }
      } else {
        const resolvedUrl = new URL(href, topicUrl).toString();
        setTopic({ title: anchor.textContent, path: resolvedUrl });
      }
    }
  }
}

export default Instruction;
