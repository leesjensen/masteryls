import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

const INTERVIEW_REPO_PATH = 'instruction/mock-interview/mock-interview.md';

function interviewMarkdown(overrides: Record<string, unknown> = {}) {
  const model = {
    title: 'Mock Interview',
    discipline: 'Software Engineering',
    jobTitle: 'Backend Engineer',
    jobDescription: 'Build and operate backend services.',
    difficulty: 3,
    practiceMode: true,
    finalMode: false,
    learningOutcomes: 'Demonstrate readiness for a backend engineering role.',
    ...overrides,
  };

  return `# ${model.title}\n\n## Assessment Definition\n\n\`\`\`json\n${JSON.stringify(model, null, 2)}\n\`\`\`\n`;
}

function interviewCourseOverride() {
  return {
    externalRefs: { canvasCourseId: '12345' },
    modules: [
      {
        title: 'Module 1',
        topics: [
          { id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', title: 'Home', path: 'README.md' },
          { id: '4c5d6e7f-8a9b-0c1d-2e3f-4a5b6c7d8e9f', title: 'Mock Interview', path: INTERVIEW_REPO_PATH, type: 'interview', points: 100, externalRefs: { canvasAssignmentId: 777 } },
        ],
      },
    ],
  };
}

// A course with no Canvas link at all, for tests that only care about the interview UI/flow
// and would otherwise need to mock the Canvas eligibility check for no reason.
function plainCourseOverride() {
  return {
    modules: [
      {
        title: 'Module 1',
        topics: [
          { id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', title: 'Home', path: 'README.md' },
          { id: '4c5d6e7f-8a9b-0c1d-2e3f-4a5b6c7d8e9f', title: 'Mock Interview', path: INTERVIEW_REPO_PATH, type: 'interview' },
        ],
      },
    ],
  };
}

function installInterviewRoutes(page: any, initialMarkdown: string) {
  const context = page.context();
  let currentMarkdown = initialMarkdown;

  context.route(/https:\/\/raw\.githubusercontent\.com\/.*\/instruction\/mock-interview\/.*\.md$/, async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: currentMarkdown });
  });

  context.route(/https:\/\/api\.github\.com\/repos\/ghAccount\/ghRepo\/contents\/instruction\/mock-interview\/.*\.md$/, async (route: any) => {
    const method = route.request().method();
    const url = route.request().url();
    const repoPath = url.match(/\/contents\/(instruction\/mock-interview\/[^?]+)/)?.[1] || INTERVIEW_REPO_PATH;

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        json: { path: repoPath, sha: 'fake-interview-sha', download_url: `https://raw.githubusercontent.com/ghAccount/ghRepo/main/${repoPath}`, type: 'file' },
      });
      return;
    }

    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      currentMarkdown = Buffer.from(body.content, 'base64').toString('utf8');
      await route.fulfill({ status: 201, json: { commit: { sha: 'interview-commit-sha' } } });
      return;
    }

    await route.continue();
  });
}

const SCENARIO = {
  scenario: { title: 'Backend Engineer Interview', company: 'Riverton Systems', summary: 'A multi-stage interview loop.', description: 'Riverton Systems is hiring a backend engineer.', roleContext: 'The team owns core services.' },
  interviewers: [{ key: 'recruiter', name: 'Amina Farouk', role: 'Recruiter', seniority: 'mid', personality: 'friendly', objectives: 'assess communication' }],
  sessions: [{ title: 'Recruiter Screen', objective: 'Assess communication', interviewerKeys: ['recruiter'], targetQuestionCount: 3 }],
};

const EVALUATION = {
  sessions: [{ sessionId: 'Recruiter Screen', rating: 'Developing', summary: 'Communicated clearly.', evidence: [{ detail: 'Explained a past project well', polarity: 'positive', impact: 'strong' }] }],
  competency: { rating: 'Emerging', summary: 'Shows foundational knowledge.', attributes: [{ name: 'Domain Knowledge', rating: 'Emerging', summary: 'Some gaps.', evidence: [] }] },
  disposition: { rating: 'Developing', summary: 'Engaged and curious.', attributes: [{ name: 'Curiosity', rating: 'Developing', summary: 'Asked good questions.', evidence: [] }] },
  concerns: [],
};

function installInterviewGemini(page: any, scenario: any = SCENARIO, evaluation: any = EVALUATION) {
  page.context().route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    const body = route.request().postDataJSON()?.body;
    const promptText = body?.contents?.[0]?.parts?.[0]?.text || '';
    let text: string;
    if (/evaluating a candidate's performance/i.test(promptText)) {
      text = JSON.stringify(evaluation);
    } else if (/supportive coach/i.test(promptText)) {
      text = JSON.stringify({ feedback: 'Keep practicing.', hints: [], suggestions: [] });
    } else if (/role-playing as the interviewer/i.test(promptText)) {
      text = JSON.stringify({ replies: [{ speakerKey: 'recruiter', speakerName: 'Amina Farouk', speakerRole: 'Recruiter', text: 'Tell me about yourself.' }], sessionComplete: false, interviewTerminated: false, sessionSummary: '' });
    } else {
      text = JSON.stringify(scenario);
    }
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text }], role: 'model' }, finishReason: 'STOP' }] } });
  });
}

