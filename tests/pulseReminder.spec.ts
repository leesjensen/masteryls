import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';
const ENROLLMENT_ID = '50a0dcd2-2b5a-4c4a-b5c3-0751c874d6f5';
const LEARNER_ID = '15cb92ef-d2d0-4080-8770-999516448960';

// The session clock is 2026-11-11, so a Sep 1 – Dec 18 schedule window is active.
async function setupSchedule(page: any, { endDate = '2026-12-18', settings = {}, roles = [] }: { endDate?: string; settings?: any; roles?: any[] } = {}) {
  const patches: any[] = [];
  // Default to a learner without course roles; selected cases exercise enrolled overseers too.
  await page.route(/.*supabase.co\/rest\/v1\/role(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: roles });
    await route.fulfill({ status: 201, json: {} });
  });
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, (route: any) =>
    route.fulfill({ json: [{ id: 'sec-1', catalogId: COURSE_ID, termId: 'term-1', scheduleId: 'sch-1', title: 'Section 1', state: 'published' }] }),
  );
  await page.route(/.*supabase.co\/rest\/v1\/term(\?.+)?/, (route: any) =>
    route.fulfill({ json: [{ id: 'term-1', catalogId: COURSE_ID, title: 'Fall', startDate: '2026-09-01', endDate: '2026-12-18', createdAt: '2026-09-01T00:00:00Z' }] }),
  );
  await page.route(/.*supabase.co\/rest\/v1\/schedule(\?.+)?/, (route: any) =>
    route.fulfill({ json: [{ id: 'sch-1', catalogId: COURSE_ID, termId: 'term-1', title: 'Fall', state: 'published', startDate: '2026-09-01', endDate, contentPath: 'https://raw.githubusercontent.com/ghAccount/ghRepo/main/instruction/schedule/schedule.md' }] }),
  );
  await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route: any) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      patches.push(route.request().postDataJSON());
      await route.fulfill({ status: 204 });
      return;
    }
    if (method === 'GET') {
      await route.fulfill({ json: [{ id: ENROLLMENT_ID, catalogId: COURSE_ID, learnerId: LEARNER_ID, sectionId: 'sec-1', settings, progress: { mastery: 0 } }] });
      return;
    }
    await route.fulfill({ status: 204 });
  });
  // The learner's own mastery/pulse view fetches its overview on arrival.
  await page.route(/.*supabase.co\/functions\/v1\/masteryoverview(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    await route.fulfill({ status: 200, json: { rows: [{ enrollmentId: ENROLLMENT_ID, learnerId: LEARNER_ID, learnerName: 'Bud', learnerEmail: 'bud@cow.com', sectionId: 'sec-1', progress: {} }], totalCount: 1 } });
  });
  return patches;
}

test('accepting the reminder takes the pulse on the pulse page (the request is not lost)', async ({ page }) => {
  await initBasicCourse({ page });
  await setupSchedule(page);
  // Mock the generate() path so it runs to completion on the pulse page.
  await page.route(/.*supabase.co\/rest\/v1\/progress(\?.+)?/, (route: any) => route.fulfill({ json: [] }));
  const pulsePosts: any[] = [];
  await page.route(/.*supabase.co\/rest\/v1\/pulse(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'POST') {
      const row = { id: 'p-new', createdAt: new Date().toISOString(), ...route.request().postDataJSON()[0] };
      pulsePosts.push(row);
      await route.fulfill({ status: 201, json: row });
      return;
    }
    await route.fulfill({ json: pulsePosts });
  });

  await navigateToCourse(page);
  await expect(page.getByText('take your pulse')).toBeVisible();
  await page.getByRole('button', { name: 'Take pulse' }).click();

  // The banner navigates to the pulse page AND auto-starts the pulse there, so it is saved (not lost).
  await expect(page).toHaveURL(new RegExp(`/course/${COURSE_ID}/mastery`));
  await expect.poll(() => pulsePosts.length, { timeout: 15000 }).toBeGreaterThan(0);
  expect(pulsePosts[0].targetType).toBe('learner');

  await page.goto(`/course/${COURSE_ID}`);
  await expect(page.getByText('take your pulse')).toHaveCount(0);
});

