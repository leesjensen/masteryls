import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

async function initAndOpenBasicCourse({ page }: { page: any }) {
  await initBasicCourse({ page });
  await navigateToCourse(page);
}

async function setMonacoModelValue(page: any, matcherText: string, nextValue: string) {
  await page.evaluate(({ matcherText, nextValue }) => {
    const monaco = (window as any).monaco;
    const models = monaco?.editor?.getModels?.() || [];
    const model = models.find((candidate: any) => String(candidate.getValue()).includes(matcherText));
    if (!model) {
      throw new Error(`Unable to find Monaco model containing: ${matcherText}`);
    }
    model.setValue(nextValue);
  }, { matcherText, nextValue });
}

test('snapshot ref lookup is reused across initial topic reads', async ({ page }) => {
  await initBasicCourse({ page });

  let snapshotPostCalls = 0;

  page.on('request', (request) => {
    if (request.method() === 'POST' && /supabase\.co\/functions\/v1\/githubsnapshot(\?.+)?$/.test(request.url())) {
      snapshotPostCalls += 1;
    }
  });

  await navigateToCourse(page);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'topic 1' }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();

  // Course JSON and topic markdown should share a single snapshot ref lookup.
  expect(snapshotPostCalls).toBe(1);
});

test('topic markdown is fetched from a snapshot SHA URL', async ({ page }) => {
  await initBasicCourse({ page });

  const markdownRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (request.method() === 'GET' && /raw\.githubusercontent\.com\/.*\.md(\?.*)?$/i.test(url)) {
      markdownRequests.push(url);
    }
  });

  await navigateToCourse(page);

  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect(markdownRequests.some((url) => /\/ghAccount\/ghRepo\/[a-f0-9]{40}\/README\.md$/i.test(url))).toBeTruthy();
});

test('editor markdown', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await expect(page.getByRole('code')).toContainText('# Home');
  await expect(page.getByRole('button', { name: 'testImage.png image • 16.0 KB' }).getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: 'testImage.png image • 16.0 KB' }).click();
  await expect(page.getByRole('button', { name: 'testImage.png image • 16.0 KB' }).getByRole('checkbox')).toBeChecked();
});

test('editor commit', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await expect(page.getByRole('code')).toContainText('# Home');

  await setMonacoModelValue(page, '# Home', '# Home\n\n# Home altered!');
  await expect(page.getByRole('code')).toContainText('altered!');

  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeDisabled();
});

test('settings', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.getByText('Settings').click();
  await expect(page.getByRole('textbox', { name: 'Course Title' })).toHaveValue('Rocket Science');
});

test('terms & sections view creates a term with its first section', async ({ page }) => {
  const terms: any[] = [];
  const sections: any[] = [];
  const termPosts: any[] = [];
  const sectionPosts: any[] = [];

  await initAndOpenBasicCourse({ page });

  await page.route(/.*supabase.co\/rest\/v1\/term(\?.+)?/, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const row = { id: 'new-term', ...firstRow(route.request().postDataJSON()) };
      termPosts.push(row);
      terms.push(row);
      await route.fulfill({ status: 201, json: row });
      return;
    }
    if (method === 'PATCH') {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ json: terms });
  });

  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const row = { id: 'new-section', ...firstRow(route.request().postDataJSON()) };
      sectionPosts.push(row);
      sections.push(row);
      await route.fulfill({ status: 201, json: row });
      return;
    }
    if (method === 'PATCH') {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ json: sections });
  });

  // No enrolled learners needed; counts come from enrollment GET.
  await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fallback();
  });

  await page.getByRole('link', { name: 'Terms & Sections' }).click();
  await expect(page.getByRole('heading', { name: /Terms & Sections/, level: 2 })).toBeVisible();

  // A term is always created together with its first section.
  await page.getByRole('button', { name: '+ New term' }).click();
  await page.getByPlaceholder('Term title').fill('Fall 2027');
  await page.getByPlaceholder('Section title').fill('Section A');
  await page.getByRole('button', { name: 'Create term & section' }).click();

  // The term is created with its title, then its first section is created under that term.
  await expect.poll(() => termPosts.length).toBeGreaterThan(0);
  expect(termPosts.at(-1).title).toBe('Fall 2027');
  await expect.poll(() => sectionPosts.length).toBeGreaterThan(0);
  expect(sectionPosts.at(-1).title).toBe('Section A');
  expect(sectionPosts.at(-1).termId).toBe('new-term');
});

function firstRow(body: any) {
  return Array.isArray(body) ? body[0] : body;
}

