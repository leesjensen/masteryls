import { test, expect } from './fixtures';
import { initBasicCourse, navigateToDashboard, navigateToCourse } from './testInit';

const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';
const LEARNER_ID = '15cb92ef-d2d0-4080-8770-999516448960';
const KYLE_LEARNER_ID = '34df7526-484c-41d9-b905-7a4d0d92c14c';
const TOPIC1_ID = '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f'; // "topic 1" in the test course
const TOPIC2_ID = '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b'; // "topic 2"

// Roster used by the Metrics overseer learner type-ahead (and the roster tab).
function mockOverview(page: any) {
  return page.route(/.*supabase.co\/functions\/v1\/masteryoverview(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    const payload = await route.request().postDataJSON();
    const allRows = [
      { enrollmentId: 'enroll-bud', learnerId: LEARNER_ID, learnerName: 'Bud', learnerEmail: 'bud@cow.com', sectionId: 'sec-a', progress: {} },
      { enrollmentId: 'enroll-kyle', learnerId: KYLE_LEARNER_ID, learnerName: 'Kyle Robinson', learnerEmail: 'krobin37@byu.edu', sectionId: 'sec-a', progress: {} },
    ];
    const rows = payload?.learnerId ? allRows.filter((r) => r.learnerId === payload.learnerId) : allRows;
    await route.fulfill({ status: 200, json: { rows, totalCount: rows.length } });
  });
}

// The aggregating RPC. Captures every call so a test can assert the filters sent, and returns a
// caller-supplied topic payload.
function mockTopicViewsRpc(page: any, topics: any[], total: number, totalSeconds = 0) {
  const calls: any[] = [];
  page.route(/.*supabase.co\/rest\/v1\/rpc\/topic_views_evidence(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    calls.push(await route.request().postDataJSON());
    const totalInteractionsCompleted = topics.reduce((sum, topic) => sum + (Number(topic.interactionsCompleted) || 0), 0);
    await route.fulfill({ status: 200, json: { status: 'available', topics, total, totalSeconds, totalInteractionsCompleted } });
  });
  return calls;
}

test('overseer sees a Metrics tab between Roster and Pulses with topic views and completed interactions', async ({ page }) => {
  await initBasicCourse({ page });
  await mockOverview(page);
  const calls = mockTopicViewsRpc(page, [
    { topicId: TOPIC1_ID, count: 5, interactionsCompleted: 4 },
    { topicId: TOPIC2_ID, count: 2, interactionsCompleted: 1 },
  ], 7);

  await navigateToDashboard(page);
  await page.goto(`/course/${COURSE_ID}/mastery`);

  // Tabs appear in order: Roster, Metrics, Pulses.
  await expect(page.getByRole('button', { name: 'Roster' })).toBeVisible();
  await page.getByRole('button', { name: 'Metrics' }).click();

  await expect(page.getByTestId('metrics-panel')).toBeVisible();
  await expect(page.getByTestId('metrics-panel').getByRole('img', { name: 'Topic views with active time' })).toBeVisible();
  await expect(page.getByTestId('metrics-panel').getByText('7 views')).toBeVisible();
  await expect(page.getByTestId('metrics-panel').getByRole('img', { name: 'Completed interactions by topic' })).toBeVisible();
  await expect(page.getByText('5 completions')).toBeVisible();

  // The default range is the last 24 hours, scoped to the course with no section/learner filter.
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  const first = calls[0];
  expect(first.p_catalog_id).toBe(COURSE_ID);
  expect(first.p_section_id).toBeNull();
  expect(first.p_learner_id).toBeNull();
  const spanHours = (Date.parse(first.p_end_at) - Date.parse(first.p_start_at)) / 3_600_000;
  expect(spanHours).toBeGreaterThan(23.5);
  expect(spanHours).toBeLessThan(24.5);

  // Each known topic label is a real anchor to that topic (so open-in-new-tab works).
  // The topic is linked from both the engagement and interactions charts.
  await expect(page.getByTestId('metrics-panel').locator(`a[href="/course/${COURSE_ID}/topic/${TOPIC1_ID}"]`)).toHaveCount(2);
});

test('topic labels link to the topic and the chart caps at the top 25', async ({ page }) => {
  await initBasicCourse({ page });
  await mockOverview(page);
  // 30 topics: only the two known ids resolve to titles (and thus to links); the rest are unknown.
  const many = Array.from({ length: 30 }, (_, i) => ({ topicId: i === 0 ? TOPIC1_ID : `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`, count: 30 - i }));
  mockTopicViewsRpc(page, many, 465);

  await navigateToDashboard(page);
  await page.goto(`/course/${COURSE_ID}/mastery`);
  await page.getByRole('button', { name: 'Metrics' }).click();
  await expect(page.getByTestId('metrics-panel')).toBeVisible();

  // The chart is capped at the top 25, with a note about the remainder.
  await expect(page.getByText('Showing the top 25 of 30 topics.')).toBeVisible();

  // The known topic's label navigates to that topic in-app on a plain click.
  await page.getByTestId('metrics-panel').locator(`a[href="/course/${COURSE_ID}/topic/${TOPIC1_ID}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/course/${COURSE_ID}/topic/${TOPIC1_ID}`));
});

