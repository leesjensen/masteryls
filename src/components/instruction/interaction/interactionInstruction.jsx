import React from 'react';
import MarkdownInstruction from '../markdownInstruction';
import EssayInteraction from './essayInteraction';
import PromptInteraction from './promptInteraction';
import MultipleChoiceInteraction from './multipleChoiceInteraction';
import SurveyInteraction from './surveyInteraction';
import LikertInteraction from './likertInteraction';
import FileInteraction from './fileInteraction';
import UrlInteraction from './urlInteraction';
import GithubInteraction from './githubInteraction';
import TeachingInteraction from './teachingInteraction';
import WebPageInteraction from './webPageInteraction';
import AiWebPageInteraction from './aiWebPageInteraction';
import InteractionFeedback from './interactionFeedback';
import { updateInteractionProgress, getInteractionProgress, useInteractionProgressStore } from './interactionProgressStore';
import { formatFileSize, getPrecedingContent } from '../../../utils/utils';
import { isSubmittableInteractionType, parseInteractionMeta } from '../../../utils/interactionMeta';
import { validateSubmittedUrl } from '../../../utils/urlValidation';
import { useCanvasGradebookEligibility } from '../../../hooks/canvas/useCanvasGradebookEligibility.jsx';

// See instruction.jsx for why this needs to be a stable module-level default rather than
// an inline `= {}` - it gets forwarded to markdownInstruction.jsx, whose content-load
// effect depends on previewFileUrls by reference.
const EMPTY_PREVIEW_FILE_URLS = {};

function InteractionCard({ meta, controlJsx, isObserveReadOnly, isUnauthenticatedReadOnly, instructionState, isCourseLinkedToGradebook, canSubmitToCanvasGradebook, onSyncGrade, getSubmissionFileUrl, toBoolean }) {
  const progress = useInteractionProgressStore(meta.id) || {};
  const isEvaluating = progress?.evaluationState === 'loading';
  const s = isEvaluating ? 'interaction-active-border border-transparent bg-gray-50' : progress && progress.feedback ? 'ring-2 ring-blue-400 bg-gray-50' : 'bg-blue-50';
  const isInteractionReadOnly = isObserveReadOnly || isUnauthenticatedReadOnly;

  return (
    <div className={`rounded-lg px-4 py-4 border-1 border-neutral-400 shadow-sm overflow-x-auto break-words whitespace-pre-line ${s}`} data-plugin-masteryls data-plugin-masteryls-root data-plugin-masteryls-id={meta.id} data-plugin-masteryls-title={meta.title} data-plugin-masteryls-type={meta.type} data-plugin-masteryls-grading-criteria={meta.gradingCriteria || ''} data-plugin-masteryls-url-prompt={meta.urlPrompt || ''} data-plugin-masteryls-validate-url={toBoolean(meta.validateUrl, false) ? 'true' : 'false'} data-plugin-masteryls-sync-grade={toBoolean(meta.syncGrade, false) ? 'true' : 'false'} data-plugin-masteryls-auto-grade={toBoolean(meta.autoGrade, false) ? 'true' : 'false'}>
      <fieldset>{meta.title && <legend className="font-semibold mb-3 break-words whitespace-pre-line">{meta.title}</legend>}</fieldset>
      {isUnauthenticatedReadOnly && (
        <div className="mb-2 text-base text-amber-700">
          This interaction is disabled.{' '}
          <a href="/" className="font-semibold underline underline-offset-2 hover:text-amber-800">
            Login
          </a>{' '}
          to enable all functionality.
        </div>
      )}
      {isObserveReadOnly && <div className="mb-2 text-xs text-amber-700">Observe mode is read-only. Submissions are disabled.</div>}
      <fieldset disabled={isInteractionReadOnly} className={`space-y-3 ${isInteractionReadOnly ? 'opacity-70' : ''}`.trim()}>
        {controlJsx}
      </fieldset>
      {instructionState !== 'exam' && meta.type !== 'survey' && meta.type !== 'likert' && <InteractionFeedback quizId={meta.id} onSyncGrade={onSyncGrade} getSubmissionFileUrl={getSubmissionFileUrl} isCourseLinkedToGradebook={isCourseLinkedToGradebook} canSubmitToGradebook={canSubmitToCanvasGradebook && !isInteractionReadOnly} />}
    </div>
  );
}

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
 * - likert: Multi-question shared-scale survey responses
 * - file-submission: File upload submissions
 * - url-submission: URL link submissions
 * - teaching: AI-assisted teaching sessions
 * - prompt: AI prompt generation
 * - web-page: Embedded HTML file rendered in an iframe
 * - ai-web-page: AI generated HTML page rendered in an iframe
 *
 * @returns {JSX.Element} The rendered interaction instruction component
 */
