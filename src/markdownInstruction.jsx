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

export default function MarkdownInstruction({
  topic,
  changeTopic,
  course,
  postProcessHtml, // NEW (optional)
  onQuizSubmit, // NEW (optional)
}) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (topic.path) {
      setIsLoading(true);
      setContent('');
      course.topicHtml(topic.path).then((html) => {
        const processed = typeof postProcessHtml === 'function' ? postProcessHtml(html) : html; // NEW
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

  return (
    <div
      ref={containerRef}
      className={`markdown-body p-4 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-0 bg-black' : 'opacity-100 bg-transparent'}`}
      dangerouslySetInnerHTML={{ __html: content || '<div class="flex items-center justify-center"></div>' }}
      onClick={
        (e) => handleContainerClick(e, { course, changeTopic, topicUrl: topic.path, containerRef, onQuizSubmit }) // CHANGED
      }
    />
  );
}

function handleContainerClick(event, ctx) {
  const { course, changeTopic, topicUrl, containerRef, onQuizSubmit } = ctx;

  // --- NEW: quiz submit delegation ---------------------------------------
  const submitBtn = event.target.closest('[data-quiz-submit]');
  if (submitBtn) {
    event.preventDefault();

    const quizRoot = submitBtn.closest('[data-quiz-root]');
    if (quizRoot) {
      const id = quizRoot.getAttribute('data-quiz-id') || undefined;
      const title = quizRoot.getAttribute('data-quiz-title') || undefined;
      const type = quizRoot.getAttribute('data-quiz-type') || undefined;

      // read selected & correct indices from DOM
      const inputs = Array.from(quizRoot.querySelectorAll('input[data-quiz-index]'));
      const selected = [];
      const correct = [];
      inputs.forEach((inp) => {
        const idx = Number(inp.getAttribute('data-quiz-index'));
        if (inp.checked) selected.push(idx);
        if (inp.getAttribute('data-quiz-correct') === 'true') correct.push(idx);
      });
      selected.sort((a, b) => a - b);
      correct.sort((a, b) => a - b);

      const isCorrect = selected.length === correct.length && correct.every((i, k) => i === selected[k]);

      onQuizSubmit?.({ id, title, type, selectedIndices: selected, correctIndices: correct, isCorrect });

      // optional simple UX touch: flash the quiz root
      quizRoot.classList.add('ring-2', isCorrect ? 'ring-green-500' : 'ring-red-500');
      setTimeout(() => quizRoot.classList.remove('ring-2', 'ring-green-500', 'ring-red-500'), 600);
    }
    return; // don't continue into link handling
  }
  // -----------------------------------------------------------------------

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