function installGradebookRoute(page: any, calls: any[]) {
  page.context().route(/.*supabase.co\/functions\/v1\/canvasgradebook(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    const body = await route.request().postDataJSON();
    if (body?.mode === 'check') {
      await route.fulfill({ status: 200, json: { ok: true, eligible: true } });
      return;
    }
    calls.push(body);
    await route.fulfill({ status: 200, json: { ok: true, postedGrade: null } });
  });
}

test('interview final assessment completion posts a non-autograded suggestion to canvasgradebook', async ({ page }) => {
  const gradebookCalls: any[] = [];

  await initBasicCourse({ page, courseJsonOverride: interviewCourseOverride() });
  installGradebookRoute(page, gradebookCalls);
  installInterviewRoutes(page, interviewMarkdown({ practiceMode: false, finalMode: true }));
  installInterviewGemini(page);

  await navigateToCourse(page);
  await page.getByText('Mock Interview').click();

  await page.getByRole('button', { name: 'Start final interview' }).click();
  await expect(page.getByRole('button', { name: 'Complete assessment' })).toBeVisible();

  await page.getByRole('button', { name: 'Complete assessment' }).click();
  await expect(page.getByText('Evaluation Snapshot')).toBeVisible();

  await expect.poll(() => gradebookCalls.length).toBe(1);
  const payload = gradebookCalls[0];
  expect(payload.topicType).toBe('interview');
  expect(payload.autoGrade).toBe(false);
  expect(payload.canvasAssignmentId).toBe(777);
  expect(payload.pointsPossible).toBe(100);
  expect(typeof payload.percentCorrect).toBe('number');
  expect(payload.feedback).toContain('Overall');
});

test('interview practice completion does not sync to canvasgradebook', async ({ page }) => {
  const gradebookCalls: any[] = [];

  await initBasicCourse({ page, courseJsonOverride: interviewCourseOverride() });
  installGradebookRoute(page, gradebookCalls);
  installInterviewRoutes(page, interviewMarkdown({ practiceMode: true, finalMode: false }));
  installInterviewGemini(page);

  await navigateToCourse(page);
  await page.getByText('Mock Interview').click();

  await page.getByRole('button', { name: 'Start practice interview' }).click();
  await expect(page.getByRole('button', { name: 'Complete assessment' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete assessment' }).click();
  await expect(page.getByText('Evaluation Snapshot')).toBeVisible();

  // Give any (incorrect) async sync a moment to fire before asserting it never did.
  await page.waitForTimeout(300);
  expect(gradebookCalls.length).toBe(0);
});

test('interview: chat footer and completion screen do not offer a new practice run after finishing', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: plainCourseOverride() });
  installInterviewRoutes(page, interviewMarkdown({ practiceMode: true, finalMode: false }));
  installInterviewGemini(page);

  await navigateToCourse(page);
  await page.getByText('Mock Interview').click();

  await page.getByRole('button', { name: 'Start practice interview' }).click();
  await expect(page.getByRole('button', { name: 'Complete assessment' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete assessment' }).click();
  await expect(page.getByText('Evaluation Snapshot')).toBeVisible();

  await page.getByRole('button', { name: 'Interview', exact: true }).click();
  const resultsButton = page.getByRole('button', { name: 'View results' });
  await expect(resultsButton).toBeVisible();
  // Scoped to the chat footer itself (not page-wide) since the persistent top action bar
  // legitimately still offers "New practice run" here - practice mode remains available and
  // the final hasn't been taken. Only the chat footer's own copy should be gone.
  await expect(resultsButton.locator('..').getByRole('button', { name: 'New practice run' })).toHaveCount(0);

  await resultsButton.click();
  const completeHeading = page.getByText('Interview complete', { exact: true });
  await expect(completeHeading).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Evaluation' })).toBeVisible();
  await expect(completeHeading.locator('../..').getByRole('button', { name: 'New practice run' })).toHaveCount(0);
});

test('interview: completing the final removes new-practice-run and retake-final options everywhere', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: plainCourseOverride() });
  installInterviewRoutes(page, interviewMarkdown({ practiceMode: true, finalMode: true }));
  installInterviewGemini(page);

  await navigateToCourse(page);
  await page.getByText('Mock Interview').click();

  // Complete a practice run first so there is history to review later.
  await page.getByRole('button', { name: 'Start practice interview' }).click();
  await expect(page.getByRole('button', { name: 'Complete assessment' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete assessment' }).click();
  await expect(page.getByText('Evaluation Snapshot')).toBeVisible();

  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Start final interview' }).click();
  await expect(page.getByRole('button', { name: 'Complete assessment' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete assessment' }).click();
  await expect(page.getByText('Evaluation Snapshot')).toBeVisible();

  // Once the final is complete, neither option should be offered in the action bar.
  await expect(page.getByRole('button', { name: 'New practice run' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start final interview' })).toHaveCount(0);

  // Reviewing the earlier practice run must not resurrect the start options.
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: /Backend Engineer Interview/ }).click();
  await expect(page.getByText('Evaluation Snapshot')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'New practice run' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start final interview' })).toHaveCount(0);
});
