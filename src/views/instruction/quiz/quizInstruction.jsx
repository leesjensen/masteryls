import React from 'react';
import MarkdownInstruction from '../markdownInstruction';
import EssayQuiz from './essayQuiz';
import MultipleChoiceQuiz from './multipleChoiceQuiz';
import SubmissionQuiz from './submissionQuiz';
import inlineLiteMarkdown from './inlineLiteMarkdown';

export default function QuizInstruction(props) {
  const { courseOps, topic, course } = props;

  function injectQuiz(content) {
    return generateControlComponentFromFence(content);
  }

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
  function generateControlComponentFromFence(raw) {
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    let meta = { id: undefined, title: 'Quiz', type: 'multiple-choice' };
    let itemsText = raw;

    if (jsonMatch) {
      try {
        meta = { ...meta, ...JSON.parse(jsonMatch[0]) };
        meta.type = meta.type.toLowerCase();
      } catch {}
      itemsText = raw.slice(jsonMatch.index + jsonMatch[0].length).trim();
    }
    let controlJsx = generateControlComponent(meta, itemsText);
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
      </div>
    );
  }

  function generateControlComponent(meta, itemsText) {
    let controlHtml = <div></div>;
    if (meta.type && (meta.type === 'multiple-choice' || meta.type === 'multiple-select')) {
      return <MultipleChoiceQuiz meta={meta} itemsText={itemsText} />;
    } else if (meta.type === 'essay') {
      return <EssayQuiz meta={meta} />;
    } else if (meta.type === 'file-submission') {
      return <SubmissionQuiz meta={meta} />;
    }

    return controlHtml;
  }

  async function onQuizSubmit({ id, title, type, body, choices, selected, correct, percentCorrect }) {
    if (selected.length > 0) {
      const data = {
        title,
        type,
        Question: body,
        Choices: choices.map((choice) => '\n   -' + choice).join(''),
        'Student answers': selected.map((i) => choices[i]),
        'Correct answers': correct.map((i) => choices[i]),
        'Percent correct': percentCorrect,
      };
      const feedback = await courseOps.getQuizFeedback(data);
      console.log('feedback', feedback);
    }
  }

  async function handleQuizClick(event, quizRoot) {
    const id = quizRoot.getAttribute('data-plugin-masteryls-id') || undefined;
    const title = quizRoot.getAttribute('data-plugin-masteryls-title') || undefined;
    const type = quizRoot.getAttribute('data-plugin-masteryls-type') || undefined;
    const bodyElem = quizRoot.querySelector('[data-plugin-masteryls-body]');
    const body = bodyElem ? bodyElem.textContent.trim() : undefined;

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

    console.log({ selected, correct });

    // Calculate percent correct
    const total = correct.length;
    const correctSelections = selected.filter((idx) => correct.includes(idx)).length;
    const incorrectSelections = selected.filter((idx) => !correct.includes(idx)).length;
    const matched = Math.max(0, correctSelections - incorrectSelections);
    const percentCorrect = total === 0 ? 0 : Math.round((matched / total) * 100);

    await onQuizSubmit?.({ id, title, type, body, choices, selected, correct, percentCorrect });

    // give visual feedback
    let ringClass = 'ring-yellow-400';
    if (percentCorrect === 100) ringClass = 'ring-green-500';
    else if (percentCorrect === 0) ringClass = 'ring-red-500';
    quizRoot.classList.add('ring-2', ringClass);
    setTimeout(() => quizRoot.classList.remove('ring-2', 'ring-yellow-400', 'ring-green-500', 'ring-red-500'), 600);
  }

  return (
    <MarkdownInstruction
      courseOps={courseOps}
      topic={topic}
      course={course}
      languagePlugins={[
        {
          lang: 'masteryls',
          handler: handleQuizClick,
          processor: injectQuiz,
        },
      ]}
    />
  );
}
