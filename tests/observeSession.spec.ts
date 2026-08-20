import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

// Bud (the default logged-in test user, see testInit.ts) has root/editor rights, so he can
// observe another learner. Sally is a second fixture user used as the observed learner.
const BUD_ID = '15cb92ef-d2d0-4080-8770-999516448960';
const SALLY_ID = 'afcfefde-6cab-4d49-bdf8-375972c6de3e';
const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';
const TOPIC_ID = '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f';

const BUD_ENROLLMENT_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const SALLY_ENROLLMENT_ID = 'bbbbbbbb-2222-2222-2222-222222222222';

const idA = 'a1b2c3d4-e5f6-7890-1234-567890129001';
const idB = 'a1b2c3d4-e5f6-7890-1234-567890129002';

const interactionMarkdown = `
# Topic

\`\`\`masteryls
{"id":"${idA}", "title":"Question A", "type":"multiple-choice" }
Question A

- [ ] Wrong A
- [x] Right A
\`\`\`

\`\`\`masteryls
{"id":"${idB}", "title":"Question B", "type":"multiple-choice" }
Question B

- [ ] Wrong B
- [x] Right B
\`\`\`
`;

// Simulates the reported bug: an observe session already active in localStorage (as if the
// learner started observing, then refreshed the page) and two learners whose /enrollment
// fetches resolve out of order - Bud's own (self) fetch resolves LAST, after Sally's
// (observed) fetch, matching the timing captured in the real repro's console log.
async function mockObserveRace(page: any, { selfDelayMs = 150 }: { selfDelayMs?: number } = {}) {
  await page.context().route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route: any) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 201, json: { id: BUD_ENROLLMENT_ID, catalogId: COURSE_ID, learnerId: BUD_ID, settings: {}, progress: {} } });
      return;
    }
    const url = new URL(route.request().url());
    const learnerIdFilter = url.searchParams.get('learnerId') || '';
    const isSelf = learnerIdFilter.includes(BUD_ID);
    if (isSelf) {
      await new Promise((resolve) => setTimeout(resolve, selfDelayMs));
      await route.fulfill({ json: [{ id: BUD_ENROLLMENT_ID, catalogId: COURSE_ID, learnerId: BUD_ID, settings: {}, progress: {} }] });
    } else {
      await route.fulfill({ json: [{ id: SALLY_ENROLLMENT_ID, catalogId: COURSE_ID, learnerId: SALLY_ID, settings: {}, progress: {} }] });
    }
  });

  await page.context().route(/.*supabase.co\/rest\/v1\/progress(\?.+)?/, async (route: any) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 200, json: { id: 'x' } });
      return;
    }
    const url = new URL(route.request().url());
    const enrollmentFilter = url.searchParams.get('enrollmentId') || '';
    const rows: any[] = [];
    if (enrollmentFilter.includes(SALLY_ENROLLMENT_ID)) {
      // Sally (observed) answered both questions.
      rows.push(
        { id: 'p1', createdAt: '2026-01-01T00:00:00', userId: SALLY_ID, enrollmentId: SALLY_ENROLLMENT_ID, interactionId: idA, duration: 0, type: 'quizSubmit', details: { type: 'multiple-choice', selected: [1], correct: [1], percentCorrect: 100 }, catalogId: COURSE_ID, topicId: TOPIC_ID },
        { id: 'p2', createdAt: '2026-01-01T00:01:00', userId: SALLY_ID, enrollmentId: SALLY_ENROLLMENT_ID, interactionId: idB, duration: 0, type: 'quizSubmit', details: { type: 'multiple-choice', selected: [1], correct: [1], percentCorrect: 100 }, catalogId: COURSE_ID, topicId: TOPIC_ID },
      );
    } else if (enrollmentFilter.includes(BUD_ENROLLMENT_ID)) {
      // Bud (self) only answered the first question.
      rows.push({ id: 'p3', createdAt: '2026-01-01T00:02:00', userId: BUD_ID, enrollmentId: BUD_ENROLLMENT_ID, interactionId: idA, duration: 0, type: 'quizSubmit', details: { type: 'multiple-choice', selected: [1], correct: [1], percentCorrect: 100 }, catalogId: COURSE_ID, topicId: TOPIC_ID });
    }
    await route.fulfill({ status: 200, json: rows, headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } });
  });
}