test('dismissing the reminder stores a 12-hour cooldown and it returns when the cooldown expires', async ({ page }) => {
  await initBasicCourse({ page });
  await setupSchedule(page);
  await navigateToCourse(page);

  await expect(page.getByText('take your pulse')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss reminder' }).click();
  await expect(page.getByText('take your pulse')).toHaveCount(0);

  const settingsKey = `uiSettings-${COURSE_ID}`;
  const nextPromptAt = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').pulsePrompt?.nextPromptAt, settingsKey);
  expect(nextPromptAt).toBeGreaterThan(Date.now());

  await page.reload();
  await expect(page.getByText('take your pulse')).toHaveCount(0);

  await page.evaluate((key) => {
    const settings = JSON.parse(localStorage.getItem(key) || '{}');
    settings.pulsePrompt.nextPromptAt = Date.now() - 1;
    localStorage.setItem(key, JSON.stringify(settings));
  }, settingsKey);
  await page.reload();

  await expect(page.getByText('take your pulse')).toBeVisible();
});

for (const role of ['root', 'editor', 'mentor']) {
  test(`an enrolled ${role} has pulse reminders off by default`, async ({ page }) => {
    await initBasicCourse({ page });
    await setupSchedule(page, {
      roles: [{ user: LEARNER_ID, right: role, ...(role === 'root' ? {} : { object: COURSE_ID }), settings: {} }],
    });
    await navigateToCourse(page);

    await expect(page.getByText('take your pulse')).toHaveCount(0);
  });
}

test('an enrolled overseer with reminders explicitly enabled is prompted', async ({ page }) => {
  await initBasicCourse({ page });
  await setupSchedule(page, {
    settings: { pulsePromptsDisabled: false },
    roles: [{ user: LEARNER_ID, right: 'editor', object: COURSE_ID, settings: {} }],
  });
  await navigateToCourse(page);

  await expect(page.getByText('take your pulse')).toBeVisible();
});

test('an enrolled overseer accepting the reminder is routed to their own learner pulse view and takes the pulse', async ({ page }) => {
  await initBasicCourse({ page });
  await setupSchedule(page, {
    settings: { pulsePromptsDisabled: false },
    roles: [{ user: LEARNER_ID, right: 'editor', object: COURSE_ID, settings: {} }],
  });
  await page.route(/.*supabase.co\/rest\/v1\/progress(\?.+)?/, (route: any) => route.fulfill({ json: [] }));
  const pulsePosts: any[] = [];
  await page.route(/.*supabase.co\/rest\/v1\/pulse(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'POST') {
      const row = { id: 'p-new', createdAt: new Date().toISOString(), ...route.request().postDataJSON()[0] };
      pulsePosts.push(row);
      await route.fulfill({ status: 201, json: row });
      return;
    }
    await route.fulfill({ json: pulsePosts });
  });

  await navigateToCourse(page);
  await page.getByRole('button', { name: 'Take pulse' }).click();

  // An overseer must land on their OWN learner pulse view (not the roster, which ignores ?tab/take).
  await expect(page).toHaveURL(new RegExp(`/course/${COURSE_ID}/mastery/learner/${LEARNER_ID}`));
  await expect.poll(() => pulsePosts.length, { timeout: 15000 }).toBeGreaterThan(0);
  expect(pulsePosts[0].targetType).toBe('learner');
  expect(pulsePosts[0].targetId).toBe(LEARNER_ID);
});

test('the Pulse view toggle opts out of pulse reminders on the enrollment', async ({ page }) => {
  await initBasicCourse({ page });
  const patches = await setupSchedule(page);

  await navigateToCourse(page);
  await page.goto(`/course/${COURSE_ID}/mastery?tab=pulses`);

  const toggle = page.getByRole('checkbox', { name: 'Remind me to take my pulse' });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect.poll(() => patches.at(-1)?.settings?.pulsePromptsDisabled).toBe(true);
});

test('no reminder when the current date is outside the schedule window', async ({ page }) => {
  await initBasicCourse({ page });
  await setupSchedule(page, { endDate: '2026-10-01' }); // ended before the session clock (2026-11-11)

  await navigateToCourse(page);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByText('take your pulse')).toHaveCount(0);
});

test('no reminder when the learner has opted out', async ({ page }) => {
  await initBasicCourse({ page });
  await setupSchedule(page, { settings: { pulsePromptsDisabled: true } });

  await navigateToCourse(page);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByText('take your pulse')).toHaveCount(0);
});