function idFromDeleteUrl(url: string): string {
  const match = /[?&]id=eq\.([^&]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : '';
}

test('terms & sections view deletes empty sections and whole terms', async ({ page }) => {
  // Seeded: one term with two empty sections. Both sections are deletable (0 learners, >1 in the
  // term); once one is gone the last keeps no trash and the term itself is deletable.
  const terms: any[] = [{ id: 'term-1', catalogId: 'c', title: 'Fall 2026', startDate: null, endDate: null }];
  const sections: any[] = [
    { id: 'sec-1', catalogId: 'c', termId: 'term-1', scheduleId: null, title: 'Section A', attendanceEnabled: false },
    { id: 'sec-2', catalogId: 'c', termId: 'term-1', scheduleId: null, title: 'Section B', attendanceEnabled: false },
  ];
  const sectionDeletes: string[] = [];
  const termDeletes: string[] = [];
  const scheduleDetachPatches: string[] = [];

  await initAndOpenBasicCourse({ page });

  await page.route(/.*supabase.co\/rest\/v1\/term(\?.+)?/, async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      termDeletes.push(idFromDeleteUrl(route.request().url()));
      const idx = terms.findIndex((t) => t.id === idFromDeleteUrl(route.request().url()));
      if (idx >= 0) terms.splice(idx, 1);
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ json: terms });
  });

  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      const id = idFromDeleteUrl(route.request().url());
      sectionDeletes.push(id);
      const idx = sections.findIndex((s) => s.id === id);
      if (idx >= 0) sections.splice(idx, 1);
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ json: sections });
  });

  // Term delete detaches schedules (termId -> null) before deleting the term.
  await page.route(/.*supabase.co\/rest\/v1\/schedule(\?.+)?/, async (route) => {
    if (route.request().method() === 'PATCH') {
      scheduleDetachPatches.push(route.request().url());
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ json: [] });
  });

  await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fallback();
  });

  await page.getByRole('link', { name: 'Terms & Sections' }).click();
  await expect(page.getByRole('heading', { name: /Terms & Sections/, level: 2 })).toBeVisible();

  // Two sections, each with a delete control. Delete one.
  await expect(page.getByLabel('Delete section Section A')).toBeVisible();
  await expect(page.getByLabel('Delete section Section B')).toBeVisible();
  await page.getByLabel('Delete section Section B').click();
  await page.locator('dialog:has-text("Delete section")').getByRole('button', { name: 'Delete', exact: true }).click();

  await expect.poll(() => sectionDeletes).toContain('sec-2');
  // The lone remaining section can't be individually deleted - you delete the term.
  await expect(page.getByLabel('Delete section Section A')).toHaveCount(0);

  await page.getByRole('button', { name: 'Delete term' }).click();
  await page.locator('dialog:has-text("Schedules are kept")').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(() => termDeletes).toContain('term-1');
  await expect.poll(() => scheduleDetachPatches.length).toBeGreaterThan(0);
  await expect(page.getByText('No terms yet.', { exact: false })).toBeVisible();
});

test('terms & sections schedules panel deletes only an unreferenced schedule', async ({ page }) => {
  // Two schedules: one assigned to a section (no delete control), one free (deletable). A non-repo
  // contentPath keeps the delete to the DB row only, so no GitHub file mock is needed.
  const terms: any[] = [{ id: 'term-1', catalogId: 'c', title: 'Fall 2026', startDate: null, endDate: null }];
  const sections: any[] = [{ id: 'sec-1', catalogId: 'c', termId: 'term-1', scheduleId: 'sched-used', title: 'Section A', attendanceEnabled: false }];
  const schedules: any[] = [
    { id: 'sched-used', catalogId: 'c', termId: 'term-1', title: 'Used Schedule', startDate: null, endDate: null, contentPath: 'https://example.com/used.md' },
    { id: 'sched-free', catalogId: 'c', termId: 'term-1', title: 'Free Schedule', startDate: null, endDate: null, contentPath: 'https://example.com/free.md' },
  ];
  const scheduleDeletes: string[] = [];

  await initAndOpenBasicCourse({ page });

  await page.route(/.*supabase.co\/rest\/v1\/term(\?.+)?/, async (route) => {
    await route.fulfill({ json: terms });
  });
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, async (route) => {
    await route.fulfill({ json: sections });
  });
  await page.route(/.*supabase.co\/rest\/v1\/schedule(\?.+)?/, async (route) => {
    if (route.request().method() === 'DELETE') {
      const id = idFromDeleteUrl(route.request().url());
      scheduleDeletes.push(id);
      const idx = schedules.findIndex((s) => s.id === id);
      if (idx >= 0) schedules.splice(idx, 1);
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ json: schedules });
  });
  await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fallback();
  });

  await page.getByRole('link', { name: 'Terms & Sections' }).click();
  await expect(page.getByRole('heading', { name: /Terms & Sections/, level: 2 })).toBeVisible();

  // The delete control is shown for both, but disabled (with a usage count) for the one a section uses.
  await expect(page.getByText('1 section', { exact: true })).toBeVisible();
  await expect(page.getByText('0 sections', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Delete schedule Used Schedule')).toBeDisabled();
  await expect(page.getByLabel('Delete schedule Free Schedule')).toBeEnabled();

  await page.getByLabel('Delete schedule Free Schedule').click();
  await page.locator('dialog:has-text("Delete schedule")').getByRole('button', { name: 'Delete', exact: true }).click();

  await expect.poll(() => scheduleDeletes).toContain('sched-free');
  await expect(page.getByLabel('Delete schedule Free Schedule')).toHaveCount(0);
});

