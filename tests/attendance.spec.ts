import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse, navigateToDashboard } from './testInit';

const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';
const LEARNER_ID = '15cb92ef-d2d0-4080-8770-999516448960';
const SESSION_ID = 'a77e0da7-0000-4000-8000-000000000001';
const SECTION_ID = 'b1111111-0000-4000-8000-000000000001';
const ENROLLMENT_ID = '50a0dcd2-2b5a-4c4a-b5c3-0751c874d6f5';
const CODE = '4821';

// One section with attendance enabled, for the course load (getCourseSections).
async function mockAttendanceEnabledSection(page: any) {
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, async (route: any) => {
    await route.fulfill({ json: [{ id: SECTION_ID, catalogId: COURSE_ID, title: 'Section A', scheduleId: null, attendanceEnabled: true }] });
  });
}

// Stateful mock of the attendance RPCs, the attendance table, and attendance progress rows.
async function mockAttendance(page: any, { learner = false } = {}) {
  const state: any = {
    openSession: null,
    sessions: [],
    progress: [],
    recordCalls: [] as any[],
    enrolledCount: 3,
  };

  await mockAttendanceEnabledSection(page);

  if (learner) {
    // No roles: the user is a plain enrolled learner whose section has attendance enabled.
    await page.route(/.*supabase.co\/rest\/v1\/role(\?.+)?/, async (route: any) => {
      await route.fulfill({ json: [] });
    });
    await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route: any) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: [{ id: ENROLLMENT_ID, catalogId: COURSE_ID, learnerId: LEARNER_ID, settings: {}, progress: { mastery: 0 }, sectionId: SECTION_ID }] });
        return;
      }
      await route.fallback();
    });
    state.openSession = {
      id: SESSION_ID,
      catalogId: COURSE_ID,
      code: CODE,
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          prompt: 'How are things going?',
          choices: ['Great', 'Good', 'OK', 'Struggling'],
        },
      ],
      openedAt: new Date().toISOString(),
      closedAt: null,
    };
    state.sessions.push(state.openSession);
  }

  const sessionsResponse = () => ({
    enrolledCount: state.enrolledCount,
    sessions: state.sessions.map((session: any) => {
      const rows = state.progress.filter((row: any) => row.interactionId === session.id);
      const answerTally: any = {};
      for (const row of rows) {
        for (const [qid, answer] of Object.entries(row.details?.answers || {})) {
          answerTally[qid] = answerTally[qid] || {};
          answerTally[qid][answer as string] = (answerTally[qid][answer as string] || 0) + 1;
        }
      }
      return {
        id: session.id,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        questions: session.questions,
        attendeeCount: rows.length,
        answerTally,
      };
    }),
  });

  await page.route(/.*supabase.co\/rest\/v1\/rpc\/(open_attendance|close_attendance|record_attendance|attendance_sessions)(\?.+)?/, async (route: any) => {
    const name = route
      .request()
      .url()
      .match(/rpc\/([a-z_]+)/)[1];
    const body = route.request().postDataJSON() || {};
    switch (name) {
      case 'open_attendance': {
        state.openSession = {
          id: SESSION_ID,
          catalogId: body.p_catalog_id,
          sectionId: body.p_section_id || null,
          code: CODE,
          questions: body.p_questions || [],
          openedAt: new Date().toISOString(),
          closedAt: null,
        };
        state.sessions.push(state.openSession);
        // Simulate a learner checking in while attendance is open.
        state.progress.push({
          id: 'progress-attendance-1',
          createdAt: new Date().toISOString(),
          userId: LEARNER_ID,
          catalogId: COURSE_ID,
          interactionId: SESSION_ID,
          type: 'attendance',
          details: { answers: { q1: 'Good' } },
        });
        await route.fulfill({ json: state.openSession });
        return;
      }
      case 'close_attendance': {
        state.openSession.closedAt = new Date().toISOString();
        const closed = state.openSession;
        state.openSession = null;
        await route.fulfill({ json: closed });
        return;
      }
      case 'attendance_sessions':
        await route.fulfill({ json: sessionsResponse() });
        return;
      case 'record_attendance': {
        state.recordCalls.push(body);
        const session = state.openSession;
        if (!session || body.p_code !== session.code) {
          await route.fulfill({
            status: 400,
            json: {
              code: 'P0001',
              message: 'No attendance is being taken with that code',
            },
          });
          return;
        }
        if (session.questions.length > 0 && body.p_answers == null) {
          await route.fulfill({
            json: {
              status: 'questions',
              sessionId: session.id,
              questions: session.questions,
            },
          });
          return;
        }
        state.progress.push({
          id: 'progress-attendance-1',
          createdAt: new Date().toISOString(),
          userId: LEARNER_ID,
          catalogId: COURSE_ID,
          interactionId: session.id,
          type: 'attendance',
          details: { answers: body.p_answers },
        });
        await route.fulfill({
          json: {
            status: 'recorded',
            sessionId: session.id,
            attended: state.progress.length,
          },
        });
        return;
      }
    }
  });

  await page.route(/.*supabase.co\/rest\/v1\/attendance(\?.+)?/, async (route: any) => {
    await route.fulfill({
      json: state.openSession ? [state.openSession] : [],
    });
  });

  await page.route(/.*supabase.co\/rest\/v1\/progress(\?.+)?/, async (route: any) => {
    const url = decodeURIComponent(route.request().url());
    if (route.request().method() === 'GET' && url.includes('type=in.(attendance)')) {
      const sessionMatch = url.match(/interactionId=eq\.([0-9a-f-]+)/);
      const rows = state.progress.filter((row: any) => !sessionMatch || row.interactionId === sessionMatch[1]);
      await route.fulfill({
        json: rows,
        headers: {
          'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
        },
      });
      return;
    }
    await route.fallback();
  });

  return state;
}

