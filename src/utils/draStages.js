export const DRA_FIXED_STAGES = [
  {
    stage: 'Understand',
    interpretation: 'Identify a clear understanding of the core task, including desired outcomes, constraints, and stakeholders.',
  },
  {
    stage: 'Investigate',
    interpretation: 'Gather the relevant information, perspectives, and evidence necessary to create a plan.',
  },
  {
    stage: 'Plan',
    interpretation: 'Organize what you learned into a general action plan.',
  },
  {
    stage: 'Propose',
    interpretation: 'Describe the specific actions, decisions, or interventions that should be carried out.',
  },
  {
    stage: 'Evaluate',
    interpretation: 'Explain how you would measure success, test assumptions, and check for gaps or risks.',
  },
  {
    stage: 'Reflect',
    interpretation: 'Consider what you learned, how your thinking changed, and what you would improve in future iterations.',
  },
];

const DRA_LEGACY_STAGE_MAP = {
  frame: 'Understand',
  framing: 'Understand',
  research: 'Investigate',
  model: 'Plan',
  modeling: 'Plan',
  act: 'Propose',
  action: 'Propose',
  validate: 'Evaluate',
  validation: 'Evaluate',
  reflect: 'Reflect',
  reflection: 'Reflect',
  understand: 'Understand',
  investigate: 'Investigate',
  plan: 'Plan',
  propose: 'Propose',
  evaluate: 'Evaluate',
};

const DRA_PROCESS_ATTRIBUTE_MAP = {
  framing: 'Understand',
  research: 'Investigate',
  modeling: 'Plan',
  action: 'Propose',
  validation: 'Evaluate',
  reflection: 'Reflect',
  understand: 'Understand',
  investigate: 'Investigate',
  plan: 'Plan',
  propose: 'Propose',
  evaluate: 'Evaluate',
};

export function getDraStageNames() {
  return DRA_FIXED_STAGES.map((item) => item.stage);
}

export function getFirstDraStage() {
  return DRA_FIXED_STAGES[0]?.stage || '';
}

export function normalizeDraStageName(value) {
  const normalized = DRA_LEGACY_STAGE_MAP[String(value || '').trim().toLowerCase()];
  return normalized || '';
}

export function getDraStageDefinition(stage) {
  const normalized = normalizeDraStageName(stage);
  return DRA_FIXED_STAGES.find((item) => item.stage === normalized) || null;
}

export function createDraStageNotes(source = {}) {
  const next = {};
  const raw = source && typeof source === 'object' ? source : {};

  DRA_FIXED_STAGES.forEach(({ stage }) => {
    const matchingKey = Object.keys(raw).find((key) => normalizeDraStageName(key) === stage);
    const value = matchingKey ? raw[matchingKey] : '';
    next[stage] = typeof value === 'string' && value.trim() ? value : `# ${stage}\n\n`;
  });

  return next;
}

export function normalizeDraProcessAttributeName(value) {
  const normalized = DRA_PROCESS_ATTRIBUTE_MAP[String(value || '').trim().toLowerCase()];
  return normalized || String(value || '');
}