test('terms & sections schedules panel View opens the selected schedule', async ({ page }) => {
  const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';
  await initAndOpenBasicCourse({ page });

  await page.route(/.*supabase.co\/rest\/v1\/term(\?.+)?/, (route) => route.fulfill({ json: [] }));
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, (route) => route.fulfill({ json: [] }));
  await page.route(/.*supabase.co\/rest\/v1\/schedule(\?.+)?/, (route) =>
    route.fulfill({ json: [{ id: 'sch-1', catalogId: COURSE_ID, termId: null, title: 'Winter 2026', state: 'published', startDate: null, endDate: null, contentPath: 'https://example.com/schedule/winter.md' }] }),
  );
  await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fallback();
  });

  await page.getByRole('link', { name: 'Terms & Sections' }).click();
  await expect(page.getByRole('heading', { name: /Terms & Sections/, level: 2 })).toBeVisible();

  // The Schedules panel lists the schedule with a View button (next to Copy).
  await expect(page.locator('input[value="Winter 2026"]')).toBeVisible();
  await page.getByRole('button', { name: 'View' }).click();

  // View records which schedule to open and navigates away from the structural view toward
  // the schedule route.
  await expect.poll(() => page.url()).not.toContain('/sections');
  const selected = await page.evaluate((id) => {
    const raw = localStorage.getItem(`uiSettings-${id}`);
    return raw ? JSON.parse(raw).selectedScheduleFile : null;
  }, COURSE_ID);
  expect(selected).toBe('sch-1');
});

test('terms & sections schedules panel copies a schedule and remaps dates to a first session date', async ({ page }) => {
  const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';
  const schedules: any[] = [
    { id: 'sch-1', catalogId: COURSE_ID, termId: null, title: 'Winter', state: 'published', startDate: null, endDate: null, contentPath: 'https://raw.githubusercontent.com/ghAccount/ghRepo/main/instruction/schedule/schedule.md' },
  ];
  const schedulePosts: any[] = [];
  const schedulePuts: Array<{ path: string; markdown: string }> = [];

  await initAndOpenBasicCourse({ page });

  await page.route(/.*supabase.co\/rest\/v1\/term(\?.+)?/, (route) => route.fulfill({ json: [] }));
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, (route) => route.fulfill({ json: [] }));
  await page.route(/.*supabase.co\/rest\/v1\/schedule(\?.+)?/, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const row = { id: 'sch-copy', ...(Array.isArray(body) ? body[0] : body) };
      schedulePosts.push(row);
      schedules.push(row);
      await route.fulfill({ status: 201, json: [row] });
      return;
    }
    await route.fulfill({ json: schedules });
  });
  await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fallback();
  });

  // The source schedule's content: a single dated row ("Thu Jan 8").
  await page.context().route(/https:\/\/raw\.githubusercontent\.com\/.*\/instruction\/schedule\/schedule\.md$/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: `| Week | Date | Module | Due | Topics Covered | Slides |\n| :--: | ---- | ------ | --- | -------------- | ------ |\n|  1   | Thu Jan 8 | Intro | | [Introduction](../instruction/introduction.md) | |\n` }),
  );
  // Capture the committed markdown for the new copied schedule file.
  await page.context().route(/https:\/\/api\.github\.com\/repos\/.*\/contents\/schedule\/.*\.md$/, async (route) => {
    const method = route.request().method();
    const repoPath = (route.request().url().match(/\/contents\/(schedule\/[^?]+)/) || [])[1] || '';
    if (method === 'GET') {
      await route.fulfill({ status: 200, json: { path: repoPath, sha: 'fake-sha', download_url: `https://raw.githubusercontent.com/ghAccount/ghRepo/main/${repoPath}`, type: 'file' } });
      return;
    }
    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      schedulePuts.push({ path: repoPath, markdown: Buffer.from(body.content, 'base64').toString('utf8') });
      await route.fulfill({ status: 201, json: { commit: { sha: 'copy-sha' } } });
      return;
    }
    await route.continue();
  });

  await page.getByRole('link', { name: 'Terms & Sections' }).click();
  await expect(page.getByRole('heading', { name: /Terms & Sections/, level: 2 })).toBeVisible();

  await page.getByLabel('Copy schedule Winter').click();
  const dialog = page.locator('dialog:has-text("Copy schedule")');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('First session date (optional)').fill('2026-01-15');
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click();

  // A new schedule row is created and the committed markdown has the first session shifted to Jan 15.
  await expect.poll(() => schedulePosts.length).toBeGreaterThan(0);
  await expect.poll(() => schedulePuts.some((p) => p.markdown.includes('Jan 15 2026'))).toBeTruthy();
});

