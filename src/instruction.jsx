import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';

mermaid.initialize({ startOnLoad: false });

function Instruction() {
  const [content, setContent] = useState('Loading...');

  useEffect(() => {
    (async () => {
      try {
        const fileResponse = await fetch('https://api.github.com/repos/leesjensen/masteryls/contents/sample.md');
        const fileData = await fileResponse.json();
        const markdownContent = atob(fileData.content);

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
  }, []);

  useEffect(() => {
    if (content) {
      setTimeout(() => {
        mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      }, 1000);
    }
  }, [content]);

  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: content }} />;
}

export default Instruction;
