// Parses the markdown body of a multiple-choice/multiple-select interaction into its prompt and
// choices. A choice may carry optional feedback markdown: any lines indented by at least two
// spaces (blank lines allowed in between) immediately following its "- [ ]"/"- [x]" line are
// collected, dedented, and attached to that choice - shown to the learner instead of calling the
// AI feedback generator when they select it.
export function parseMultipleChoiceBody(body = '') {
  const lines = body.split('\n');
  const firstChoiceIndex = lines.findIndex((line) => line.startsWith('- ['));

  const promptLines = firstChoiceIndex >= 0 ? lines.slice(0, firstChoiceIndex) : lines;
  const choiceLines = firstChoiceIndex >= 0 ? lines.slice(firstChoiceIndex) : [];

  const prompt = promptLines.join('\n').trim();
  const choices = [];

  choiceLines.forEach((line) => {
    const choiceMatch = /^-\s*\[\s*([xX ])\s*\]\s*(.*)$/.exec(line);
    if (choiceMatch) {
      choices.push({ correct: /[xX]/.test(choiceMatch[1]), text: choiceMatch[2].trim(), feedbackLines: [] });
      return;
    }

    if (choices.length === 0) {
      return;
    }

    if (!line.trim()) {
      choices[choices.length - 1].feedbackLines.push('');
      return;
    }

    const indentedMatch = /^\s{2,}(.*)$/.exec(line);
    if (indentedMatch) {
      choices[choices.length - 1].feedbackLines.push(indentedMatch[1]);
    }
  });

  return {
    prompt,
    choices: choices.map(({ text, correct, feedbackLines }) => ({
      text,
      correct,
      feedback: feedbackLines.join('\n').trim(),
    })),
  };
}
