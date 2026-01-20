import React from 'react';
import MarkdownInstruction from '../markdownInstruction';
import EssayInteraction from './essayInteraction';
import PromptInteraction from './promptInteraction';
import MultipleChoiceInteraction from './multipleChoiceInteraction';
import SurveyInteraction from './surveyInteraction';
import FileInteraction from './fileInteraction';
import UrlInteraction from './urlInteraction';
import TeachingInteraction from './teachingInteraction';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import InteractionFeedback from './interactionFeedback';
import { updateInteractionProgress, getInteractionProgress } from './interactionProgressStore';
import { formatFileSize } from '../../../utils/utils';

/**
 * InteractionInstruction component that renders interactive quiz content within markdown instruction.
 * Supports multiple quiz types including multiple choice, essay, file submission, and URL submission.
 *
 * @component
 * @param {Object} props - The component props
 * @param {Object} props.courseOps - Course operations object containing methods for quiz feedback and progress tracking
 * @param {string} props.learningSession - The current learning session identifier
 * @param {Object} props.user - User object containing user information
 * @param {string|null} [props.content=null] - Use this content instead of loading the topic content
 * @param {string} [props.instructionState='learning'] - Current instruction state ('learning', 'exam', or 'examReview')
 *
 * @description
 * The quiz markdown format follows this syntax:
 * ```
 * {"id":"39283", "title":"Multiple choice", "type":"multiple-choice" }
 * - [ ] This is **not** the right answer
 * - [x] This is _the_ right answer
 * - [ ] This one has a [link](https://cow.com)
 * - [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
 * ```
 *
 * Supported interaction types:
 * - multiple-choice: Single correct answer selection
 * - multiple-select: Multiple correct answers selection
 * - essay: Text-based essay responses
 * - file-submission: File upload submissions
 * - url-submission: URL link submissions
 * - teaching: AI-assisted teaching sessions
 * - prompt: AI prompt generation
 *
 * @returns {JSX.Element} The rendered interaction instruction component
 */
