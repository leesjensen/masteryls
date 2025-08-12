import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';

mermaid.initialize({ startOnLoad: false });

function Instruction({ topicUrl }) {
  const [content, setContent] = useState('Loading...');

  useEffect(() => {
    if (topicUrl) {
      (async () => {
        try {
          const fileResponse = await fetch(topicUrl);
          const fileData = await fileResponse.json();
          let markdownContent = atob(fileData.content);

          //const baseUrl = topicUrl.substring(0, topicUrl.lastIndexOf('/') + 1);
          let contentPath = topicUrl.split('/contents/')[1];
          contentPath = contentPath.substring(0, contentPath.lastIndexOf('/'));
          const baseUrl = `https://raw.githubusercontent.com/softwareconstruction240/softwareconstruction/main/${contentPath}`;

          // Replace relative image and link references with absolute URLs
          const replaceRelativeLinks = (text) => {
            // Replace images: ![alt](./img.png) or ![alt](img.png)
            text = text.replace(/!\[([^\]]*)\]\((?!https?:\/\/|\/)([^)]+)\)/g, (match, alt, url) => {
              const absUrl = baseUrl + url.replace(/^\.\//, '');
              return `![${alt}](${absUrl})`;
            });
            // Replace links: [label](./file.md) or [label](file.md)
            text = text.replace(/\[([^\]]+)\]\((?!https?:\/\/|\/)([^)]+)\)/g, (match, label, url) => {
              const absUrl = baseUrl + url.replace(/^\.\//, '');
              return `[${label}](${absUrl})`;
            });
            return text;
          };

          markdownContent = replaceRelativeLinks(markdownContent);

          console.log('Markdown content:', markdownContent);

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

          let html = await response.text();
          html = html.replace(/<section[^>]*class="[^"]*render-needs-enrichment[^"]*"[^>]*>[\s\S]*?<div[^>]*data-plain="([^"]+)"[^>]*>[\s\S]*?<\/section>/g, (_, diagram) => {
            return `<div class="mermaid">${diagram.trim()}</div>`;
          });
          setContent(html);
        } catch (e) {
          console.error(e);
          setContent('<p>Error loading content.</p>');
        }
      })();
    }
  }, [topicUrl]);

  useEffect(() => {
    if (content) {
      setTimeout(() => {
        mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      }, 1000);
    }
  }, [content]);

  return (
    <div id="content" className="h-full overflow-auto">
      <div className="markdown-body p-4" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}

export default Instruction;