export default function InteractionInstruction({ courseOps, learningSession, user, content = null, instructionState = 'learning', quizStateReporter = null, previewFileUrls = EMPTY_PREVIEW_FILE_URLS }) {
  const isCourseLinkedToGradebook = Boolean(learningSession?.course?.externalRefs?.canvasCourseId);
  const canSubmitToCanvasGradebook = useCanvasGradebookEligibility({ courseOps, learningSession, user, isCourseLinkedToGradebook });
  const isObserveReadOnly = Boolean(learningSession?.observeMode);
  const isUnauthenticatedReadOnly = !user;

  function toBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return fallback;
  }

  /**
   * injectInteraction responds to a Markdown processor request to render an interaction.
   * @param {string} interactionContent - The raw interaction markdown content
   * @returns {JSX.Element} Interaction JSX element
   */
  function injectInteraction(interactionContent) {
    const { meta, body: interactionBody } = parseInteractionMeta(interactionContent);

    if (isSubmittableInteractionType(meta.type)) {
      quizStateReporter?.(meta.id);
    }

    let controlJsx = generateInteractionComponent(meta, interactionBody);
    if (meta.type === 'web-page') {
      return controlJsx;
    }

    return <InteractionCard meta={meta} controlJsx={controlJsx} isObserveReadOnly={isObserveReadOnly} isUnauthenticatedReadOnly={isUnauthenticatedReadOnly} instructionState={instructionState} isCourseLinkedToGradebook={isCourseLinkedToGradebook} canSubmitToCanvasGradebook={canSubmitToCanvasGradebook} onSyncGrade={syncGradeToCanvas} getSubmissionFileUrl={courseOps.getSubmissionFileUrl} toBoolean={toBoolean} />;
  }

  function generateInteractionComponent(meta, interactionBody) {
    if (meta.type && (meta.type === 'multiple-choice' || meta.type === 'multiple-select')) {
      return <MultipleChoiceInteraction id={meta.id} quizType={meta.type} body={interactionBody} />;
    } else if (meta.type === 'survey') {
      return <SurveyInteraction id={meta.id} body={interactionBody} multipleSelect={meta.multipleSelect} courseOps={courseOps} />;
    } else if (meta.type === 'likert') {
      return <LikertInteraction id={meta.id} body={interactionBody} meta={meta} courseOps={courseOps} />;
    } else if (meta.type === 'essay') {
      return <EssayInteraction id={meta.id} body={interactionBody} />;
    } else if (meta.type === 'file-submission') {
      return <FileInteraction id={meta.id} body={interactionBody} />;
    } else if (meta.type === 'url-submission') {
      return <UrlInteraction id={meta.id} body={interactionBody} validateUrl={toBoolean(meta.validateUrl, false)} urlPrompt={meta.urlPrompt || ''} gradingCriteria={meta.gradingCriteria || ''} />;
    } else if (meta.type === 'github-submission') {
      return <GithubInteraction id={meta.id} body={interactionBody} />;
    } else if (meta.type === 'teaching') {
      return <TeachingInteraction id={meta.id} topicTitle={meta.title} body={interactionBody} />;
    } else if (meta.type === 'prompt') {
      return <PromptInteraction id={meta.id} body={interactionBody} />;
    } else if (meta.type === 'web-page') {
      return <WebPageInteraction title={meta.title} file={meta.file} html={interactionBody || undefined} height={meta.height} topicPath={learningSession?.topic?.path} />;
    } else if (meta.type === 'ai-web-page') {
      const courseAllowsAiPrompt = toBoolean(learningSession?.course?.settings?.allowAiWebPagePrompt, true);
      const metaAllowsAiPrompt = toBoolean(meta.allowAiPrompt ?? meta.enableAiPrompt, courseAllowsAiPrompt);
      const enrollmentId = learningSession?.enrollment?.id;
      const getSubmissionHistory = enrollmentId
        ? async () => {
            const result = await courseOps.getProgress({ interactionId: meta.id, enrollmentId, types: ['quizSubmit'], limit: 50 });
            return result?.data || [];
          }
        : null;
      return <AiWebPageInteraction id={meta.id} title={meta.title} body={interactionBody} height={meta.height} topicPath={learningSession?.topic?.path} file={meta.file} allowAiPrompt={metaAllowsAiPrompt} getSubmissionHistory={getSubmissionHistory} />;
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
    const gradingCriteria = interactionRoot.getAttribute('data-plugin-masteryls-grading-criteria') || '';
    const syncGrade = toBoolean(interactionRoot.getAttribute('data-plugin-masteryls-sync-grade'), false);
    const autoGrade = toBoolean(interactionRoot.getAttribute('data-plugin-masteryls-auto-grade'), false);
    const bodyElem = interactionRoot.querySelector('[data-plugin-masteryls-body]');
    const body = bodyElem ? bodyElem.textContent.trim() : undefined;
    if (!user || isObserveReadOnly) {
      return;
    }
    if (type) {
      if (event.target.tagName === 'BUTTON' && event.target.id === `generate-${id}`) {
        event.target.disabled = true;
        visualizeGrading(interactionRoot);
        const interactionElement = interactionRoot.querySelector(`textarea[name="interaction-${id}"]`);
        if (interactionElement && interactionElement.value) {
          const prompt = interactionElement.value;
          updateInteractionProgress(id, { ...(getInteractionProgress(id) || {}), type, prompt, generationState: 'loading', generationFeedback: 'Generating HTML from your prompt…' });

          try {
            const html = normalizeGeneratedHtml(await courseOps.getAiWebPageResponse({ prompt }));
            updateInteractionProgress(id, { ...(getInteractionProgress(id) || {}), type, prompt, html, generationState: 'success', generationFeedback: 'HTML generated. Review and edit before submitting.' });
          } catch {
            updateInteractionProgress(id, { ...(getInteractionProgress(id) || {}), type, prompt, generationState: 'error', generationFeedback: 'Unable to generate HTML right now. Please try again.' });
          } finally {
            displayGrade(interactionRoot, -1);
          }
        } else {
          displayGrade(interactionRoot, -1);
        }
        event.target.disabled = false;
        return;
      }

      if (event.target.tagName === 'BUTTON' && event.target.id === `submit-${id}`) {
        event.target.disabled = true;
        visualizeGrading(interactionRoot);

        if (type === 'multiple-choice' || type === 'multiple-select') {
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

          if (await onChoiceInteraction({ id, title, type, body, choices, selected, correct, percentCorrect, syncGrade, autoGrade })) {
            displayGrade(interactionRoot, percentCorrect);
          }
        } else if (type === 'survey') {
          displayGrade(interactionRoot, -1);
          const inputs = Array.from(interactionRoot.querySelectorAll('input[data-plugin-masteryls-index]'));
          const selected = [];
          inputs.forEach((inp) => {
            const idx = Number(inp.getAttribute('data-plugin-masteryls-index'));
            if (inp.checked) selected.push(idx);
          });
          selected.sort((a, b) => a - b);

          await onSurveyInteraction({ id, type, selected, syncGrade, autoGrade });
        } else if (type === 'likert') {
          displayGrade(interactionRoot, -1);
          const selectedInputs = Array.from(interactionRoot.querySelectorAll('input[data-plugin-masteryls-likert-question]:checked'));
          const responses = {};
          selectedInputs.forEach((inp) => {
            const questionId = inp.getAttribute('data-plugin-masteryls-likert-question');
            const value = Number(inp.getAttribute('data-plugin-masteryls-likert-value'));
            if (questionId && Number.isFinite(value)) {
              responses[questionId] = value;
            }
          });

          const allQuestionIds = new Set(
            Array.from(interactionRoot.querySelectorAll('input[data-plugin-masteryls-likert-question]'))
              .map((inp) => inp.getAttribute('data-plugin-masteryls-likert-question'))
              .filter(Boolean),
          );
          const percentCorrect = allQuestionIds.size > 0 ? Math.round((Object.keys(responses).length / allQuestionIds.size) * 100) : 0;

          await onLikertInteraction({ id, type, responses, percentCorrect, syncGrade, autoGrade });
        } else if (type === 'essay') {
          const interactionElement = interactionRoot.querySelector('textarea');
          if (interactionElement && interactionElement.value && interactionElement.validity.valid) {
            const precedingContent = getPrecedingContent(interactionRoot);
            const percentCorrect = await onEssayInteraction({ id, title, type, body, gradingCriteria, precedingContent, essay: interactionElement.value, syncGrade, autoGrade });
            displayGrade(interactionRoot, percentCorrect);
          }
        } else if (type === 'file-submission') {
          const interactionElement = interactionRoot.querySelector('input[type="file"]');
          if (interactionElement && interactionElement.value && interactionElement.validity.valid) {
            const percentCorrect = await onFileInteraction({ id, title, type, body, files: interactionElement.files, gradingCriteria, syncGrade, autoGrade });
            displayGrade(interactionRoot, percentCorrect);
          }
        } else if (type === 'url-submission') {
          const interactionElement = interactionRoot.querySelector('input[type="url"]');
          if (interactionElement && interactionElement.value && interactionElement.validity.valid) {
            const validateUrl = toBoolean(interactionRoot.getAttribute('data-plugin-masteryls-validate-url'), false);
            const urlPrompt = interactionRoot.getAttribute('data-plugin-masteryls-url-prompt') || '';
            const percentCorrect = await onUrlInteraction({ id, title, type, body, url: interactionElement.value, validateUrl, gradingCriteria, urlPrompt, syncGrade, autoGrade });
            displayGrade(interactionRoot, percentCorrect);
          }
        } else if (type === 'github-submission') {
          const interactionElement = interactionRoot.querySelector('input[type="url"]');
          if (interactionElement && interactionElement.value && interactionElement.validity.valid) {
            const percentCorrect = await onGithubInteraction({ id, title, type, body, url: interactionElement.value, gradingCriteria, syncGrade, autoGrade });
            displayGrade(interactionRoot, percentCorrect);
          }
        } else if (type === 'teaching') {
          const progress = getInteractionProgress(id);
          const messages = progress?.messages || [];
          const percentCorrect = await onTeachingInteraction({ id, title, type, body, messages, syncGrade, autoGrade });
          displayGrade(interactionRoot, percentCorrect);
        } else if (type === 'prompt') {
          const interactionElement = interactionRoot.querySelector('textarea');
          if (interactionElement && interactionElement.value && interactionElement.validity.valid) {
            const percentCorrect = await onPromptInteraction({ id, type, body, prompt: interactionElement.value, syncGrade, autoGrade });
            displayGrade(interactionRoot, percentCorrect);
          }
        } else if (type === 'ai-web-page') {
          const progress = getInteractionProgress(id);
          const promptElement = interactionRoot.querySelector(`textarea[name="interaction-${id}"]`);
          const submitBaselineHtml = progress?.submittedHtml || (progress?.feedback ? progress?.html || '' : '');
          const hasChanges = Boolean(progress?.html) && progress.html !== submitBaselineHtml;
          if (progress?.html && hasChanges) {
            const percentCorrect = await onAiWebPageSubmit({ id, type, body, gradingCriteria, prompt: promptElement?.value || progress?.prompt || '', html: progress.html, syncGrade, autoGrade });
            displayGrade(interactionRoot, percentCorrect);
          } else {
            displayGrade(interactionRoot, progress?.percentCorrect ?? -1);
          }
        }

        // likert and ai-web-page keep their own submitDisabled logic (stay disabled until the
        // learner changes their answer/HTML) - forcing this back to enabled here would fight
        // with that and leave the button clickable right after a submission with no changes.
        if (type !== 'likert' && type !== 'ai-web-page') {
          event.target.disabled = false;
        }
      }
    }
  }

  async function syncGradeToCanvas(quizId) {
    if (isObserveReadOnly) {
      return;
    }
    const current = getInteractionProgress(quizId);
    if (!current) {
      return;
    }

    updateInteractionProgress(quizId, {
      ...current,
      canvasSyncState: 'loading',
      canvasSyncMessage: 'Submitting grade to Gradebook...',
    });

    try {
      await courseOps.syncProjectInteractionGrade(null, quizId, current);
      const latest = getInteractionProgress(quizId) || current;
      updateInteractionProgress(quizId, {
        ...latest,
        canvasSyncState: 'success',
        canvasSyncMessage: 'Grade submitted to Gradebook.',
      });
    } catch (error) {
      const latest = getInteractionProgress(quizId) || current;
      updateInteractionProgress(quizId, {
        ...latest,
        canvasSyncState: 'error',
        canvasSyncMessage: error?.message || 'Unable to submit grade to Gradebook.',
      });
    }
  }

  async function onSurveyInteraction({ id, type, selected, syncGrade = false, autoGrade = false }) {
    const details = { type, selected, syncGrade, autoGrade };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return true;
  }

  async function onLikertInteraction({ id, type, responses, percentCorrect = 0, syncGrade = false, autoGrade = false }) {
    const submittedAt = new Date().toISOString();
    const submittedAtLabel = new Date(submittedAt).toLocaleString();
    const feedback = `Submission received on ${submittedAtLabel}.`;
    const details = { type, responses, feedback, submittedAt, percentCorrect, syncGrade, autoGrade };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return true;
  }

  async function onChoiceInteraction({ id, title, type, body, choices, selected, correct, percentCorrect, syncGrade = false, autoGrade = false }) {
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
    const details = { type, selected, correct, percentCorrect, feedback, syncGrade, autoGrade };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return true;
  }

  async function onEssayInteraction({ id, title, type, body, gradingCriteria = '', precedingContent, essay, syncGrade = false, autoGrade = false }) {
    if (!essay) return false;
    const normalizedCriteria = String(gradingCriteria || '').trim();
    const data = {
      title,
      type,
      question: body,
      'question context': precedingContent,
      essay,
      ...(normalizedCriteria ? { gradingCriteria: normalizedCriteria } : {}),
    };
    const { feedback, percentCorrect } = await courseOps.getEssayInteractionFeedback(data);
    const details = { type, essay, percentCorrect, feedback, gradingCriteria: normalizedCriteria || undefined, syncGrade, autoGrade };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return percentCorrect;
  }

  async function onPromptInteraction({ id, type, body, prompt, syncGrade = false, autoGrade = false }) {
    if (!prompt) return false;
    const feedback = await courseOps.getPromptResponse(prompt);
    const details = { type, prompt, feedback, syncGrade, autoGrade };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return -1;
  }

  function normalizeGeneratedHtml(response) {
    return response
      .trim()
      .replace(/^```(?:html)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  async function onAiWebPageSubmit({ id, type, body, gradingCriteria, prompt, html, syncGrade = false, autoGrade = false }) {
    if (!html) return false;
    const normalizedCriteria = (gradingCriteria || '').trim();
    const shouldGradeWithAi = Boolean(normalizedCriteria);
    let feedback = shouldGradeWithAi ? 'Submission graded with AI criteria.' : 'Submission received. Full credit awarded.';
    let percentCorrect = 100;

    if (shouldGradeWithAi) {
      try {
        const result = await courseOps.getAiWebPageFeedback({ instructions: normalizedCriteria, directions: body, prompt, html });
        feedback = result.feedback;
        percentCorrect = result.percentCorrect ?? 100;
      } catch {
        feedback = 'Submission received. Grading criteria were provided, but AI grading is currently unavailable. Full credit awarded.';
        percentCorrect = 100;
      }
    }

    const submittedAt = new Date().toISOString();
    const submissionKey = `${submittedAt}:${Math.random().toString(36).slice(2, 10)}`;
    const details = { type, prompt, html, submittedHtml: html, percentCorrect, feedback, gradingCriteria: normalizedCriteria || undefined, submittedAt, submissionKey, syncGrade, autoGrade };
    const { submittedHtml, ...persistedDetails } = details;
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, persistedDetails);
    return percentCorrect;
  }

  async function onFileInteraction({ id, title, type, body, files, gradingCriteria = '', syncGrade = false, autoGrade = false }) {
    if (files.length === 0) return 0;

    const filesArray = Array.from(files);

    try {
      await courseOps.clearSubmissionFolder({ interactionId: id });
    } catch {
      // best-effort cleanup; proceed even if a stray prior file can't be removed
    }

    const uploaded = [];
    const failures = [];
    for (const file of filesArray) {
      try {
        const result = await courseOps.uploadSubmissionFile({ interactionId: id, file });
        uploaded.push({
          name: file.name,
          size: result.size,
          type: result.type,
          storagePath: result.storagePath,
          uploadedAt: new Date().toISOString(),
        });
      } catch (error) {
        failures.push(`${file.name}: ${error?.message || String(error)}`);
      }
    }

    if (uploaded.length === 0) {
      const feedback = `Submission failed. ${failures.join(' ')}`.trim();
      const details = { type, files: [], feedback, syncGrade, autoGrade };
      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      return 0;
    }

    const totalSize = uploaded.reduce((sum, f) => sum + f.size, 0);
    const ackFeedback = `Submission received. ${uploaded.length} file${uploaded.length === 1 ? '' : 's'}, ${formatFileSize(totalSize)}.`;
    const rejectionNote = failures.length > 0 ? `Some files were rejected: ${failures.join(' ')}` : '';

    const normalizedCriteria = String(gradingCriteria || '').trim();
    if (!normalizedCriteria) {
      const feedback = rejectionNote ? `${ackFeedback} ${rejectionNote}` : ackFeedback;
      const details = { type, files: uploaded, feedback, syncGrade, autoGrade };
      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      return 100;
    }

    const successfullyUploadedFiles = filesArray.filter((file) => uploaded.some((u) => u.name === file.name && u.size === file.size));
    let aiFeedback = '';
    let percentCorrect = 100;
    let aiError = null;
    try {
      const filesForGrading = await Promise.all(
        successfullyUploadedFiles.map(async (file) => ({
          name: file.name,
          type: file.type,
          base64: await readFileAsBase64(file),
        })),
      );
      const result = await courseOps.getFileInteractionFeedback({ title, type, body, files: filesForGrading }, normalizedCriteria);
      aiFeedback = result?.feedback || '';
      const parsedPercent = Number(result?.percentCorrect);
      if (Number.isFinite(parsedPercent)) {
        percentCorrect = parsedPercent;
      }
    } catch (error) {
      aiError = error?.message || String(error);
      percentCorrect = 0;
    }

    const parts = [ackFeedback];
    if (rejectionNote) parts.push(rejectionNote);
    if (aiError) parts.push(`Unable to complete criteria-based grading: ${aiError}`);
    else if (aiFeedback) parts.push(aiFeedback);
    const feedback = parts.join('\n\n');

    const details = {
      type,
      files: uploaded,
      gradingCriteria: normalizedCriteria,
      percentCorrect,
      feedback,
      syncGrade,
      autoGrade,
    };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return percentCorrect;
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function onUrlInteraction({ id, title, type, body, url, validateUrl = false, gradingCriteria = '', urlPrompt = '', syncGrade = false, autoGrade = false }) {
    if (!url) return 0;

    const normalizedCriteria = String(gradingCriteria || '').trim();
    const normalizedUrlPrompt = String(urlPrompt || '').trim();

    if (normalizedCriteria) {
      try {
        const result = await courseOps.getCriteriaTargetFeedback({ title, type, body, learnerUrl: url }, normalizedCriteria, normalizedUrlPrompt);
        const percentCorrect = Number(result?.percentCorrect ?? 0);
        const feedback = result?.feedback || 'Submission received.';
        const details = {
          type,
          url,
          validateUrl,
          gradingCriteria: normalizedCriteria,
          urlPrompt: normalizedUrlPrompt,
          targetUrl: result?.targetUrl,
          fetchStatus: result?.fetchStatus,
          percentCorrect,
          feedback,
          syncGrade,
          autoGrade,
        };
        updateInteractionProgress(id, details);
        await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
        return percentCorrect;
      } catch (error) {
        const feedback = `Unable to complete criteria-based grading: ${error?.message || String(error)}`;
        const details = {
          type,
          url,
          validateUrl,
          gradingCriteria: normalizedCriteria,
          urlPrompt: normalizedUrlPrompt,
          percentCorrect: 0,
          feedback,
          syncGrade,
          autoGrade,
        };
        updateInteractionProgress(id, details);
        await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
        return 0;
      }
    }

    const validateWithServer = validateUrl
      ? ({ url: normalizedUrl, timeoutMs }) => {
          if (typeof courseOps?.validateUrlFromServer === 'function') {
            return courseOps.validateUrlFromServer({ url: normalizedUrl, timeoutMs });
          }
          if (typeof courseOps?.service?.makeUrlValidationRequest === 'function') {
            return courseOps.service.makeUrlValidationRequest({ url: normalizedUrl, timeoutMs });
          }
          throw new Error('URL validation service is not configured.');
        }
      : null;
    const { percentCorrect, feedback, validationStatus } = await validateSubmittedUrl({ url, validateUrl, validateWithServer });
    const details = { type, url, validateUrl, validationStatus, percentCorrect, feedback, syncGrade, autoGrade };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return percentCorrect;
  }

  async function onGithubInteraction({ id, title, type, body, url, gradingCriteria = '', syncGrade = false, autoGrade = false }) {
    if (!url) return 0;
    const normalizedCriteria = String(gradingCriteria || '').trim();

    if (!normalizedCriteria) {
      const feedback = 'No grading criteria configured for this submission.';
      const details = { type, url, percentCorrect: 0, feedback, syncGrade, autoGrade };
      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      return 0;
    }

    try {
      const result = await courseOps.getGithubInteractionFeedback({ title, type, body, url }, normalizedCriteria);
      const percentCorrect = Number(result?.percentCorrect ?? 0);
      const feedback = result?.feedback || 'Submission received.';
      const details = {
        type,
        url,
        gradingCriteria: normalizedCriteria,
        filesIncluded: result?.filesIncluded,
        filesSkipped: result?.filesSkipped,
        branch: result?.branch,
        percentCorrect,
        feedback,
        syncGrade,
        autoGrade,
      };
      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      return percentCorrect;
    } catch (error) {
      const feedback = `Unable to grade GitHub submission: ${error?.message || String(error)}`;
      const details = { type, url, gradingCriteria: normalizedCriteria, percentCorrect: 0, feedback, syncGrade, autoGrade };
      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      return 0;
    }
  }

  async function onTeachingInteraction({ id, title, type, body, messages, syncGrade = false, autoGrade = false }) {
    if (messages.length === 0) return 0;
    const percentMatch = messages[messages.length - 1].content?.match(/Understanding Score:\s*(\d+)%/);
    const percentCorrect = percentMatch ? parseInt(percentMatch[1], 10) : 0;
    let feedback = 'Session submitted';
    const details = { type, messages, percentCorrect, feedback, syncGrade, autoGrade };
    updateInteractionProgress(id, details);
    await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
    return percentCorrect;
  }

  function visualizeGrading(quizRoot) {
    const interactionId = quizRoot.getAttribute('data-plugin-masteryls-id');
    if (interactionId) {
      const current = getInteractionProgress(interactionId) || {};
      updateInteractionProgress(interactionId, {
        ...current,
        evaluationState: 'loading',
        evaluationMessage: 'Evaluating your response...',
        evaluationStartedAt: Date.now(),
      });
    }
    quizRoot.classList.remove('ring-blue-400', 'ring-green-500', 'ring-yellow-400', 'ring-red-500', 'ring-gray-400', 'bg-blue-50', 'bg-white');
    quizRoot.classList.add('ring-2', 'ring-gray-400', 'bg-gray-50');
  }

  function displayGrade(quizRoot, percentCorrect) {
    const interactionId = quizRoot.getAttribute('data-plugin-masteryls-id');
    if (interactionId) {
      const current = getInteractionProgress(interactionId) || {};
      updateInteractionProgress(interactionId, {
        ...current,
        evaluationState: 'idle',
      });
    }

    let ringClass = 'ring-blue-400';
    if (instructionState !== 'exam' && percentCorrect >= 0) {
      if (percentCorrect === 100) ringClass = 'ring-green-500';
      else if (percentCorrect === 0) ringClass = 'ring-red-500';
      else ringClass = 'ring-yellow-400';
    }
    quizRoot.classList.remove('ring-blue-400', 'ring-green-500', 'ring-yellow-400', 'ring-red-500', 'ring-gray-400', 'bg-gray-50', 'bg-white', 'opacity-25', 'animate-pulse');
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
      previewFileUrls={previewFileUrls}
    />
  );
}