test('creating a schedule then viewing it shows the content (snapshot advances past the new commit)', async ({ page }) => {
  // Regression: a newly committed schedule file is not in the session's pinned GitHub snapshot, so
  // viewing it used to 404 until a refresh. Creating must advance the snapshot to the new commit and
  // pre-seed its content, so an immediate View renders without a failed GitHub read.
  const COURSE_ID = '14602d77-0ff3-4267-b25e-4a7c3c47848b';
  const COMMIT_SHA = '1111111111111111111111111111111111111111';
  const schedules: any[] = [];

  await initAndOpenBasicCourse({ page });

  await page.route(/.*supabase.co\/rest\/v1\/term(\?.+)?/, (route) => route.fulfill({ json: [] }));
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, (route) => route.fulfill({ json: [] }));
  await page.route(/.*supabase.co\/rest\/v1\/schedule(\?.+)?/, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const row = { id: 'sch-new', termId: null, state: 'published', startDate: null, endDate: null, ...(Array.isArray(body) ? body[0] : body) };
      schedules.push(row);
      await route.fulfill({ status: 201, json: [row] });
      return;
    }
    await route.fulfill({ json: schedules });
  });
  await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fallback();
  });

  // The GitHub commit returns the new commit SHA; the snapshot should advance to it.
  await page.context().route(/https:\/\/api\.github\.com\/repos\/.*\/contents\/schedule\/.*\.md$/, async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 201, json: { commit: { sha: COMMIT_SHA } } });
      return;
    }
    await route.continue();
  });
  // The new file only exists at the new commit, so a raw read pinned to any other ref 404s (as it does
  // in production). With the fix the snapshot advances to COMMIT_SHA and the content is pre-seeded, so
  // the View either hits cache or reads the right commit; without it, the stale snapshot ref 404s.
  await page.context().route(/https:\/\/raw\.githubusercontent\.com\/.*\/schedule\/.*\.md$/, (route) => {
    if (route.request().url().includes(`/${COMMIT_SHA}/`)) {
      route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: `| Week | Date | Module | Due | Topics Covered | Slides |\n| :--: | ---- | ------ | --- | -------------- | ------ |\n|  1   |      |        |     |                |        |\n` });
    } else {
      route.fulfill({ status: 404, body: '404: Not Found' });
    }
  });

  await page.getByRole('link', { name: 'Terms & Sections' }).click();
  await expect(page.getByRole('heading', { name: /Terms & Sections/, level: 2 })).toBeVisible();

  await page.getByRole('button', { name: '+ New schedule' }).click();
  await page.getByPlaceholder('New schedule title').fill('Spring 2027');
  await page.getByRole('button', { name: 'Create schedule' }).click();

  // The new schedule appears; viewing it immediately renders its content. Before the fix the stale
  // snapshot resolved to a commit without this file, so the content read 404'd and nothing rendered.
  await page.getByLabel('View schedule Spring 2027').click();
  await expect(page.locator('.markdown-body').getByText('Topics Covered')).toBeVisible();
});

