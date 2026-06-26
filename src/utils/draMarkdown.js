// Disciplinary Reasoning Assessment (DRA) backing-file format.
//
// The DRA definition will grow into deeply-nested data (stakeholders, resources,
// inflection points, rubric). To stay robust as the model grows, the source of truth
// is a JSON object in a fenced ```json block under an "Assessment Definition" heading.
// A human-readable Markdown body is regenerated on every serialize so the file still
// renders on GitHub and never drifts from the JSON.

const DRA_DEFINITION_HEADING = 'Assessment Definition';
const DRA_FENCE_RE = /```json\s*\n([\s\S]*?)```/g;

export const DRA_MODES = ['practice', 'final'];

export function createEmptyDraModel(title = '') {
  return {
    title: title || '',
    discipline: '',
    problemType: '',
    difficulty: 3,
    mode: 'practice',
    instability: false,
    scenarioTitle: '',
    scenarioGoal: '',
  };
}

function normalizeModel(raw, title = '') {
  const defaults = createEmptyDraModel(title);
  const model = { ...defaults, ...(raw && typeof raw === 'object' ? raw : {}) };

  model.title = typeof model.title === 'string' ? model.title : defaults.title;
  model.discipline = typeof model.discipline === 'string' ? model.discipline : '';
  model.problemType = typeof model.problemType === 'string' ? model.problemType : '';

  const difficulty = Number(model.difficulty);
  model.difficulty = Number.isFinite(difficulty) ? Math.min(5, Math.max(1, Math.round(difficulty))) : defaults.difficulty;

  model.mode = DRA_MODES.includes(model.mode) ? model.mode : 'practice';
  model.instability = Boolean(model.instability);
  model.scenarioTitle = typeof model.scenarioTitle === 'string' ? model.scenarioTitle : '';
  model.scenarioGoal = typeof model.scenarioGoal === 'string' ? model.scenarioGoal : '';

  return model;
}

export function parseDraMarkdown(markdown = '') {
  const fences = [...String(markdown || '').matchAll(DRA_FENCE_RE)];

  // The definition fence is appended last; prefer the last fence that parses so a
  // ```json block inside the scenario text can't shadow it.
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
  lines.push(`**Mode:** ${m.mode === 'final' ? 'Final' : 'Practice'}`);
  lines.push(`**Instability:** ${m.instability ? 'On' : 'Off'}`);
  lines.push('');
  lines.push('## Scenario');
  lines.push('');
  if (m.scenarioTitle) {
    lines.push(`### ${m.scenarioTitle}`);
    lines.push('');
  }
  lines.push(m.scenarioGoal || '_Scenario goal to be defined._');
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
