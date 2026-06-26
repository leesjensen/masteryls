import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

const DRA_REPO_PATH = 'instruction/reasoning-lab/reasoning-lab.md';

function draMarkdown(overrides: Record<string, unknown> = {}) {
  const model = {
    title: 'Reasoning Lab',
    discipline: 'Software Engineering',
    problemType: 'System modernization',
    difficulty: 4,
    practiceMode: true,
    finalMode: false,
    instability: true,
    learningOutcomes: 'Demonstrate systems thinking and evidence-based decisions.',
    ...overrides,
  };

  const modes = [model.practiceMode && 'Practice', model.finalMode && 'Final'].filter(Boolean).join(', ') || 'Practice';
  return `# ${model.title}\n\n**Discipline:** ${model.discipline}\n**Problem type:** ${model.problemType}\n**Difficulty:** ${model.difficulty} / 5\n**Modes:** ${modes}\n**Instability:** ${model.instability ? 'On' : 'Off'}\n\n## Learning Outcomes\n\n${model.learningOutcomes}\n\n## Assessment Definition\n\n\`\`\`json\n${JSON.stringify(model, null, 2)}\n\`\`\`\n`;
}

function draCourseOverride() {
  return {
    modules: [
      {
        title: 'Module 1',
        topics: [
          { id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', title: 'Home', path: 'README.md' },
          { id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f', title: 'Reasoning Lab', path: DRA_REPO_PATH, type: 'dra' },
        ],
      },
    ],
  };
}

function installDraRoutes(page: any, initialMarkdown: string) {
  const context = page.context();
  let currentMarkdown = initialMarkdown;
  const draPuts: Array<{ path: string; markdown: string }> = [];

  context.route(/https:\/\/raw\.githubusercontent\.com\/.*\/instruction\/reasoning-lab\/.*\.md$/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: currentMarkdown,
    });
  });

  context.route(/https:\/\/api\.github\.com\/repos\/ghAccount\/ghRepo\/contents\/instruction\/reasoning-lab\/.*\.md$/, async (route: any) => {
    const method = route.request().method();
    const url = route.request().url();
    const repoPath = url.match(/\/contents\/(instruction\/reasoning-lab\/[^?]+)/)?.[1] || DRA_REPO_PATH;

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        json: {
          path: repoPath,
          sha: 'fake-dra-sha',
          download_url: `https://raw.githubusercontent.com/ghAccount/ghRepo/main/${repoPath}`,
          type: 'file',
        },
      });
      return;
    }

    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      const markdown = Buffer.from(body.content, 'base64').toString('utf8');
      currentMarkdown = markdown;
      draPuts.push({ path: repoPath, markdown });
      await route.fulfill({ status: 201, json: { commit: { sha: 'dra-commit-sha' } } });
      return;
    }

    await route.continue();
  });

  return { draPuts };
}

const SCENARIO = {
  scenario: {
    title: 'Tax System Modernization',
    summary: 'A government agency must modernize a critical legacy system.',
    description: 'The State Department of Revenue must replace its aging COBOL tax system handling 14 million records.',
  },
  stakeholders: [{ name: 'Dana Cole', role: 'CIO', personality: 'cautious', objectives: 'minimize downtime' }],
  resources: [{ name: 'Legacy COBOL system', type: 'system', description: '14 million records' }],
  constraints: [{ name: 'Budget', description: 'capped at $2.5M' }],
  stages: [
    { stage: 'Frame', interpretation: 'Clarify the stakeholders and constraints.' },
    { stage: 'Research', interpretation: 'Gather the system requirements.' },
    { stage: 'Model', interpretation: 'Design a target architecture.' },
    { stage: 'Act', interpretation: 'Plan the migration.' },
    { stage: 'Validate', interpretation: 'Test the cutover.' },
    { stage: 'Reflect', interpretation: 'Evaluate the tradeoffs.' },
  ],
};

const STAKEHOLDER_REPLY = 'Downtime is our biggest concern.';

const EVALUATION = {
  process: { confidence: 'Developing', summary: 'Solid framing of the problem.', attributes: [{ name: 'Framing', confidence: 'Proficient', summary: 'Clarified the core constraints.', evidence: ['Asked the CIO about downtime'] }] },
  competency: { confidence: 'Emerging', summary: 'Beginning to reason about the system.', attributes: [{ name: 'Systems thinking', confidence: 'Emerging', summary: 'Considered downstream agencies.', evidence: [] }] },
  disposition: { confidence: 'Developing', summary: 'Curious and engaged.', attributes: [{ name: 'Curiosity', confidence: 'Developing', summary: 'Probed for root concerns.', evidence: [] }] },
};

