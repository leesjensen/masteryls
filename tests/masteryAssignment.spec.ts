import { test, expect } from './fixtures';
import { initBasicCourse, navigateToDashboard, navigateToCourse } from './testInit';

const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';

// Minimal Canvas proxy mock that records assignment-create payloads.
async function mockCanvasProxy(page: any) {
  await page.route('https://api.github.com/user', async (route: any) => {
    await route.fulfill({ status: 200, json: { login: 'mock-user' } });
  });
  const assignmentPayloads: any[] = [];
  let nextAssignmentId = 9000;
  await page.route(/.*supabase.co\/functions\/v1\/canvas(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    const body = await route.request().postDataJSON();
    if (body?.method === 'POST' && /^\/courses\/\d+\/assignments$/.test(body?.endpoint || '')) {
      nextAssignmentId += 1;
      assignmentPayloads.push(body.body.assignment);
      await route.fulfill({ status: 200, json: { id: nextAssignmentId, name: body.body.assignment.name } });
      return;
    }
    throw new Error(`Unhandled canvas invoke payload: ${JSON.stringify(body)}`);
  });
  return { assignmentPayloads };
}

async function openCourseLinking(page: any) {
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'Link course', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Link a Course' })).toBeVisible();
}

test('creating the mastery assignment posts an 80-point "Reading interactions" assignment and shows created state', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: { externalRefs: { canvasCourseId: '12345' } } });
  const { assignmentPayloads } = await mockCanvasProxy(page);

  await navigateToDashboard(page);
  await openCourseLinking(page);
  await page.getByLabel('Course', { exact: true }).selectOption(COURSE_ID);
  await page.waitForTimeout(300);

  const createButton = page.getByRole('button', { name: 'Create mastery assignment' });
  await expect(createButton).toBeEnabled();
  await createButton.click();

  await expect(page.locator('#root')).toContainText('Mastery assignment "Reading interactions" created');
  // The section switches to the read-only linked state with a link to the assignment.
  await expect(page.getByRole('link', { name: 'Reading interactions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create mastery assignment' })).toHaveCount(0);

  await expect.poll(() => assignmentPayloads.length).toBe(1);
  const assignment = assignmentPayloads[0];
  expect(assignment.name).toBe('Reading interactions');
  expect(assignment.points_possible).toBe(80);
  expect(assignment.grading_type).toBe('points');
  expect(assignment.submission_types).toEqual(['none']);
});

test('the create mastery assignment button is hidden once the course already has one', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: { externalRefs: { canvasCourseId: '12345', canvasMasteryAssignmentId: 9001 } } });
  await mockCanvasProxy(page);

  await navigateToDashboard(page);
  await openCourseLinking(page);
  await page.getByLabel('Course', { exact: true }).selectOption(COURSE_ID);
  await page.waitForTimeout(300);

  await expect(page.getByRole('link', { name: 'Reading interactions' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reading interactions' })).toHaveAttribute('href', 'https://byu.instructure.com/courses/12345/assignments/9001');
  await expect(page.getByRole('button', { name: 'Create mastery assignment' })).toHaveCount(0);
});

test('mastery posts to Canvas coalesced (one grade-only post per flush) after interactions', async ({ page }) => {
  const surveyMarkdown = `
# Surveys
\`\`\`masteryls
{"id":"aaaa1111-0000-0000-0000-000000000001", "title":"Survey A", "type":"survey"}
Question A?

- [ ] Alpha
- [ ] Bravo
\`\`\`

\`\`\`masteryls
{"id":"bbbb2222-0000-0000-0000-000000000002", "title":"Survey B", "type":"survey"}
Question B?

- [ ] Charlie
- [ ] Delta
\`\`\`
`;

  await initBasicCourse({
    page,
    topicMarkdown: surveyMarkdown,
    courseJsonOverride: { externalRefs: { canvasCourseId: '12345', canvasMasteryAssignmentId: 9001 } },
  });

  // The linked-course toolbar exposes a Canvas web link; stub the Canvas site at the context
  // level (covers popups from window.open) so the fixture's block-all guard doesn't fail the test.
  await page.context().route(/https:\/\/[^/]*instructure\.com\/.*/, async (route: any) => {
    await route.fulfill({ status: 200, body: '' });
  });

  const masteryPosts: any[] = [];
  await page.route(/.*supabase.co\/functions\/v1\/canvasgradebook(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    const body = await route.request().postDataJSON();
    if (body?.mode === 'check') {
      await route.fulfill({ status: 200, json: { ok: true, eligible: true } });
      return;
    }
    masteryPosts.push(body);
    await route.fulfill({ status: 200, json: { ok: true, postedGrade: body.percentCorrect } });
  });

  await navigateToCourse(page);
  await page.getByText('topic 1').click();

  // Submit both surveys — each recomputes mastery and schedules a (debounced) Canvas post.
  // `exact: true` avoids matching the Canvas toolbar button ("...your grades submit here").
  await page.getByRole('radio', { name: 'Alpha' }).check();
  await page.getByRole('button', { name: 'Submit', exact: true }).nth(0).click();
  await page.getByRole('radio', { name: 'Charlie' }).check();
  await page.getByRole('button', { name: 'Submit', exact: true }).nth(1).click();

  // No post yet — the debounce hasn't elapsed and we haven't left the topic.
  await page.waitForTimeout(300);
  expect(masteryPosts.length).toBe(0);

  // Leaving the topic flushes the pending post — a single, coalesced, grade-only mastery post.
  await page.getByRole('button', { name: 'Next topic' }).click();

  await expect.poll(() => masteryPosts.length).toBe(1);
  const post = masteryPosts[0];
  expect(post.topicType).toBe('mastery');
  expect(post.canvasAssignmentId).toBe(9001);
  expect(post.autoGrade).toBe(true);
  expect(post.pointsPossible).toBe(100);
  expect(Number.isFinite(post.percentCorrect)).toBe(true);
  expect(post.percentCorrect).toBeGreaterThan(0);
});
