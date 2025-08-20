import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';

mermaid.initialize({ startOnLoad: false });

/** @typedef {{
 *   id?: string|number,
 *   title?: string,
 *   type?: 'single-choice'|'multiple-choice'|string,
 *   selectedIndices: number[],
 *   correctIndices: number[],
 *   isCorrect: boolean
 * }} QuizSubmitPayload
 */

export default function MarkdownInstruction({ topic, changeTopic, course, languagePlugins = [] }) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (topic.path) {
      setIsLoading(true);
      setContent('');
      course.topicHtml(topic.path).then((html) => {
        const processed = languagePlugins.reduce((acc, plugin) => {
          if (plugin.processor) {
            return plugin.processor(acc);
          }
          return acc;
        }, html);
        setContent(processed);
        setIsLoading(false);
      });
    }
  }, [topic]);

  useEffect(() => {
    if (content) {
      // Reset scroll to top of the scrollable container
      if (topic.anchor) {
        scrollToAnchor(topic.anchor, containerRef);
      } else if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'auto' });
      }
      // Render mermaid diagrams after content is in the DOM
      setTimeout(() => {
        mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      }, 0);
    }
  }, [content]);

  return <div ref={containerRef} className={`markdown-body p-4 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-0 bg-black' : 'opacity-100 bg-transparent'}`} dangerouslySetInnerHTML={{ __html: content || '<div class="flex items-center justify-center"></div>' }} onClick={(e) => handleContainerClick(e, { course, changeTopic, topicUrl: topic.path, containerRef, languagePlugins })} />;
}

function handleContainerClick(event, ctx) {
  const { course, changeTopic, topicUrl, containerRef, languagePlugins } = ctx;

  // Handle plugin notifications
  languagePlugins.forEach((plugin) => {
    const languageElement = event.target.closest(`[data-plugin-${plugin.lang}]`);
    if (languageElement) {
      plugin.handler?.(event, languageElement);
      return;
    }
  });

  // Link handling (existing)
  const anchor = event.target.closest('a');
  if (anchor && anchor.href) {
    event.preventDefault();
    let href = anchor.getAttribute('href');

    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      const match = href.match(/^([^#]*)(#.*)?$/);
      const hrefPath = match[1];
      const hrefAnchor = match[2];

      if (!hrefPath && hrefAnchor) {
        scrollToAnchor(hrefAnchor, containerRef);
      } else if (hrefPath) {
        const resolvedUrl = new URL(hrefPath, topicUrl).toString();
        const targetTopic = course.topicFromPath(resolvedUrl, false);
        if (targetTopic) {
          changeTopic({ ...targetTopic, anchor: hrefAnchor });
        }
      }
    }
  }
}

function scrollToAnchor(anchor, containerRef) {
  if (anchor) {
    let anchorId = anchor.substring(1);
    let targetElement = containerRef.current.querySelector(`#${CSS.escape(anchorId)}`);
    if (!targetElement) {
      const headings = containerRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings) {
        anchorId = anchorId.replaceAll('-', ' ');
        targetElement = Array.from(headings).find((h) => h.textContent.trim().toLowerCase() === anchorId.toLowerCase());
      }
    }
    if (targetElement) {
      targetElement.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
    }
  }
}