async function openAttendanceView(page: any) {
  await navigateToCourse(page);
  await page.getByRole('link', { name: 'Attendance' }).click();
  await expect(page).toHaveURL(new RegExp(`/course/${COURSE_ID}/attendance$`));
}

test('attendance is hidden from the TOC for a learner whose section has no attendance', async ({ page }) => {
  await initBasicCourse({ page });
  // Plain learner; their section exists but attendance is not enabled for it.
  await page.route(/.*supabase.co\/rest\/v1\/role(\?.+)?/, async (route: any) => {
    await route.fulfill({ json: [] });
  });
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, async (route: any) => {
    await route.fulfill({ json: [{ id: SECTION_ID, catalogId: COURSE_ID, title: 'Section A', scheduleId: null, attendanceEnabled: false }] });
  });
  await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [{ id: ENROLLMENT_ID, catalogId: COURSE_ID, learnerId: LEARNER_ID, settings: {}, progress: { mastery: 0 }, sectionId: SECTION_ID }] });
      return;
    }
    await route.fallback();
  });
  await navigateToCourse(page);
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Attendance' })).toHaveCount(0);
});

test('attendance is always available in the TOC for an editor', async ({ page }) => {
  await initBasicCourse({ page });
  await mockAttendance(page);
  await navigateToCourse(page);
  await expect(page.getByRole('link', { name: 'Attendance' })).toBeVisible();
});

