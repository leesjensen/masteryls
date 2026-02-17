import React from 'react';
import MarkdownInstruction from '../markdownInstruction';
import EssayInteraction from './essayInteraction';
import PromptInteraction from './promptInteraction';
import MultipleChoiceInteraction from './multipleChoiceInteraction';
import SurveyInteraction from './surveyInteraction';
import FileInteraction from './fileInteraction';
import UrlInteraction from './urlInteraction';
import TeachingInteraction from './teachingInteraction';
import { getInteractionProgress } from './interactionProgressStore';

/**
 * InteractionInstruction component that renders interactive quiz content within markdown instruction.
 * Supports multiple quiz types including multiple choice, essay, file submission, and URL submission.
 *
 * Each interaction type is self-contained — it handles its own rendering, user input,
 * submission logic, progress tracking, and feedback display. This component is a thin
 * orchestrator that parses the interaction markdown block, selects the appropriate component,
 * and provides shared props.
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
 * Question with **Markdown** formatting.
 *
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
 * - survey: Survey/poll responses
 *
 * @returns {JSX.Element} The rendered interaction instruction component
 */
export default function InteractionInstruction({ courseOps, learningSession, user, content = null, instructionState = 'learning', quizStateReporter = null }) {
  /**
   * injectInteraction responds to a Markdown processor request to render an interaction.
   * Parses the interaction metadata from the markdown block and renders the appropriate
   * self-contained interaction component.
   * @param {string} interactionContent - The raw interaction markdown content
   * @returns {JSX.Element} Interaction JSX element
   */
  function injectInteraction(interactionContent) {
    const jsonMatch = interactionContent.match(/^\{[\s\S]*?\}(?:\n|$)/);
    let meta = { id: undefined, title: '', type: 'multiple-choice' };
    let interactionBody = interactionContent;

    if (jsonMatch) {
      try {
        meta = { ...meta, ...JSON.parse(jsonMatch[0]) };
        meta.type = meta.type.toLowerCase();
      } catch {}
      interactionBody = interactionContent.slice(jsonMatch.index + jsonMatch[0].length).trim();
    }

    quizStateReporter?.(meta.id);

    const progress = getInteractionProgress(meta.id);
    const s = progress && progress.feedback ? 'ring-2 ring-blue-400 bg-gray-50' : 'bg-blue-50';

    /**
     * Callback for grading visualization. Called by each interaction component
     * when a submission is being processed or has been graded.
     * @param {number|'pending'} percentCorrect - The grade (0-100), -1 for ungraded, or 'pending' while grading
     */
    function onGraded(percentCorrect) {
      const root = document.querySelector(`[data-plugin-masteryls-id="${meta.id}"]`);
      if (!root) return;

      if (percentCorrect === 'pending') {
        root.classList.remove('ring-blue-400', 'ring-green-500', 'ring-yellow-400', 'ring-red-500', 'ring-gray-400', 'bg-blue-50', 'bg-white');
        root.classList.add('ring-2', 'ring-gray-400', 'bg-gray-50', 'opacity-25', 'animate-pulse');
        return;
      }

      let ringClass = 'ring-blue-400';
      if (instructionState !== 'exam' && percentCorrect >= 0) {
        if (percentCorrect === 100) ringClass = 'ring-green-500';
        else if (percentCorrect === 0) ringClass = 'ring-red-500';
        else ringClass = 'ring-yellow-400';
      }
      root.classList.remove('ring-blue-400', 'ring-green-500', 'ring-yellow-400', 'ring-red-500', 'ring-gray-400', 'bg-gray-50', 'bg-white', 'opacity-25', 'animate-pulse');
      root.classList.add('ring-2', ringClass, 'bg-gray-50');
    }

    const commonProps = {
      id: meta.id,
      body: interactionBody,
      courseOps,
      instructionState,
      onGraded,
    };

    let controlJsx = null;
    if (meta.type === 'multiple-choice' || meta.type === 'multiple-select') {
      controlJsx = <MultipleChoiceInteraction quizType={meta.type} {...commonProps} title={meta.title} />;
    } else if (meta.type === 'survey') {
      controlJsx = <SurveyInteraction multipleSelect={meta.multipleSelect} {...commonProps} />;
    } else if (meta.type === 'essay') {
      controlJsx = <EssayInteraction {...commonProps} title={meta.title} />;
    } else if (meta.type === 'file-submission') {
      controlJsx = <FileInteraction {...commonProps} title={meta.title} />;
    } else if (meta.type === 'url-submission') {
      controlJsx = <UrlInteraction {...commonProps} title={meta.title} />;
    } else if (meta.type === 'teaching') {
      controlJsx = <TeachingInteraction topicTitle={meta.title} {...commonProps} />;
    } else if (meta.type === 'prompt') {
      controlJsx = <PromptInteraction {...commonProps} />;
    }

    return (
      <div className={`px-4 py-4 border-1 border-neutral-400 shadow-sm overflow-x-auto break-words whitespace-pre-line ${s}`} data-plugin-masteryls data-plugin-masteryls-root data-plugin-masteryls-id={meta.id} data-plugin-masteryls-title={meta.title} data-plugin-masteryls-type={meta.type}>
        <fieldset>{meta.title && <legend className="font-semibold mb-3 break-words whitespace-pre-line">{meta.title}</legend>}</fieldset>
        <div className="space-y-3">{controlJsx}</div>
      </div>
    );
  }

  return (
    <MarkdownInstruction
      courseOps={courseOps}
      learningSession={learningSession}
      user={user}
      languagePlugins={[
        {
          lang: 'masteryls',
          processor: injectInteraction,
        },
      ]}
      content={content}
      instructionState={instructionState}
    />
  );
}