test('terms & sections is reachable from the course TOC and renders in the content pane', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.route(/.*supabase.co\/rest\/v1\/term(\?.+)?/, (route) => route.fulfill({ json: [] }));
  await page.route(/.*supabase.co\/rest\/v1\/section(\?.+)?/, (route) => route.fulfill({ json: [] }));
  await page.route(/.*supabase.co\/rest\/v1\/schedule(\?.+)?/, (route) => route.fulfill({ json: [] }));
  await page.route(/.*supabase.co\/rest\/v1\/enrollment(\?.+)?/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fallback();
  });

  // An editor sees the Terms & Sections entry in the sidebar (alongside Schedule/Attendance).
  const tocLink = page.getByRole('link', { name: 'Terms & Sections' });
  await expect(tocLink).toBeVisible();
  await tocLink.click();

  // It opens in the classroom content pane (not a separate full-screen view), so the course
  // sidebar stays visible next to it.
  await expect(page.getByRole('heading', { name: /Terms & Sections/, level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ New term' })).toBeVisible();
  await expect(tocLink).toBeVisible();
});

test('settings editing', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  await expect(page.getByRole('textbox', { name: 'Course Title' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage terms & sections' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Unpin content' })).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Enter course title' }).click();
  await page.getByRole('textbox', { name: 'Enter course title' }).fill('Rocket Sciencex');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Settings saved')).toBeVisible();
});

test('settings repair and state changes', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  const saveButton = page.getByRole('button', { name: 'Save changes' });
  await expect(saveButton).toBeDisabled();

  const courseTitleInput = page.getByRole('textbox', { name: 'Enter course title' });
  const currentTitle = await courseTitleInput.inputValue();
  await courseTitleInput.fill(`${currentTitle} ${Math.floor(Math.random() * 100000)}`);
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  await expect(page.getByText('Settings saved')).toBeVisible();
});

test('settings can repair course progress cache', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  await page.getByRole('button', { name: 'Repair progress cache' }).click();
  await expect(page.getByText(/Repaired progress cache for Rocket Science:/)).toBeVisible();
});

test('settings editor management requires at least one editor', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  await expect(page.getByText('2 editors assigned')).toBeVisible();
  await page.getByRole('button', { name: 'Manage editors' }).click();

  const manageEditorsDialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Manage editors' }) });
  await expect(manageEditorsDialog.getByRole('heading', { name: 'Manage editors' })).toBeVisible();

  const userSearch = manageEditorsDialog.getByPlaceholder('Search by name or email');

  await userSearch.fill('bu');
  const addedButtons = page.getByRole('button', { name: 'Added' });
  await expect(addedButtons).toHaveCount(2);
  await addedButtons.nth(0).click();
  await addedButtons.nth(0).click();

  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('At least one editor must be selected')).toBeVisible();
});

test('settings delete dialog can be opened and canceled', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByText('Settings').click();

  await page.getByRole('button', { name: 'Delete course' }).click();
  await expect(page.getByRole('heading', { name: '⚠️ Delete course' })).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: '⚠️ Delete course' })).not.toBeVisible();
});

test('editor toolbar and files panel actions', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();

  await page.getByRole('button', { name: 'testImage.png image • 16.0 KB' }).click();
  await page.getByRole('button', { name: 'Insert' }).click();
  await expect(page.getByRole('button', { name: 'Insert' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('button', { name: 'testImage.png image • 16.0 KB' })).not.toBeVisible();

  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Image', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Word Wrap: On' }).click();
  await expect(page.getByRole('button', { name: 'Word Wrap: Off' })).toBeVisible();
});

