import React, { useEffect, useState, useCallback } from 'react';
import { useSwipeNavigation } from './useSwipeNavigation';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';

mermaid.initialize({ startOnLoad: false });

function Instruction({ topic, changeTopic, course, navigateToAdjacentTopic }) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useSwipeNavigation(
    useCallback(() => navigateToAdjacentTopic('next'), [course, topic]),
    useCallback(() => navigateToAdjacentTopic('prev'), [course, topic])
  );

  useEffect(() => {
    if (topic.path) {
      setIsLoading(true);
      setContent('');
      course.topicHtml(topic.path).then((html) => {
        setContent(html);
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

  return (
    <section ref={containerRef} className="flex-1 overflow-auto my-2 rounded-xs border border-gray-200" onClick={(e) => handleContainerClick(e, changeTopic, topic.path, containerRef)}>
      <div className={`markdown-body p-4 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-0 bg-black' : 'opacity-100 bg-transparent'}`} dangerouslySetInnerHTML={{ __html: content || '<div class="flex items-center justify-center"></div>' }} />
    </section>
  );
}

function handleContainerClick(event, changeTopic, topicUrl, containerRef) {
  const anchor = event.target.closest('a');
  if (anchor && anchor.href) {
    event.preventDefault();
    let href = anchor.getAttribute('href');
    const match = href.match(/^([^#]*)(#.*)?$/);
    href = match[1];
    const hrefAnchor = match[2];

    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      if (href.startsWith('#')) {
        scrollToAnchor(href, containerRef);
      } else {
        const resolvedUrl = new URL(href, topicUrl).toString();
        changeTopic({ title: anchor.textContent, path: resolvedUrl, anchor: hrefAnchor });
      }
    }
  }
}

function scrollToAnchor(anchor, containerRef) {
  if (anchor) {
    const headings = containerRef.current?.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings) {
      const targetId = anchor.substring(1).replaceAll('-', ' ');
      const targetElement = Array.from(headings).find((h) => h.textContent.trim().toLowerCase() === targetId.toLowerCase());
      if (targetElement) {
        targetElement.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
      }
    }
  }
}

export default Instruction;