test('observing a learner survives a page reload without racing back to the observer’s own progress', async ({ page }) => {
  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await mockObserveRace(page);

  // Seed an already-active observe session in localStorage before the app boots, simulating
  // "started observing, then refreshed" without needing to drive the full MasteryView flow.
  await page.addInitScript(
    ({ courseId, learnerId, startedByUserId }) => {
      window.localStorage.setItem(
        'masteryls.observeSession.v1',
        JSON.stringify({ active: true, courseId, learnerId, learnerName: 'Sally', learnerEmail: 'sally@bud.com', startedByUserId }),
      );
    },
    { courseId: COURSE_ID, learnerId: SALLY_ID, startedByUserId: BUD_ID },
  );

  await navigateToCourse(page);
  await page.getByText('topic 1').click();

  // The race only opens up on a genuine full page (re)load: `user` and `observeSession` are
  // both freshly async-resolved together as the whole app remounts, which is what the
  // reported bug describes ("I then refresh the screen ..."). Navigating client-side within
  // an already-authenticated app (as done above) never hits the race, since by the time
  // ClassroomPage first mounts, the observe session has long since finished restoring.
  await page.reload();

  // Wait past the deliberately delayed self-enrollment fetch so both requests have fully
  // settled before asserting - a naive `toBeVisible()` immediately after navigation can
  // pass on a merely transient correct state (the observed learner's fetch resolving first)
  // without catching it flipping back once the slower self fetch resolves afterward.
  await page.waitForTimeout(300);

  await expect(page.getByText(/Observe mode is active for/)).toBeVisible();
  await expect(page.getByText('Sally', { exact: false })).toBeVisible();

  const widgetA = page.locator(`[data-plugin-masteryls-id="${idA}"]`);
  const widgetB = page.locator(`[data-plugin-masteryls-id="${idB}"]`);

  // Both of Sally's answers must be visible (she answered both), and interactions must be
  // read-only (observe mode), not the self/Bud state (which only answered question A and
  // would otherwise be editable).
  await expect(widgetA.getByRole('radio', { name: 'Right A' })).toBeChecked();
  await expect(widgetA.getByRole('radio', { name: 'Right A' })).toBeDisabled();
  await expect(widgetB.getByRole('radio', { name: 'Right B' })).toBeChecked();
  await expect(widgetB.getByRole('radio', { name: 'Right B' })).toBeDisabled();

  await expect(page.getByText(/Observe mode is active for/)).toBeVisible();
});

test('exiting observe mode clears an interaction the observer never answered themselves', async ({ page }) => {
  await initBasicCourse({ page, topicMarkdown: interactionMarkdown });
  await mockObserveRace(page, { selfDelayMs: 0 });

  await page.addInitScript(
    ({ courseId, learnerId, startedByUserId }) => {
      window.localStorage.setItem(
        'masteryls.observeSession.v1',
        JSON.stringify({ active: true, courseId, learnerId, learnerName: 'Sally', learnerEmail: 'sally@bud.com', startedByUserId }),
      );
    },
    { courseId: COURSE_ID, learnerId: SALLY_ID, startedByUserId: BUD_ID },
  );

  await navigateToCourse(page);
  await page.getByText('topic 1').click();
  await page.reload();

  const widgetA = page.locator(`[data-plugin-masteryls-id="${idA}"]`);
  const widgetB = page.locator(`[data-plugin-masteryls-id="${idB}"]`);

  // Confirm we start out observing Sally, who answered both questions.
  await expect(page.getByText(/Observe mode is active for/)).toBeVisible();
  await expect(widgetB.getByRole('radio', { name: 'Right B' })).toBeChecked();

  // Exit observe mode - Bud (self) never answered question B. The store must not keep
  // showing Sally's leftover answer once we're back to viewing Bud's own progress.
  await page.getByRole('button', { name: 'Exit observe' }).click();
  await expect(page.getByText(/Observe mode is active for/)).toHaveCount(0);

  await expect(widgetA.getByRole('radio', { name: 'Right A' })).toBeChecked();
  await expect(widgetA.getByRole('radio', { name: 'Right A' })).toBeEnabled();

  // Question B must revert to unanswered - not still show Sally's "Right B" selection.
  await expect(widgetB.getByRole('radio', { name: 'Wrong B' })).not.toBeChecked();
  await expect(widgetB.getByRole('radio', { name: 'Right B' })).not.toBeChecked();
  await expect(widgetB.getByRole('radio', { name: 'Right B' })).toBeEnabled();
});