test('editor changed lines markers can be toggled', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();

  await expect(page.getByRole('textbox', { name: 'Editor content' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Changed Lines: On' })).toBeVisible();

  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeEnabled();

  await expect.poll(async () => await page.evaluate(() => document.querySelectorAll('.mls-line-changed-gutter').length)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Changed Lines: On' }).click();
  await expect(page.getByRole('button', { name: 'Changed Lines: Off' })).toBeVisible();

  await expect.poll(async () => await page.evaluate(() => document.querySelectorAll('.mls-line-changed-gutter').length)).toBe(0);
});

test('topic drag reorder stays in dropped position while save is pending', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  let delayedUpdateStarted = false;
  let delayedUpdateFinished = false;

  await page.context().route('https://api.github.com/**/contents/course.json', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }

    delayedUpdateStarted = true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    delayedUpdateFinished = true;
    await route.fulfill({ status: 201, json: { commit: { sha: 'delayed-reorder-commit' } } });
  });

  await page.locator('.absolute.left-0\\.5').click();
  await expect(page.getByRole('link', { name: 'topic 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'exam' })).toBeVisible();

  const dragHandles = page.locator('[title="Drag to reorder"]');
  await expect(dragHandles).toHaveCount(3);

  const source = dragHandles.nth(2);
  const target = dragHandles.nth(1);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error('Unable to resolve drag handle bounds for reorder test.');
  }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => delayedUpdateStarted).toBeTruthy();

  // Regression check: while persistence is still pending, the dropped order should already be reflected.
  const pendingCheckDeadline = Date.now() + 1000;
  while (!delayedUpdateFinished && Date.now() < pendingCheckDeadline) {
    const examBox = await page.getByRole('link', { name: 'exam' }).boundingBox();
    const topic1Box = await page.getByRole('link', { name: 'topic 1' }).boundingBox();
    expect(examBox && topic1Box && examBox.y < topic1Box.y).toBeTruthy();
    await page.waitForTimeout(100);
  }

  await expect.poll(() => delayedUpdateFinished).toBeTruthy();
});

test('editor link insertion uses topic dialog with search', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();

  await page.getByRole('button', { name: 'Link' }).click();
  await expect(page.getByRole('heading', { name: 'Insert topic link' })).toBeVisible();

  const searchInput = page.getByPlaceholder('Search topics by title, description, or path');
  await searchInput.fill('topic 2');
  await page
    .getByRole('button', { name: /^topic 2/i })
    .first()
    .click();
  await page.getByRole('button', { name: 'Insert link' }).click();

  await expect(page.getByRole('heading', { name: 'Insert topic link' })).not.toBeVisible();

  // The current topic is Home (README.md at the repo root), so a link to topic 2
  // (something/more/topic2.md) is inserted as a portable relative path, not an absolute
  // /course/:id/topic/:id link.
  const insertedMarkdown = await page.evaluate(() => {
    const monaco = (window as any).monaco;
    const models = monaco?.editor?.getModels?.() || [];
    const matchingModel = models.find((model: any) => String(model.getValue()).includes('[topic 2](something/more/topic2.md)'));
    return matchingModel ? String(matchingModel.getValue()) : '';
  });

  expect(insertedMarkdown).toContain('[topic 2](something/more/topic2.md)');
});

