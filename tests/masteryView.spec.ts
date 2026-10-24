import { test, expect } from './fixtures';
import { initBasicCourse, navigateToDashboard } from './testInit';

const LEARNER_ID = '15cb92ef-d2d0-4080-8770-999516448960';
const KYLE_LEARNER_ID = '34df7526-484c-41d9-b905-7a4d0d92c14c';
const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';

// The edge function returns identity + progress (trimmed for the list, full for a single learner)
// and does no sorting/search/pagination - the client derives metrics and does all of that locally.
function mockGradebookOverview(page: any) {
  const requests: any[] = [];
  return page.route(/.*supabase.co\/functions\/v1\/masteryoverview(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (route.request().method() !== 'POST') {
      throw new Error(`Unexpected masteryoverview method ${route.request().method()}`);
    }

    const payload = await route.request().postDataJSON();
    requests.push(payload);
    const learnerId = String(payload?.learnerId || '');
    // Mirror the edge function: attendedCount is only returned when the roster asks for it.
    const attendance = payload?.includeAttendance === true ? { [LEARNER_ID]: 3, [KYLE_LEARNER_ID]: 0 } : null;
    const allRows = [
      {
        enrollmentId: 'enroll-bud',
        learnerId: LEARNER_ID,
        learnerName: 'Bud',
        learnerEmail: 'bud@cow.com',
        progress: { 'topic-a': { completedCount: 0, timeSpent: 100 }, 'topic-b': { completedCount: 0, timeSpent: 48, examCompleted: true } },
      },
      {
        enrollmentId: 'enroll-kyle',
        learnerId: KYLE_LEARNER_ID,
        learnerName: 'Kyle Robinson',
        learnerEmail: 'krobin37@byu.edu',
        progress: {},
      },
    ].map((row) => (attendance ? { ...row, attendedCount: attendance[row.learnerId] ?? 0 } : row));
    const rows = learnerId ? allRows.filter((row) => row.learnerId === learnerId) : allRows;

    await route.fulfill({
      status: 200,
      json: { rows, totalCount: rows.length },
    });
  }).then(() => requests);
}

// Builds a two-page dataset (60 rows; the view paginates locally at 50/page). The globally
// alphabetically-first learner ("Aaron Aardvark") is placed LAST, and also given the globally
// SMALLEST time-spent, so that in default order it lands on page 2 - letting a test prove that
// sorting reorders the whole dataset rather than just the rows already on the current page.
// Each row carries a progress blob so the client derives a distinct Time Spent (course-independent).
function buildSortableRows() {
  const rows: any[] = [];
  const makeRow = (i: number, name: string, email: string, timeSpent: number) => ({
    enrollmentId: `enroll-${i}`,
    learnerId: `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`,
    learnerName: name,
    learnerEmail: email,
    progress: { 'topic-a': { completedCount: 0, timeSpent } },
  });

  rows.push(makeRow(0, 'Zelda Zimmerman', 'zelda@test.edu', 1000));
  for (let i = 1; i <= 58; i++) {
    rows.push(makeRow(i, `Learner ${String(i).padStart(2, '0')}`, `learner${String(i).padStart(2, '0')}@test.edu`, 1000 + i));
  }
  // Aaron: alphabetically first AND smallest time-spent, but last in default order (page 2).
  rows.push(makeRow(59, 'Aaron Aardvark', 'aaron@test.edu', 1));
  return rows;
}

// The edge function returns the whole roster unsorted/unpaginated; the client does both locally.
function mockSortableOverview(page: any) {
  const requests: any[] = [];
  const allRows = buildSortableRows();
  return page.route(/.*supabase.co\/functions\/v1\/masteryoverview(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    if (route.request().method() !== 'POST') {
      throw new Error(`Unexpected masteryoverview method ${route.request().method()}`);
    }

    const payload = await route.request().postDataJSON();
    requests.push(payload);

    await route.fulfill({
      status: 200,
      json: { rows: allRows, totalCount: allRows.length },
    });
  }).then(() => requests);
}