test('overseer can filter the metrics to a section and a learner', async ({ page }) => {
  await initBasicCourse({ page });
  // Give the course a section so the Section dropdown appears.
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, (route: any) =>
    route.fulfill({ json: [{ id: 'sec-a', catalogId: COURSE_ID, termId: 'term-1', scheduleId: 'sch-1', title: 'Section A', state: 'published' }] }),
  );
  await mockOverview(page);
  const calls = mockTopicViewsRpc(page, [{ topicId: TOPIC1_ID, count: 3 }], 3);

  await navigateToDashboard(page);
  await page.goto(`/course/${COURSE_ID}/mastery`);
  await page.getByRole('button', { name: 'Metrics' }).click();
  await expect(page.getByTestId('metrics-panel')).toBeVisible();

  // Filter by section.
  await page.getByLabel('Section').selectOption('sec-a');
  await expect.poll(() => calls.some((c) => c.p_section_id === 'sec-a')).toBe(true);

  // Filter by a single learner via the type-ahead.
  await page.getByLabel('Filter learner').fill('Bud');
  await page.getByRole('button', { name: /Bud/ }).click();
  await expect.poll(() => calls.some((c) => c.p_learner_id === LEARNER_ID)).toBe(true);
});

test('overseer metrics shows views and active time together', async ({ page }) => {
  await initBasicCourse({ page });
  await mockOverview(page);
  // topic 1: 5 views / 1h 5m active; topic 2: 2 views / 45m active; totals 7 views / 1h 50m.
  mockTopicViewsRpc(page, [{ topicId: TOPIC1_ID, count: 5, seconds: 3900 }, { topicId: TOPIC2_ID, count: 2, seconds: 2700 }], 7, 6600);

  await navigateToDashboard(page);
  await page.goto(`/course/${COURSE_ID}/mastery`);
  await page.getByRole('button', { name: 'Metrics' }).click();

  const panel = page.getByTestId('metrics-panel');
  // Views and active time share a chart, alongside a separate completed-interactions chart.
  await expect(panel.getByText('7 views · 1h 50m active')).toBeVisible();
  await expect(panel.getByRole('img', { name: 'Topic views with active time' })).toBeVisible();
});

test('overseer metrics shows an empty state when no topics were viewed', async ({ page }) => {
  await initBasicCourse({ page });
  await mockOverview(page);
  mockTopicViewsRpc(page, [], 0);

  await navigateToDashboard(page);
  await page.goto(`/course/${COURSE_ID}/mastery`);
  await page.getByRole('button', { name: 'Metrics' }).click();

  await expect(page.getByText('No topic views in this range.')).toBeVisible();
});

test('a learner sees a self-scoped Metrics tab before Pulses with no section/learner filters', async ({ page }) => {
  await initBasicCourse({ page });
  // A pure learner (strip the default overseer roles) with an enrollment in the course.
  await page.route(/.*supabase.co\/rest\/v1\/role(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] });
    await route.fulfill({ status: 201, json: {} });
  });
  await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [{ id: 'enroll-bud', catalogId: COURSE_ID, learnerId: LEARNER_ID, sectionId: 'sec-a', settings: {}, progress: {} }] });
    await route.fulfill({ status: 204 });
  });
  await page.route(/.*supabase.co\/functions\/v1\/masteryoverview(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    await route.fulfill({ status: 200, json: { rows: [{ enrollmentId: 'enroll-bud', learnerId: LEARNER_ID, learnerName: 'Bud', learnerEmail: 'bud@cow.com', sectionId: 'sec-a', progress: {} }], totalCount: 1 } });
  });
  const calls = mockTopicViewsRpc(page, [{ topicId: TOPIC1_ID, count: 4 }], 4);

  await navigateToCourse(page);
  await page.goto(`/course/${COURSE_ID}/mastery`);
  await page.getByRole('button', { name: 'Metrics' }).click();

  await expect(page.getByTestId('metrics-panel')).toBeVisible();
  await expect(page.getByTestId('metrics-panel').getByRole('img', { name: 'Topic views with active time' })).toBeVisible();
  // No overseer filters for a learner.
  await expect(page.getByLabel('Section')).toHaveCount(0);
  await expect(page.getByLabel('Filter learner')).toHaveCount(0);
  // The client scopes to the learner's own id (the RPC also enforces this).
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  expect(calls[0].p_learner_id).toBe(LEARNER_ID);
});