test('editor can insert AI generated quiz markdown', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.context().route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (route.request().method() === 'POST') {
      await route.fulfill({
        json: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```masteryls\n{"id":"", "title":"AI Quiz", "type":"multiple-choice"}\nWhat is 2 + 2?\n\n- [ ] 3\n- [x] 4\n- [ ] 5\n- [ ] 22\n```',
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          modelVersion: 'gemini-2.5-flash',
          responseId: 'ai-quiz-test-response',
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByTitle('AI generated quiz').click();

  await page.getByPlaceholder('subject').fill('basic arithmetic');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();

  const editorCode = page.getByRole('code');
  await expect(editorCode).toContainText('"title":"AI Quiz"');
  await expect(editorCode).toContainText('What is 2 + 2?');
  await expect(editorCode).toContainText('- [x] 4');

  const insertedMarkdown = await page.evaluate(() => {
    const monaco = (window as any).monaco;
    const models = monaco?.editor?.getModels?.() || [];
    const matchingModel = models.find((model: any) => String(model.getValue()).includes('AI Quiz'));
    return matchingModel ? String(matchingModel.getValue()) : '';
  });

  expect(insertedMarkdown).toContain('```masteryls');
  expect(/```masteryls[\s\S]*```/.test(insertedMarkdown)).toBeTruthy();
});

test('editor can insert likert interaction markdown', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByTitle('Likert Interaction').click();

  const insertedMarkdown = await page.evaluate(() => {
    const monaco = (window as any).monaco;
    const models = monaco?.editor?.getModels?.() || [];
    const matchingModel = models.find((model: any) => String(model.getValue()).includes('"type":"likert"'));
    return matchingModel ? String(matchingModel.getValue()) : '';
  });

  expect(insertedMarkdown).toContain('"type":"likert"');
  expect(insertedMarkdown).toContain('Scale: Strongly disagree | Disagree | Neutral | Agree | Strongly agree');
  expect(insertedMarkdown).toContain('| qid | item |');
});

test('editor can modify selected markdown with AI', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  let promptPayload = '';
  await page.context().route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (route.request().method() === 'POST') {
      promptPayload = route.request().postData() || '';
      await route.fulfill({
        json: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Improved markdown!',
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          modelVersion: 'gemini-2.5-flash',
          responseId: 'ai-selection-modify-test-response',
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.locator('.absolute.left-0\\.5').click();
  await expect(page.getByRole('code')).toContainText('markdown!');

  const selectedMarkdown = await page.evaluate(() => {
    const monaco = (window as any).monaco;
    const editors = monaco?.editor?.getEditors?.() || [];
    const editor = editors.find((candidate: any) => String(candidate.getModel?.()?.getValue()).includes('# Home'));
    if (!editor) {
      throw new Error('Unable to find Monaco editor.');
    }

    editor.setValue('# Home\n\nmarkdown!\n\nunchanged');
    editor.setSelection(new monaco.Selection(3, 1, 3, 'markdown!'.length + 1));
    editor.focus();
    return editor.getModel().getValueInRange(editor.getSelection());
  });
  expect(selectedMarkdown).toBe('markdown!');

  await page.getByTitle('AI modify selected markdown').click();
  await expect(page.getByRole('heading', { name: 'Modify selection' })).toBeVisible();
  await page.getByPlaceholder('e.g., make this clearer and add one concise example').fill('make the selected sentence clearer');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();

  const getUpdatedMarkdown = async () =>
    page.evaluate(() => {
      const monaco = (window as any).monaco;
      const models = monaco?.editor?.getModels?.() || [];
      const matchingModel = models.find((model: any) => String(model.getValue()).includes('Improved markdown!'));
      return matchingModel ? String(matchingModel.getValue()) : '';
    });

  await expect.poll(getUpdatedMarkdown).toContain('Improved markdown!');
  const updatedMarkdown = await getUpdatedMarkdown();

  expect(updatedMarkdown).toBe('# Home\n\nImproved markdown!\n\nunchanged');
  expect(promptPayload).toContain('Selected markdown to revise');
  expect(promptPayload).toContain('markdown!');
  expect(promptPayload).toContain('make the selected sentence clearer');
});

test('editor can generate preview and insert an AI image', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  const generatedImageFile = {
    name: 'ai-event-loop-queues.png',
    path: 'ai-event-loop-queues.png',
    sha: 'generated-image-sha',
    size: 68,
    url: 'https://api.github.com/repos/ghAccount/ghRepo/contents/ai-event-loop-queues.png?ref=main',
    html_url: 'https://github.com/ghAccount/ghRepo/blob/main/ai-event-loop-queues.png',
    git_url: 'https://api.github.com/repos/ghAccount/ghRepo/git/blobs/generated-image-sha',
    download_url: 'https://raw.githubusercontent.com/ghAccount/ghRepo/main/ai-event-loop-queues.png',
    type: 'file',
  };
  const transparentPng1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5fNzsAAAAASUVORK5CYII=';
  let geminiPromptPayload = '';
  let uploadedImageContent = '';
  let imageUploaded = false;
  let rawPreviewRequests = 0;

  await page.context().route(/.*supabase.co\/functions\/v1\/gemini(\?.+)?/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (route.request().method() === 'POST') {
      geminiPromptPayload = route.request().postData() || '';
      await route.fulfill({
        json: {
          candidates: [
            {
              content: {
                parts: [{ text: 'Generated image ready.' }, { inlineData: { mimeType: 'image/png', data: transparentPng1x1 } }],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          modelVersion: 'gemini-3-pro-image-preview',
          responseId: 'ai-image-test-response',
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.context().route(/https:\/\/api\.github\.com\/.*\/contents(\?.+)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      const files = imageUploaded ? [generatedImageFile] : [];
      await route.fulfill({
        json: [
          {
            name: 'README.md',
            path: 'README.md',
            sha: 'cd54f565190cb64e5b8fb63d05df57b975997385',
            size: 2691,
            url: 'https://api.github.com/repos/ghAccount/ghRepo/contents/README.md?ref=main',
            html_url: 'https://github.com/ghAccount/ghRepo/blob/main/README.md',
            git_url: 'https://api.github.com/repos/ghAccount/ghRepo/git/blobs/cd54f565190cb64e5b8fb63d05df57b975997385',
            download_url: 'https://raw.githubusercontent.com/ghAccount/ghRepo/main/README.md',
            type: 'file',
          },
          ...files,
        ],
      });
      return;
    }

    await route.fallback();
  });

  await page.context().route('https://api.github.com/**/contents/ai-event-loop-queues.png', async (route) => {
    if (route.request().method() === 'PUT') {
      const postData = route.request().postDataJSON();
      uploadedImageContent = postData.content;
      imageUploaded = true;
      await route.fulfill({ status: 201, json: { commit: { sha: 'generated-image-commit-sha' } } });
      return;
    }

    await route.fulfill({ status: 404, json: { message: 'Not Found' } });
  });

  await page.context().route('https://raw.githubusercontent.com/**/ai-event-loop-queues.png*', async (route) => {
    rawPreviewRequests += 1;
    await route.fulfill({ status: 404, body: 'Not Found' });
  });

  await page.locator('.absolute.left-0\\.5').click();

  await page.getByText('# Home').click();
  await page.getByRole('textbox', { name: 'Editor content' }).press('End');
  await page.getByTitle('AI generated image').click();
  await page.getByPlaceholder('e.g., a clear diagram of the event loop moving tasks between queues').fill('Event loop queues');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Generated image' })).toBeVisible();
  await expect(page.getByAltText('Image preview')).toBeVisible();
  await page.getByRole('button', { name: 'Use image' }).click();

  await expect.poll(() => imageUploaded).toBeTruthy();
  expect(geminiPromptPayload).toContain('Event loop queues');
  expect(uploadedImageContent).toBe(transparentPng1x1);

  const getUpdatedMarkdown = async () =>
    page.evaluate(() => {
      const monaco = (window as any).monaco;
      const models = monaco?.editor?.getModels?.() || [];
      const matchingModel = models.find((model: any) => String(model.getValue()).includes('![ai-event-loop-queues.png](ai-event-loop-queues.png)'));
      return matchingModel ? String(matchingModel.getValue()) : '';
    });

  await expect.poll(getUpdatedMarkdown).toContain('![ai-event-loop-queues.png](ai-event-loop-queues.png)');
  await expect(page.getByRole('img', { name: 'ai-event-loop-queues.png' })).toHaveAttribute('src', /^blob:/);
  const updatedMarkdown = await getUpdatedMarkdown();
  expect(updatedMarkdown).toContain('![ai-event-loop-queues.png](ai-event-loop-queues.png)');
  expect(rawPreviewRequests).toBe(0);
});

test('editor commits can be shown with diff and apply actions', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByRole('button', { name: 'Show Commits' }).click();

  await expect(page.getByText('Initial topic commit')).toBeVisible();
  await expect(page.getByText('Improve topic wording')).toBeVisible();

  await page.getByRole('button', { name: 'Diff' }).first().click();
  await expect(page.getByRole('button', { name: 'Diff' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Apply' }).first().click();
  await expect(page.getByRole('button', { name: 'Discard' })).toBeEnabled();

  await page.getByRole('button', { name: 'Hide Commits' }).click();
  await expect(page.getByText('Initial topic commit')).not.toBeVisible();
});

test('latest commit gets a Diff button once the topic has unsaved changes', async ({ page }) => {
  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await expect(page.getByRole('code')).toContainText('# Home');
  await page.getByRole('button', { name: 'Show Commits' }).click();

  await expect(page.getByText('Initial topic commit')).toBeVisible();

  // While the editor is clean, only the past commit offers a Diff; the latest (loaded) commit
  // has no Diff button.
  await expect(page.getByRole('button', { name: 'Diff' })).toHaveCount(1);

  // Make an edit so the topic is dirty.
  await setMonacoModelValue(page, '# Home', '# Home\n\nEdited body!');
  await expect(page.getByRole('button', { name: 'Discard' })).toBeEnabled();

  // Now the latest commit also offers a Diff (working changes vs the latest commit), so there
  // are two Diff buttons, and diffing against it opens the diff view.
  await expect(page.getByRole('button', { name: 'Diff' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Diff' }).first().click();
  await expect(page.locator('.monaco-diff-editor')).toBeVisible();
});

test('closing a commit diff does not crash the editor', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await initAndOpenBasicCourse({ page });

  await page.locator('.absolute.left-0\\.5').click();
  await page.getByRole('button', { name: 'Show Commits' }).click();

  // Open the diff view against a past commit (swaps the plain editor for a Monaco
  // DiffEditor), wait for the diff editor to actually mount (so editorRef holds a real
  // diff-editor instance, which has no getValue()), then immediately close it again
  // (swaps back to the plain editor). Monaco creates the replacement instance
  // asynchronously, so closing right after the diff editor mounts reliably hits the
  // window where this previously crashed with "getValue is not a function".
  await page.getByRole('button', { name: 'Diff' }).first().click();
  await expect(page.locator('.monaco-diff-editor')).toBeVisible();
  await page.getByRole('button', { name: 'Diff' }).first().click();

  await expect(page.locator('.monaco-diff-editor')).not.toBeVisible();
  await expect(page.getByText('markdown!').first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});
