// Interview topic backing-file format.
//
// The backing file stores only the author's generation parameters. The scenario,
// interviewers, and sessions are generated per-learner at runtime and live in
// the learner's progress record, not here.
//
// The source of truth is a JSON object in a fenced ```json block under an
// "Assessment Definition" heading.

const INTERVIEW_DEFINITION_HEADING = 'Assessment Definition';
const INTERVIEW_FENCE_RE = /```json\s*\n([\s\S]*?)```/g;

export function createEmptyInterviewModel(title = '') {
  return {
    title: title || '',
    discipline: '',
    jobTitle: '',
    jobDescription: '',
    difficulty: 3,
    practiceMode: true,
    finalMode: false,
    learningOutcomes: '',
  };
}

function normalizeModel(raw, title = '') {
  const defaults = createEmptyInterviewModel(title);
  const source = raw && typeof raw === 'object' ? raw : {};
  const model = { ...defaults, ...source };

  model.title = typeof model.title === 'string' ? model.title : defaults.title;
  model.discipline = typeof model.discipline === 'string' ? model.discipline : '';
  model.jobTitle = typeof model.jobTitle === 'string' ? model.jobTitle : '';
  model.jobDescription = typeof model.jobDescription === 'string' ? model.jobDescription : '';

  const difficulty = Number(model.difficulty);
  model.difficulty = Number.isFinite(difficulty) ? Math.min(5, Math.max(1, Math.round(difficulty))) : defaults.difficulty;

  model.practiceMode = Boolean(model.practiceMode);
  model.finalMode = Boolean(model.finalMode);
  if (!model.practiceMode && !model.finalMode) {
    model.practiceMode = true;
  }

  model.learningOutcomes = typeof model.learningOutcomes === 'string' ? model.learningOutcomes : '';

  return model;
}

export function parseInterviewMarkdown(markdown = '') {
  const fences = [...String(markdown || '').matchAll(INTERVIEW_FENCE_RE)];

  for (let i = fences.length - 1; i >= 0; i -= 1) {
    try {
      return normalizeModel(JSON.parse(fences[i][1].trim()));
    } catch {
      // try an earlier fence
    }
  }

  return createEmptyInterviewModel();
}

export function serializeInterviewMarkdown(model) {
  const m = normalizeModel(model);
  const lines = [];

  lines.push(`# ${m.title || 'Interview Assessment'}`);
  lines.push('');
  lines.push(`**Discipline:** ${m.discipline || '_unspecified_'}`);
  lines.push(`**Job title:** ${m.jobTitle || '_unspecified_'}`);
  lines.push(`**Difficulty:** ${m.difficulty} / 5`);
  lines.push(`**Modes:** ${[m.practiceMode && 'Practice', m.finalMode && 'Final'].filter(Boolean).join(', ') || 'Practice'}`);
  lines.push('');
  lines.push('## Job Description');
  lines.push('');
  lines.push(m.jobDescription || '_Job description to be defined._');
  lines.push('');
  lines.push('## Learning Outcomes');
  lines.push('');
  lines.push(m.learningOutcomes || '_Learning outcomes to be defined._');
  lines.push('');
  lines.push(`## ${INTERVIEW_DEFINITION_HEADING}`);
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(m, null, 2));
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

export function createInitialInterviewMarkdown(title = '') {
  return serializeInterviewMarkdown(createEmptyInterviewModel(title));
}