test('masteryview sorts across the full dataset, not just the current page', async ({ page }) => {
  await initBasicCourse({ page });
  const overviewRequests = await mockSortableOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();

  // The whole roster is fetched in a single request; sorting and paging never fetch again.
  await expect.poll(() => overviewRequests.length).toBe(1);

  // Default (unsorted) page 1 shows the default-first learner; the global alphabetical first
  // ("Aaron Aardvark") is on page 2, so it must NOT be visible yet.
  await expect(page.getByRole('cell', { name: 'Zelda Zimmerman', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Aaron Aardvark', exact: true })).toHaveCount(0);

  // Click the Learner header -> ascending by name. The client sorts the whole dataset it holds,
  // so the page-2 learner is pulled to the top of page 1. A current-page-only sort could not.
  await page.getByRole('button', { name: 'Learner' }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Aaron Aardvark');
  await expect(page.getByRole('cell', { name: 'Zelda Zimmerman', exact: true })).toHaveCount(0);

  // Click again -> descending. The global last name now leads page 1.
  await page.getByRole('button', { name: 'Learner' }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Zelda Zimmerman');
  await expect(page.getByRole('cell', { name: 'Aaron Aardvark', exact: true })).toHaveCount(0);

  // Still just the one fetch after all that sorting.
  await expect.poll(() => overviewRequests.length).toBe(1);
});

test('masteryview numeric sort spans all pages and resets to page one', async ({ page }) => {
  await initBasicCourse({ page });
  await mockSortableOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Zelda Zimmerman', exact: true })).toBeVisible();

  // Pagination controls appear both above and below the list.
  await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(2);

  // Advance to page 2 so we can prove sorting snaps back to page 1 (either Next button works).
  await page.getByRole('button', { name: 'Next' }).first().click();
  await expect(page.getByText('Page 2').first()).toBeVisible();

  // Ascending Time Spent: Aaron has the globally smallest time (and sits on page 2 by default),
  // so sorting pulls it to the top of page 1 - and paging resets to page 1.
  await page.getByRole('button', { name: 'Time Spent' }).click();
  await expect(page.getByText('Page 1').first()).toBeVisible();
  await expect(page.locator('tbody tr').first()).toContainText('Aaron Aardvark');
});

// The course has two sections; the overview mock emulates the edge function's server-side section
// scope by filtering on the sectionId the client sends. Registers the section-table read (so the
// Section dropdown appears) and the roster edge function. Returns the captured roster requests.
async function mockSectionRoster(page: any) {
  const requests: any[] = [];
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, async (route: any) => {
    await route.fulfill({
      json: [
        { id: 'sec-a', title: 'Section A', scheduleId: 'sch-a' },
        { id: 'sec-b', title: 'Section B', scheduleId: 'sch-b' },
      ],
    });
  });
  await page.route(/.*supabase.co\/functions\/v1\/masteryoverview(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    const payload = await route.request().postDataJSON();
    requests.push(payload);
    const allRows = [
      { enrollmentId: 'e-a', learnerId: 'l-a', learnerName: 'Alpha Learner', learnerEmail: 'alpha@test.edu', sectionId: 'sec-a', progress: {} },
      { enrollmentId: 'e-b', learnerId: 'l-b', learnerName: 'Beta Learner', learnerEmail: 'beta@test.edu', sectionId: 'sec-b', progress: {} },
    ];
    let rows = allRows;
    if (payload?.sectionId) rows = rows.filter((r) => r.sectionId === payload.sectionId);
    await route.fulfill({ status: 200, json: { rows, totalCount: rows.length } });
  });
  return requests;
}

test('masteryview filters the roster by section (server-side)', async ({ page }) => {
  await initBasicCourse({ page });
  const requests = await mockSectionRoster(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  // Default is "All sections": both learners show.
  await expect(page.getByText('Total learners: 2')).toBeVisible();

  // Scope to Section B: the server returns only that section's learner, and the client sends the
  // sectionId (refetch) rather than filtering locally.
  await page.getByLabel('Section').selectOption({ label: 'Section B' });
  await expect(page.getByText('Total learners: 1')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Beta Learner', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Alpha Learner', exact: true })).toHaveCount(0);
  await expect.poll(() => requests.some((r) => r.sectionId === 'sec-b')).toBe(true);

  // Back to all sections refetches the whole roster.
  await page.getByLabel('Section').selectOption({ label: 'All sections' });
  await expect(page.getByText('Total learners: 2')).toBeVisible();
});

test('masteryview loads learner overview for accessible course', async ({ page }) => {
  await initBasicCourse({ page });
  const overviewRequests = await mockGradebookOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  // The whole roster arrives in one request; both learners are listed and counted locally.
  await expect(page.getByText('bud@cow.com')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Kyle Robinson', exact: true })).toBeVisible();
  await expect(page.getByText('Total learners: 2')).toBeVisible();

  // Filtering is client-side: no extra request, just a local filter + recount.
  await page.getByLabel('Filter learner').fill('kyle');
  await expect(page.getByRole('cell', { name: 'Kyle Robinson', exact: true })).toBeVisible();
  await expect(page.getByText('bud@cow.com')).toHaveCount(0);
  await expect(page.getByText('Matching learners: 1')).toBeVisible();
  await expect.poll(() => overviewRequests.filter((r) => !r.learnerId).length).toBe(1);

  // Navigate to learner gradebook (this issues the single-learner full-blob request).
  await page.getByRole('cell', { name: 'Kyle Robinson', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Instruction Item' })).toBeVisible();
});

test('overseer gets a Canvas grades link to the learner on a Canvas-linked course', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: { externalRefs: { canvasCourseId: '12345' } } });
  await mockGradebookOverview(page);

  // Resolve the learner's numeric Canvas user id for the grades link.
  let lookupPayload: any = null;
  await page.route(/.*supabase.co\/functions\/v1\/canvasgradebook(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    const payload = await route.request().postDataJSON();
    if (payload?.mode === 'userLookup') {
      lookupPayload = payload;
      await route.fulfill({ status: 200, json: { ok: true, canvasUserId: 777 } });
      return;
    }
    await route.fulfill({ status: 200, json: { ok: true, eligible: false } });
  });

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();
  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  await page.getByRole('cell', { name: 'Kyle Robinson', exact: true }).click();

  // The link is a real anchor (right-clickable / opens in a new tab) to the learner's Canvas grades.
  const gradesLink = page.getByRole('link', { name: 'Canvas', exact: true });
  await expect(gradesLink).toHaveAttribute('href', 'https://byu.instructure.com/courses/12345/grades/777');
  await expect(gradesLink).toHaveAttribute('target', '_blank');

  // The lookup identified the learner by email and was scoped to the MasteryLS course (catalogId).
  expect(lookupPayload?.courseId).toBe('12345');
  expect(lookupPayload?.catalogId).toBe(COURSE_ID);
  expect(lookupPayload?.learnerEmail).toBe('krobin37@byu.edu');
});

test('no Canvas grades link when the course is not linked to Canvas', async ({ page }) => {
  await initBasicCourse({ page });
  await mockGradebookOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();
  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  await page.getByRole('cell', { name: 'Kyle Robinson', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Kyle Robinson' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Canvas', exact: true })).toHaveCount(0);
});

test('overseer opens the Canvas tab to see the learner Canvas grade breakdown', async ({ page }) => {
  await initBasicCourse({ page, courseJsonOverride: { externalRefs: { canvasCourseId: '12345' } } });
  await mockGradebookOverview(page);

  let gradesPayload: any = null;
  await page.route(/.*supabase.co\/functions\/v1\/canvasgradebook(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    const payload = await route.request().postDataJSON();
    if (payload?.mode === 'userLookup') {
      await route.fulfill({ status: 200, json: { ok: true, canvasUserId: 777 } });
      return;
    }
    if (payload?.mode === 'grades') {
      gradesPayload = payload;
      await route.fulfill({
        status: 200,
        json: {
          ok: true,
          found: true,
          overall: { score: 88, grade: 'B+' },
          assignments: [
            { name: 'HTML lab', score: 18, pointsPossible: 20, grade: '18' },
            { name: 'Midterm', score: 72, pointsPossible: 100, grade: '72' },
          ],
        },
      });
      return;
    }
    await route.fulfill({ status: 200, json: { ok: true } });
  });

  await navigateToDashboard(page);
  await page.goto(`/masteryview/learner/${LEARNER_ID}/course/${COURSE_ID}`);

  // The Canvas tab appears once the learner resolves in Canvas; opening it lazy-loads the grades.
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  const panel = page.getByTestId('canvas-grades-panel');
  await expect(panel).toContainText('Overall:');
  await expect(panel).toContainText('88%');
  await expect(panel).toContainText('B+');
  await expect(panel).toContainText('HTML lab');
  await expect(panel).toContainText('18 / 20');
  await expect(panel).toContainText('Midterm');

  // The grades request is scoped to the Canvas course and identifies the learner by email.
  expect(gradesPayload?.courseId).toBe('12345');
  expect(gradesPayload?.catalogId).toBe(COURSE_ID);
  expect(gradesPayload?.learnerEmail).toBe('bud@cow.com');
});

test('mentor can view course mastery and observe learners without edit controls', async ({ page }) => {
  await initBasicCourse({ page });
  await page.context().route(/.*supabase.co\/rest\/v1\/role(\?.+)?/, async (route: any) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      json: [
        {
          user: LEARNER_ID,
          right: 'mentor',
          object: COURSE_ID,
          settings: {},
        },
      ],
    });
  });
  await mockGradebookOverview(page);

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'MasteryView' }).click();

  await expect(page.getByRole('heading', { name: 'Course MasteryView' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Observe' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'User Menu' }).click();
  await expect(page.getByRole('button', { name: 'New course' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Link course' })).not.toBeVisible();
});

test('learner masteryview shows learner summary and topic detail', async ({ page }) => {
  await initBasicCourse({ page });
  await mockGradebookOverview(page);

  await navigateToDashboard(page);
  await page.goto(`/masteryview/learner/${LEARNER_ID}/course/${COURSE_ID}`);

  await expect(page.getByText('bud@cow.com')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Instruction Item' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /search learner/i })).not.toBeVisible();

  // An overseer can jump straight into observing this learner from the drill-down header.
  await expect(page.getByRole('button', { name: 'Observe' })).toBeVisible();
});

test('masteryview shows course attendance and a learner attendance history when attendance is enabled', async ({ page }) => {
  await initBasicCourse({ page });
  // Attendance is enabled per section now (not course.settings.attendance).
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, async (route: any) => {
    await route.fulfill({ json: [{ id: 'b1111111-0000-4000-8000-000000000001', catalogId: COURSE_ID, title: 'Section A', scheduleId: null, attendanceEnabled: true }] });
  });
  await mockGradebookOverview(page);
  const sessions = [
    { id: 'a77e0da7-0000-4000-8000-000000000001', openedAt: '2026-10-06T15:00:00Z', closedAt: '2026-10-06T15:10:00Z', questions: [], attendeeCount: 2 },
    { id: 'a77e0da7-0000-4000-8000-000000000002', openedAt: '2026-10-08T15:00:00Z', closedAt: '2026-10-08T15:10:00Z', questions: [], attendeeCount: 1 },
  ];
  await page.route(/.*supabase.co\/rest\/v1\/rpc\/attendance_sessions(\?.+)?/, async (route: any) => {
    await route.fulfill({ json: { enrolledCount: 2, sessions } });
  });
  await page.route(/.*supabase.co\/rest\/v1\/progress(\?.+)?/, async (route: any) => {
    if (decodeURIComponent(route.request().url()).includes('type=in.(attendance)')) {
      await route.fulfill({ json: [{ id: 'p1', userId: LEARNER_ID, interactionId: sessions[0].id, type: 'attendance', createdAt: sessions[0].openedAt, details: {} }] });
      return;
    }
    await route.fallback();
  });

  await navigateToDashboard(page);
  await page.goto(`/masteryview/course/${COURSE_ID}`);
  await expect(page.getByTestId('course-attendance-chart')).toContainText('2 classes recorded, average attendance 2');

  // The roster carries a per-learner attended-class count column when attendance is enabled.
  await expect(page.getByRole('columnheader', { name: 'Classes Attended' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Bud/ })).toContainText('3');

  await page.goto(`/masteryview/learner/${LEARNER_ID}/course/${COURSE_ID}`);
  await page.getByRole('button', { name: 'Attendance', exact: true }).click();
  await expect(page.getByTestId('learner-attendance-chart')).toContainText('Attended 1 class');
});
