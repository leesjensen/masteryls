import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import 'github-markdown-css/github-markdown-light.css';

function Instruction() {
  useEffect(() => {
    (async () => {
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
      const text = await response.text();
      setContent(text);
    })();
  }, []);

  const [content, setContent] = React.useState('loading...');

  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: content }} />;
}

export default Instruction;