export default function InteractionInstruction({ courseOps, learningSession, user, content = null, instructionState = 'learning', quizStateReporter = null }) {
  /**
   * injectInteraction responds to a Markdown processor request to render an interaction.
   * @param {string} content - The raw interaction markdown content
   * @returns {JSX.Element} Interaction JSX element
   */
  function injectInteraction(content) {
    const jsonMatch = content.match(/^\{[\s\S]*?\}(?:\n|$)/);
    let meta = { id: undefined, title: '', type: 'multiple-choice' };
    let interactionBody = content;

    if (jsonMatch) {
      try {
        meta = { ...meta, ...JSON.parse(jsonMatch[0]) };
        meta.type = meta.type.toLowerCase();
      } catch {}
      interactionBody = content.slice(jsonMatch.index + jsonMatch[0].length).trim();
    }

    quizStateReporter?.(meta.id);

    let controlJsx = generateInteractionComponent(meta, interactionBody);
    const progress = getInteractionProgress(meta.id);
    const s = progress && progress.feedback ? 'ring-2 ring-blue-400 bg-gray-50' : 'bg-blue-50';
    return (
      <div className={`px-4 py-4 border-1 border-neutral-400 shadow-sm overflow-x-auto break-words whitespace-pre-line ${s}`} data-plugin-masteryls data-plugin-masteryls-root data-plugin-masteryls-id={meta.id} data-plugin-masteryls-title={meta.title} data-plugin-masteryls-type={meta.type}>
        <fieldset>{meta.title && <legend className="font-semibold mb-3 break-words whitespace-pre-line">{meta.title}</legend>}</fieldset>
        <div className="space-y-3">{controlJsx}</div>
        {instructionState !== 'exam' && meta.type !== 'survey' && <InteractionFeedback quizId={meta.id} />}
      </div>
    );
  }

  function generateInteractionComponent(meta, interactionBody) {
    if (meta.type && (meta.type === 'multiple-choice' || meta.type === 'multiple-select')) {
      return <MultipleChoiceInteraction quizId={meta.id} quizType={meta.type} body={interactionBody} />;
    } else if (meta.type === 'survey') {
      return <SurveyInteraction quizId={meta.id} body={interactionBody} multipleSelect={meta.multipleSelect} courseOps={courseOps} />;
    } else if (meta.type === 'essay') {
      return <EssayInteraction id={meta.id} body={interactionBody} />;
    } else if (meta.type === 'file-submission') {
      return <FileInteraction quizId={meta.id} body={interactionBody} />;
    } else if (meta.type === 'url-submission') {
      return <UrlInteraction quizId={meta.id} body={interactionBody} />;
    } else if (meta.type === 'teaching') {
      return <TeachingInteraction id={meta.id} topicTitle={meta.title} body={interactionBody} />;
    } else if (meta.type === 'prompt') {
      return <PromptInteraction id={meta.id} body={interactionBody} />;
    }

    return null;
  }

  /**
   * Handles click events on interaction elements.
   * @param {Event} event - The click event
   * @param {HTMLElement} interactionRoot - The root element of the interaction
   */
  async function handleInteractionClick(event, interactionRoot) {
    const type = interactionRoot.getAttribute('data-plugin-masteryls-type') || undefined;
    const id = interactionRoot.getAttribute('data-plugin-masteryls-id') || undefined;
    const title = interactionRoot.getAttribute('data-plugin-masteryls-title') || undefined;
    const bodyElem = interactionRoot.querySelector('[data-plugin-masteryls-body]');
    const body = bodyElem ? bodyElem.textContent.trim() : undefined;
    if (type === 'survey') {
      if (event.target.tagName === 'INPUT') {
        gradedFeedback(interactionRoot, -1);
        const inputs = Array.from(interactionRoot.querySelectorAll('input[data-plugin-masteryls-index]'));
        const selected = [];
        inputs.forEach((inp) => {
          const idx = Number(inp.getAttribute('data-plugin-masteryls-index'));
          if (inp.checked) selected.push(idx);
        });
        selected.sort((a, b) => a - b);

        await onSurveyInteraction({ id, type, selected });
      }
    } else if (type === 'multiple-choice' || type === 'multiple-select') {
      if (event.target.tagName === 'INPUT') {
        submissionFeedback(interactionRoot);

        const inputs = Array.from(interactionRoot.querySelectorAll('input[data-plugin-masteryls-index]'));
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

        if (await onChoiceInteraction({ id, title, type, body, choices, selected, correct, percentCorrect })) {
          gradedFeedback(interactionRoot, percentCorrect);
        }
      }
    } else if (type === 'essay' || type === 'file-submission' || type === 'url-submission' || type === 'teaching' || type === 'prompt') {
      if (event.target.tagName === 'BUTTON') {
        event.target.disabled = true;
        submissionFeedback(interactionRoot);

        let percentCorrect = 0;
        if (type === 'essay') {
          const interactionElement = interactionRoot.querySelector('textarea');
          if (interactionElement && interactionElement.value && interactionElement.validity.valid) {
            let precedingContent = getPrecedingContent(interactionRoot);
            percentCorrect = await onEssayInteraction({ id, title, type, body, precedingContent, essay: interactionElement.value });
          }
          gradedFeedback(interactionRoot, percentCorrect);
        } else if (type === 'file-submission') {
          const interactionElement = interactionRoot.querySelector('input[type="file"]');
          if (interactionElement && interactionElement.value && interactionElement.validity.valid) {
            percentCorrect = await onFileInteraction({ id, title, type, body, files: interactionElement.files });
          }
          gradedFeedback(interactionRoot, percentCorrect);
        } else if (type === 'url-submission') {
          const interactionElement = interactionRoot.querySelector('input[type="url"]');
          if (interactionElement && interactionElement.value && interactionElement.validity.valid) {
            percentCorrect = await onUrlInteraction({ id, title, type, body, url: interactionElement.value });
          }
          gradedFeedback(interactionRoot, percentCorrect);
        } else if (type === 'teaching') {
          if (event.target.id === 'submit-session') {
            const progress = getInteractionProgress(id);
            const messages = progress?.messages || [];
            percentCorrect = await onTeachingInteraction({ id, title, type, body, messages });
            gradedFeedback(interactionRoot, percentCorrect);
          }
        } else if (type === 'prompt') {
          const interactionElement = interactionRoot.querySelector('textarea');
          if (interactionElement && interactionElement.value && interactionElement.validity.valid) {
            percentCorrect = await onPromptInteraction({ id, type, body, prompt: interactionElement.value });
            gradedFeedback(interactionRoot, percentCorrect);
          }
        }

        event.target.disabled = false;
      }
    }
  }

  function getPrecedingContent(quizRoot) {
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
    return precedingContent;
  }

  async function onSurveyInteraction({ id, type, selected }) {
    const details = { type, selected };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return true;
  }

  async function onChoiceInteraction({ id, title, type, body, choices, selected, correct, percentCorrect }) {
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
      feedback = await courseOps.getChoiceInteractionFeedback(data);
    } catch {
      feedback = `${percentCorrect === 100 ? 'Great job! You got it all correct.' : `Good effort. Review the material see where you went wrong.`}`;
    }
    const details = { type, selected, correct, percentCorrect, feedback };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return true;
  }

  async function onEssayInteraction({ id, title, type, body, precedingContent, essay }) {
    if (!essay) return false;
    const data = {
      title,
      type,
      question: body,
      'question context': precedingContent,
      essay,
    };
    const { feedback, percentCorrect } = await courseOps.getEssayInteractionFeedback(data);
    const details = { type, essay, percentCorrect, feedback };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return percentCorrect;
  }

  async function onPromptInteraction({ id, type, body, prompt }) {
    if (!prompt) return false;
    const feedback = await courseOps.getPromptResponse(prompt);
    const details = { type, prompt, feedback };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return -1;
  }

  async function onFileInteraction({ id, title, type, body, files }) {
    if (files.length === 0) return 0;
    const progressFiles = Array.from(files).map((file) => ({ name: file.name, size: file.size, type: file.type, date: file.lastModifiedDate }));
    let feedback = `Submission received. Total files: ${progressFiles.length}. Total size: ${formatFileSize(progressFiles.reduce((total, file) => total + file.size, 0))}. Thank you!`;
    const details = { type, files: progressFiles, feedback };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return 100;
  }

  async function onUrlInteraction({ id, title, type, body, url }) {
    if (!url) return 0;
    let feedback = 'Submission received. Thank you!';
    const details = { type, url, feedback };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return 100;
  }

  async function onTeachingInteraction({ id, title, type, body, messages }) {
    if (messages.length === 0) return 0;
    const percentMatch = messages[messages.length - 1].content?.match(/Understanding Score:\s*(\d+)%/);
    const percentCorrect = percentMatch ? parseInt(percentMatch[1], 10) : 0;
    let feedback = 'Session submitted';
    const details = { type, messages, percentCorrect, feedback };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return percentCorrect;
  }

  function submissionFeedback(quizRoot) {
    quizRoot.classList.remove('ring-blue-400', 'ring-green-500', 'ring-yellow-400', 'ring-red-500', 'ring-gray-400', 'bg-blue-50', 'bg-white');
    quizRoot.classList.add('ring-2', 'ring-gray-400', 'bg-gray-50');
  }

  function gradedFeedback(quizRoot, percentCorrect) {
    let ringClass = 'ring-blue-400';
    if (instructionState !== 'exam' && percentCorrect >= 0) {
      if (percentCorrect === 100) ringClass = 'ring-green-500';
      else if (percentCorrect === 0) ringClass = 'ring-red-500';
      else ringClass = 'ring-yellow-400';
    }
    quizRoot.classList.remove('ring-blue-400', 'ring-green-500', 'ring-yellow-400', 'ring-red-500', 'ring-gray-400', 'bg-gray-50', 'bg-white');
    quizRoot.classList.add('ring-2', ringClass, 'bg-gray-50');
  }

  return (
    <MarkdownInstruction
      courseOps={courseOps}
      learningSession={learningSession}
      user={user}
      languagePlugins={[
        {
          lang: 'masteryls',
          handler: handleInteractionClick,
          processor: injectInteraction,
        },
      ]}
      content={content}
      instructionState={instructionState}
    />
  );
}