const COACHING = {
  feedback: 'Good start clarifying constraints.',
  hints: ['Quantify the downtime tolerance.'],
  suggestions: ['Interview the operations lead about cutover windows.'],
};

function installScenarioGemini(page: any, scenario: any = SCENARIO, chatReply: string = STAKEHOLDER_REPLY, evaluation: any = EVALUATION, coaching: any = COACHING) {
  page.context().route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    const body = route.request().postDataJSON()?.body;
    // The chat agent uses a system_instruction; scenario generation, evaluation, and
    // coaching do not, so distinguish those by their prompt text.
    const promptText = body?.contents?.[0]?.parts?.[0]?.text || '';
    let text: string;
    if (body?.system_instruction) {
      text = chatReply;
    } else if (/observation and assessment agent/i.test(promptText)) {
      text = JSON.stringify(evaluation);
    } else if (/encouraging coach/i.test(promptText)) {
      text = JSON.stringify(coaching);
    } else {
      text = JSON.stringify(scenario);
    }
    await route.fulfill({
      json: { candidates: [{ content: { parts: [{ text }], role: 'model' }, finishReason: 'STOP' }] },
    });
  });
}

test('dra learner view renders the title and learning outcomes without authoring details', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown());

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();

  await expect(page.getByRole('heading', { name: 'Reasoning Lab', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Learning Outcomes', exact: true })).toBeVisible();
  await expect(page.getByText('Demonstrate systems thinking and evidence-based decisions.')).toBeVisible();
  // Authoring parameters (discipline, problem type, difficulty, ...) are not shown to the learner.
  await expect(page.getByText('Software Engineering')).toHaveCount(0);
});

test('dra easiest difficulty reveals full description, stakeholders, and resources', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown({ practiceMode: true, finalMode: false, difficulty: 1 }));
  installScenarioGemini(page);

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();

  await page.getByRole('button', { name: 'Generate scenario' }).click();

  await expect(page.getByRole('heading', { name: 'Tax System Modernization', exact: true })).toBeVisible();
  await expect(page.getByText('aging COBOL tax system handling 14 million records', { exact: false })).toBeVisible();
  await expect(page.getByText('capped at $2.5M', { exact: false })).toBeVisible();
  // Stakeholders and resources are listed in the scenario (objectives text is unique to that list).
  await expect(page.getByRole('heading', { name: 'Stakeholders' })).toBeVisible();
  await expect(page.getByText('minimize downtime', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible();

  // Practice mode is not locked: cancel returns to the start so a new scenario can be generated.
  await expect(page.getByRole('button', { name: 'Generate new scenario' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Generate scenario' })).toBeVisible();
});

test('dra hardest difficulty reveals only the high-level summary', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown({ practiceMode: true, finalMode: false, difficulty: 5 }));
  installScenarioGemini(page);

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();

  await page.getByRole('button', { name: 'Generate scenario' }).click();

  await expect(page.getByRole('heading', { name: 'Tax System Modernization', exact: true })).toBeVisible();
  await expect(page.getByText('A government agency must modernize a critical legacy system.')).toBeVisible();
  // Full description, constraints, stakeholders, and resources are withheld at the hardest level.
  await expect(page.getByText('14 million records', { exact: false })).toHaveCount(0);
  await expect(page.getByText('capped at $2.5M', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Dana Cole')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Constraints' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Stakeholders' })).toHaveCount(0);
  await expect(page.getByText('emerge as you investigate', { exact: false })).toBeVisible();
});

test('dra practice mode can start a new scenario after completing', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown({ practiceMode: true, finalMode: false }));
  installScenarioGemini(page);

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();

  await page.getByRole('button', { name: 'Generate scenario' }).click();
  await expect(page.getByRole('heading', { name: 'Tax System Modernization', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Complete assessment' }).click();
  await expect(page.getByText('Assessment complete')).toBeVisible();

  await page.getByRole('button', { name: 'Start new scenario' }).click();
  await expect(page.getByRole('button', { name: 'Complete assessment' })).toBeVisible();
  await expect(page.getByText('Assessment complete')).toHaveCount(0);
});

test('dra final mode confirms start and locks the scenario', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown({ practiceMode: false, finalMode: true }));
  installScenarioGemini(page);

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Start final assessment' }).click();

  await expect(page.getByRole('heading', { name: 'Tax System Modernization', exact: true })).toBeVisible();
  await expect(page.getByText('the scenario is locked', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate new scenario' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Complete assessment' })).toBeVisible();
});

test('dra with both modes lets the learner practice then enter the final assessment', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown({ practiceMode: true, finalMode: true, difficulty: 1 }));
  installScenarioGemini(page);

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();

  // Both entry points are available at the start.
  await expect(page.getByRole('button', { name: 'Generate scenario' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start final assessment' })).toBeVisible();

  await page.getByRole('button', { name: 'Generate scenario' }).click();
  await expect(page.getByRole('heading', { name: 'Tax System Modernization', exact: true })).toBeVisible();

  // While practicing, the learner can cancel or choose to enter the final assessment.
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Start final assessment' }).click();

  await expect(page.getByText('the scenario is locked', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
});

test('dra investigation lets the learner interview a stakeholder and record reasoning', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown({ practiceMode: true, finalMode: false, difficulty: 1 }));
  installScenarioGemini(page);

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();
  await page.getByRole('button', { name: 'Generate scenario' }).click();

  await expect(page.getByRole('heading', { name: 'Investigation', exact: true })).toBeVisible();

  // Stages structure the investigation; the first stage's interpretation shows by default.
  await expect(page.getByRole('heading', { name: 'Stages', exact: true })).toBeVisible();
  await expect(page.getByText('Clarify the stakeholders and constraints.')).toBeVisible();
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await expect(page.getByText('Gather the system requirements.')).toBeVisible();

  // The first revealed target (a stakeholder) is auto-selected; ask it a question.
  const chatInput = page.getByPlaceholder('Ask Dana Cole...');
  await expect(chatInput).toBeVisible();
  await chatInput.fill('What worries you most?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.getByText('What worries you most?')).toBeVisible();
  await expect(page.getByText('Downtime is our biggest concern.')).toBeVisible();

  // The reasoning record captures and retains the learner's input.
  const understanding = page.getByLabel('Current understanding');
  await understanding.fill('The agency fears downtime during migration.');
  await understanding.blur();
  await expect(understanding).toHaveValue('The agency fears downtime during migration.');
});

test('dra practice mode evaluates progress across the three dimensions with drill-down', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown({ practiceMode: true, finalMode: false, difficulty: 1 }));
  installScenarioGemini(page);

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();
  await page.getByRole('button', { name: 'Generate scenario' }).click();

  await page.getByRole('button', { name: 'Evaluate my progress' }).click();

  await expect(page.getByRole('heading', { name: 'Evaluation', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Process', exact: true })).toBeVisible();
  await expect(page.getByText('Solid framing of the problem.')).toBeVisible();

  // Drill into a Process attribute to reveal its supporting evidence.
  await page.getByRole('button', { name: /Framing/ }).click();
  await expect(page.getByText('Asked the CIO about downtime')).toBeVisible();

  // After evaluating once, the control becomes an update action.
  await expect(page.getByRole('button', { name: 'Update evaluation' })).toBeVisible();
});

test('dra practice mode provides coaching with hints and suggestions', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown({ practiceMode: true, finalMode: false, difficulty: 1 }));
  installScenarioGemini(page);

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();
  await page.getByRole('button', { name: 'Generate scenario' }).click();

  await page.getByRole('button', { name: 'Get coaching' }).click();

  await expect(page.getByRole('heading', { name: 'Coaching', exact: true })).toBeVisible();
  await expect(page.getByText('Good start clarifying constraints.')).toBeVisible();
  await expect(page.getByText('Quantify the downtime tolerance.')).toBeVisible();
  await expect(page.getByText('Interview the operations lead about cutover windows.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get new coaching' })).toBeVisible();
});

test('dra final mode does not offer coaching during the run', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  installDraRoutes(page, draMarkdown({ practiceMode: false, finalMode: true, difficulty: 1 }));
  installScenarioGemini(page);

  await navigateToCourse(page);
  await page.getByText('Reasoning Lab').click();
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Start final assessment' }).click();

  await expect(page.getByRole('heading', { name: 'Investigation', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get coaching' })).toHaveCount(0);
});

test('dra graphical editor edits a field and commits updated markdown', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: draCourseOverride() });
  const { draPuts } = installDraRoutes(page, draMarkdown());

  await navigateToCourse(page);
  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Reasoning Lab').click();

  await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible();

  const disciplineInput = page.getByPlaceholder('e.g. Software Engineering');
  await expect(disciplineInput).toHaveValue('Software Engineering');
  await disciplineInput.fill('Civil Engineering');

  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Discard' })).toBeDisabled();

  await expect.poll(() => draPuts.length).toBeGreaterThan(0);
  const latest = draPuts[draPuts.length - 1];
  expect(latest.path).toContain('instruction/reasoning-lab/');
  expect(latest.markdown).toContain('"discipline": "Civil Engineering"');
});
