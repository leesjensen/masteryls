import React, { useState } from 'react';
import MarkdownInstruction from '../markdownInstruction';
import EssayQuiz from './essayQuiz';
import MultipleChoiceQuiz from './multipleChoiceQuiz';
import SubmissionQuiz from './submissionQuiz';
import UrlQuiz from './urlQuiz';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import QuizFeedback from './quizFeedback';
import { updateQuizFeedback } from './feedbackStore';

export default function QuizInstruction({ courseOps, topic, user, preview = null }) {
  /**
   * The quiz markdown format follow this example syntax:
   *
   * ```masteryls
   * {"id":"39283", "title":"Multiple choice", "type":"multiple-choice" }
   * - [ ] This is **not** the right answer
   * - [x] This is _the_ right answer
   * - [ ] This one has a [link](https://cow.com)
   * - [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
   * ```
   */
  function injectQuiz(content) {
    const jsonMatch = content.match(/^\{[\s\S]*?\}(?:\n|$)/);
    let meta = { id: undefined, title: '', type: 'multiple-choice' };
    let itemsText = content;

    if (jsonMatch) {
      try {
        meta = { ...meta, ...JSON.parse(jsonMatch[0]) };
        meta.type = meta.type.toLowerCase();
      } catch {}
      itemsText = content.slice(jsonMatch.index + jsonMatch[0].length).trim();
    }
    let controlJsx = generateQuizComponent(meta, itemsText);
    return (
      <div className="p-2 rounded border border-gray-300 shadow-sm overflow-x-auto break-words whitespace-pre-line" data-plugin-masteryls data-plugin-masteryls-root data-plugin-masteryls-id={meta.id} data-plugin-masteryls-title={meta.title} data-plugin-masteryls-type={meta.type}>
        <fieldset>
          {meta.title && <legend className="font-semibold mb-3 break-words whitespace-pre-line">{meta.title}</legend>}
          {meta.body && (
            <p className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
              {inlineLiteMarkdown(meta.body)}
            </p>
          )}
        </fieldset>
        <div className="space-y-3">{controlJsx}</div>
        <QuizFeedback quizId={meta.id} />
      </div>
    );
  }

  function generateQuizComponent(meta, itemsText) {
    let controlHtml = <div></div>;
    if (meta.type && (meta.type === 'multiple-choice' || meta.type === 'multiple-select')) {
      return <MultipleChoiceQuiz meta={meta} itemsText={itemsText} />;
    } else if (meta.type === 'essay') {
      return <EssayQuiz meta={meta} />;
    } else if (meta.type === 'file-submission') {
      return <SubmissionQuiz meta={meta} />;
    } else if (meta.type === 'url-submission') {
      return <UrlQuiz meta={meta} />;
    }

    return controlHtml;
  }

  async function onChoiceQuiz({ id, title, type, body, choices, selected, correct, percentCorrect }) {
    if (selected.length === 0) return false;
    let feedback = '';
    try {
      const data = {
        title,
        type,
        question: body,
        choices: choices.map((choice) => '\n   -' + choice).join(''),
        learnerAnswers: selected.map((i) => choices[i]),
        correctAnswers: correct.map((i) => choices[i]),
        percentCorrect: percentCorrect,
      };
      feedback = await courseOps.getChoiceQuizFeedback(data);
    } catch {
      feedback = `${percentCorrect === 100 ? 'Great job! You got it all correct.' : `Nice try. Review the material see where you went wrong.`}`;
    }
    updateQuizFeedback(id, feedback);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, { type: 'choice', selected, correct, percentCorrect, feedback });
    return true;
  }

  async function onEssayQuiz({ id, title, type, body, precedingContent, essay }) {
    if (!essay) return false;
    const data = {
      title,
      type,
      question: body,
      'question context': precedingContent,
      essay,
    };
    const { feedback, percentCorrect } = await courseOps.getEssayQuizFeedback(data);
    updateQuizFeedback(id, feedback);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, { type: 'essay', essay, percentCorrect, feedback });
    return percentCorrect;
  }

  async function onFileQuiz({ id, title, type, body, files }) {
    if (files.length === 0) return 0;
    let feedback = 'Submission received. Thank you!';
    updateQuizFeedback(id, feedback);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, { type: 'file', files, feedback });
    return 100;
  }

  async function onUrlQuiz({ id, title, type, body, url }) {
    if (!url) return 0;
    let feedback = 'Submission received. Thank you!';
    updateQuizFeedback(id, feedback);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, { type: 'url', url, feedback });
    return 100;
  }

  async function handleQuizClick(event, quizRoot) {
    const type = quizRoot.getAttribute('data-plugin-masteryls-type') || undefined;
    const id = quizRoot.getAttribute('data-plugin-masteryls-id') || undefined;
    const title = quizRoot.getAttribute('data-plugin-masteryls-title') || undefined;
    const bodyElem = quizRoot.querySelector('[data-plugin-masteryls-body]');
    const body = bodyElem ? bodyElem.textContent.trim() : undefined;
    if (type === 'multiple-choice' || type === 'multiple-select') {
      if (event.target.tagName === 'INPUT') {
        // read selected & correct indices from DOM
        const inputs = Array.from(quizRoot.querySelectorAll('input[data-plugin-masteryls-index]'));
        const selected = [];
        const correct = [];
        const choices = [];
        inputs.forEach((inp) => {
          const idx = Number(inp.getAttribute('data-plugin-masteryls-index'));
          choices.push(inp.nextSibling.textContent.trim());
          if (inp.checked) selected.push(idx);
          if (inp.getAttribute('data-plugin-masteryls-correct') === 'true') correct.push(idx);
        });
        selected.sort((a, b) => a - b);
        correct.sort((a, b) => a - b);

        // Calculate percent correct
        const total = correct.length;
        const correctSelections = selected.filter((idx) => correct.includes(idx)).length;
        const incorrectSelections = selected.filter((idx) => !correct.includes(idx)).length;
        const matched = Math.max(0, correctSelections - incorrectSelections);
        const percentCorrect = total === 0 ? 0 : Math.round((matched / total) * 100);

        if (await onChoiceQuiz({ id, title, type, body, choices, selected, correct, percentCorrect })) {
          // give visual feedback
          let ringClass = 'ring-yellow-400';
          if (percentCorrect === 100) ringClass = 'ring-green-500';
          else if (percentCorrect === 0) ringClass = 'ring-red-500';
          quizRoot.classList.add('ring-2', ringClass);
          setTimeout(() => quizRoot.classList.remove('ring-2', 'ring-yellow-400', 'ring-green-500', 'ring-red-500'), 600);
        }
      }
    } else if (type === 'essay' || type === 'file-submission' || type === 'url-submission') {
      if (event.target.tagName === 'BUTTON') {
        let percentCorrect = 0;
        if (type === 'essay') {
          const quizElement = quizRoot.querySelector('textarea');
          if (quizElement && quizElement.value && quizElement.validity.valid) {
            let precedingContent = '';

            // Find the closest preceding heading element
            let currentElement = quizRoot;
            let headingElement = null;

            // Walk up the DOM tree to find a heading
            while (currentElement && currentElement !== document.body) {
              const precedingHeading = currentElement.closest(':is(h1, h2, h3, h4, h5, h6)');
              if (precedingHeading) {
                headingElement = precedingHeading;
                break;
              }
              // If no heading found in current path, try previous siblings
              let sibling = currentElement.previousElementSibling;
              while (sibling) {
                if (/^H[1-6]$/i.test(sibling.tagName)) {
                  headingElement = sibling;
                  break;
                }
                const nestedHeading = sibling.querySelector(':is(h1, h2, h3, h4, h5, h6)');
                if (nestedHeading) {
                  headingElement = nestedHeading;
                  break;
                }
                sibling = sibling.previousElementSibling;
              }
              if (headingElement) break;
              currentElement = currentElement.parentElement;
            }

            // If we found a heading, collect all paragraphs between it and the quiz
            if (headingElement) {
              let walker = headingElement.nextElementSibling;
              const paragraphs = [];

              while (walker && walker !== quizRoot) {
                if (walker.tagName === 'P') {
                  paragraphs.push(walker.textContent.trim());
                } else if (walker.contains(quizRoot)) {
                  // If the walker contains our quiz, look for paragraphs inside it before the quiz
                  const innerParagraphs = Array.from(walker.querySelectorAll('p')).filter((p) => !quizRoot.contains(p));
                  paragraphs.push(...innerParagraphs.map((p) => p.textContent.trim()));
                  break;
                }
                walker = walker.nextElementSibling;
              }

              precedingContent = paragraphs.join('\n');
            }

            percentCorrect = await onEssayQuiz({ id, title, type, body, precedingContent, essay: quizElement.value });
          }
        } else if (type === 'file-submission') {
          const quizElement = quizRoot.querySelector('input[type="file"]');
          if (quizElement && quizElement.value && quizElement.validity.valid) {
            percentCorrect = await onFileQuiz({ id, title, type, body, files: quizElement.files });
          }
        } else if (type === 'url-submission') {
          const quizElement = quizRoot.querySelector('input[type="url"]');
          if (quizElement && quizElement.value && quizElement.validity.valid) {
            percentCorrect = await onUrlQuiz({ id, title, type, body, url: quizElement.value });
          }
        }

        let feedbackColor = 'ring-yellow-400';
        if (percentCorrect === 100) feedbackColor = 'ring-green-500';
        else if (percentCorrect === 0) feedbackColor = 'ring-red-500';
        quizRoot.classList.add('ring-2', feedbackColor);
        setTimeout(() => quizRoot.classList.remove('ring-2', feedbackColor), 600);
      }
    }
  }

  return (
    <>
      <MarkdownInstruction
        courseOps={courseOps}
        topic={topic}
        user={user}
        languagePlugins={[
          {
            lang: 'masteryls',
            handler: handleQuizClick,
            processor: injectQuiz,
          },
        ]}
        preview={preview}
      />
    </>
  );
}