test('an editor takes attendance with a question and reviews the responses', async ({ page }) => {
  await initBasicCourse({ page });
  const state = await mockAttendance(page);

  await openAttendanceView(page);
  await expect(page.getByText('No attendance has been taken yet.')).toBeVisible();

  // The standard wellness question is always asked — there is no opt-in toggle.
  await expect(page.getByText('Learners are asked')).toBeVisible();
  await page.getByRole('button', { name: 'Take attendance' }).click();

  const overlay = page.getByTestId('attendance-code-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByLabel('Attendance code value')).toHaveText(CODE);
  await expect(overlay).toContainText('How are things going?');
  await expect(overlay).toContainText('1 checked in');
  expect(state.sessions[0].questions).toEqual([
    {
      id: 'q1',
      type: 'multiple-choice',
      prompt: 'How are things going?',
      choices: ['Great', 'Good', 'OK', 'Struggling'],
    },
  ]);

  await overlay.getByRole('button', { name: 'Close attendance' }).click();
  await expect(overlay).toHaveCount(0);

  await expect(page.getByTestId('course-attendance-chart')).toContainText('average attendance 1');
  // The aggregate chart carries the wellness-question sentiment legend.
  await expect(page.getByTestId('course-attendance-chart')).toContainText('Great');
  const sessionList = page.getByTestId('attendance-session-list');
  await expect(sessionList).toContainText('1 present');
  await sessionList.getByRole('button').first().click();
  const responses = page.getByTestId('attendance-responses');
  await expect(responses).toContainText('Bud');
  await expect(responses).toContainText('Good');
  // The learner name links to their mastery view for this course (rendered in the content pane).
  await expect(responses.getByRole('link', { name: /Bud/ })).toHaveAttribute('href', `/course/${COURSE_ID}/mastery/learner/${LEARNER_ID}`);
});

test('a learner checks in with the class code, answers the question, and sees their history', async ({ page }) => {
  await initBasicCourse({
    page,
    courseJsonOverride: {
      externalRefs: {
        canvasCourseId: '12345',
        attendance: {
          canvasAssignmentId: 777,
          pointsPerSession: 2,
          pointsPossible: 80,
        },
      },
    },
  });
  const state = await mockAttendance(page, { learner: true });

  const gradePosts: any[] = [];
  await page.route(/.*supabase.co\/functions\/v1\/canvasgradebook(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
      return;
    }
    const body = await route.request().postDataJSON();
    if (body?.mode === 'check') {
      await route.fulfill({
        status: 200,
        json: { ok: true, eligible: true },
      });
      return;
    }
    gradePosts.push(body);
    await route.fulfill({ status: 200, json: { ok: true } });
  });

  await openAttendanceView(page);
  await expect(page.getByRole('button', { name: 'Take attendance' })).toHaveCount(0);
  await expect(page.getByTestId('learner-attendance-chart')).toContainText('Attended 0 of 1 class');
  // Learners only see the classes they attended — no total, no Present/Absent legend.
  await expect(page.getByTestId('learner-attendance-chart')).not.toContainText('Absent');
  await expect(page.getByTestId('learner-attendance-chart')).not.toContainText('Present');
  await expect(page.getByTestId('learner-attendance-chart')).toContainText('No classes attended yet.');

  // A wrong code records nothing.
  await page.getByLabel('Attendance code').fill('1111');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText('No attendance is being taken with that code')).toBeVisible();
  expect(state.progress.length).toBe(0);

  // The right code asks the session's question before recording.
  await page.getByLabel('Attendance code').fill(CODE);
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText('How are things going?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: 'Good' }).check();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect(page.getByText('Your attendance has been recorded.')).toBeVisible();
  expect(state.recordCalls.at(-1)).toEqual({
    p_catalog_id: COURSE_ID,
    p_code: CODE,
    p_answers: { q1: 'Good' },
  });
  await expect(page.getByTestId('learner-attendance-chart')).toContainText('Attended 1 of 1 class');
  // The learner's own graph reflects the answer they gave for that class.
  await expect(page.getByTestId('learner-attendance-chart')).toContainText('Good');
  await expect(page.getByTestId('learner-attendance-chart')).toContainText('Points: 2 / 80');

  await expect.poll(() => gradePosts.length).toBe(1);
  expect(gradePosts[0]).toMatchObject({
    topicType: 'attendance',
    canvasAssignmentId: 777,
    pointsPossible: 80,
    percentCorrect: 2.5,
    learnerEmail: 'bud@cow.com',
  });
});

test('creating the attendance assignment posts the configured points and stores them on the course', async ({ page }) => {
  await initBasicCourse({
    page,
    courseJsonOverride: { externalRefs: { canvasCourseId: '12345' } },
  });
  await mockAttendanceEnabledSection(page);
  await page.route('https://api.github.com/user', async (route: any) => {
    await route.fulfill({ status: 200, json: { login: 'mock-user' } });
  });
  const assignmentPayloads: any[] = [];
  await page.route(/.*supabase.co\/functions\/v1\/canvas(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
      return;
    }
    const body = await route.request().postDataJSON();
    assignmentPayloads.push(body.body.assignment);
    await route.fulfill({
      status: 200,
      json: { id: 9100, name: body.body.assignment.name },
    });
  });

  await navigateToDashboard(page);
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'Link course', exact: true }).click();
  await page.getByLabel('Course', { exact: true }).selectOption(COURSE_ID);

  await expect(page.getByLabel('Points per class')).toHaveValue('2');
  await expect(page.getByLabel('Points possible')).toHaveValue('80');
  await page.getByLabel('Points per class').fill('3');
  await page.getByLabel('Points possible').fill('60');
  await page.getByRole('button', { name: 'Create attendance assignment' }).click();

  await expect(page.locator('#root')).toContainText('Attendance assignment created');
  await expect(page.getByRole('link', { name: 'Attendance' })).toHaveAttribute('href', 'https://byu.instructure.com/courses/12345/assignments/9100');
  expect(assignmentPayloads).toHaveLength(1);
  expect(assignmentPayloads[0]).toMatchObject({
    name: 'Attendance',
    points_possible: 60,
    grading_type: 'points',
    submission_types: ['none'],
  });
});
