// Disciplinary Reasoning Assessment (DRA) backing-file format.
//
// The backing file stores only the author's generation parameters (discipline,
// problem type, difficulty, mode, instability, learning outcomes). The scenario,
// stakeholders, and resources are generated per-learner at runtime and live in the
// learner's progress record, not here.
//
// The source of truth is a JSON object in a fenced ```json block under an
// "Assessment Definition" heading. A human-readable Markdown body is regenerated on
// every serialize so the file still renders on GitHub and never drifts from the JSON.

const DRA_DEFINITION_HEADING = 'Assessment Definition';
const DRA_FENCE_RE = /```json\s*\n([\s\S]*?)```/g;

export function createEmptyDraModel(title = '') {
  return {
    title: title || '',
    discipline: '',
    problemType: '',
    difficulty: 3,
    practiceMode: true,
    finalMode: false,
    instability: false,
    engagementDescription: '',
    learningOutcomes: '',
  };
}

function normalizeModel(raw, title = '') {
  const defaults = createEmptyDraModel(title);
  const source = raw && typeof raw === 'object' ? raw : {};
  const model = { ...defaults, ...source };

  model.title = typeof model.title === 'string' ? model.title : defaults.title;
  model.discipline = typeof model.discipline === 'string' ? model.discipline : '';
  model.problemType = typeof model.problemType === 'string' ? model.problemType : '';

  const difficulty = Number(model.difficulty);
  model.difficulty = Number.isFinite(difficulty) ? Math.min(5, Math.max(1, Math.round(difficulty))) : defaults.difficulty;

  // Migrate the legacy single `mode` ('practice' | 'final') to independent booleans.
  if (typeof source.practiceMode !== 'boolean' && typeof source.finalMode !== 'boolean' && typeof source.mode === 'string') {
    model.practiceMode = source.mode !== 'final';
    model.finalMode = source.mode === 'final';
  }
  model.practiceMode = Boolean(model.practiceMode);
  model.finalMode = Boolean(model.finalMode);
  if (!model.practiceMode && !model.finalMode) {
    model.practiceMode = true; // at least one mode must be enabled
  }
  delete model.mode;

  model.instability = Boolean(model.instability);
  model.engagementDescription = typeof model.engagementDescription === 'string' ? model.engagementDescription : '';
  model.learningOutcomes = typeof model.learningOutcomes === 'string' ? model.learningOutcomes : '';

  return model;
}

export function parseDraMarkdown(markdown = '') {
  const fences = [...String(markdown || '').matchAll(DRA_FENCE_RE)];

  // The definition fence is appended last; prefer the last fence that parses so a
  // ```json block inside the learning outcomes text can't shadow it.
  for (let i = fences.length - 1; i >= 0; i -= 1) {
    try {
      return normalizeModel(JSON.parse(fences[i][1].trim()));
    } catch {
      // try an earlier fence
    }
  }

  return createEmptyDraModel();
}

export function serializeDraMarkdown(model) {
  const m = normalizeModel(model);
  const lines = [];

  lines.push(`# ${m.title || 'Disciplinary Reasoning Assessment'}`);
  lines.push('');
  lines.push(`**Discipline:** ${m.discipline || '_unspecified_'}`);
  lines.push(`**Problem type:** ${m.problemType || '_unspecified_'}`);
  lines.push(`**Difficulty:** ${m.difficulty} / 5`);
  lines.push(`**Modes:** ${[m.practiceMode && 'Practice', m.finalMode && 'Final'].filter(Boolean).join(', ') || 'Practice'}`);
  lines.push(`**Instability:** ${m.instability ? 'On' : 'Off'}`);
  lines.push('');
  lines.push('## Engagement Description');
  lines.push('');
  lines.push(m.engagementDescription || '_Engagement description to be defined._');
  lines.push('');
  lines.push('## Learning Outcomes');
  lines.push('');
  lines.push(m.learningOutcomes || '_Learning outcomes to be defined._');
  lines.push('');
  lines.push(`## ${DRA_DEFINITION_HEADING}`);
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(m, null, 2));
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

export function createInitialDraMarkdown(title = '') {
  return serializeDraMarkdown(createEmptyDraModel(title));
}
