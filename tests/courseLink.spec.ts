import { test, expect } from './fixtures';
import { initBasicCourse, navigateToDashboard } from './testInit';

async function openCourseLinking(page: any) {
  await page.getByRole('button', { name: 'User Menu' }).click();
  await page.getByRole('button', { name: 'Link course', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Link a Course' })).toBeVisible();
}

async function mockLinkRequests(page: any) {
  let nextModuleId = 1000;
  let nextPageId = 5000;
  let nextQuizId = 7000;
  let nextAssignmentId = 9000;
  const requestLog = {
    create: { pages: 0, quizzes: 0, assignments: 0 },
    update: { pages: 0, quizzes: 0, assignments: 0 },
    moduleItems: { Page: 0, Quiz: 0, Assignment: 0 },
    dueAt: {
      createQuiz: [] as string[],
      createAssignment: [] as string[],
      updateQuiz: [] as string[],
      updateAssignment: [] as string[],
    },
  };

  // verifyGitHubAccount() checks this endpoint before linking.
  await page.route('https://api.github.com/user', async (route: any) => {
    await route.fulfill({ status: 200, json: { login: 'mock-user' } });
  });

  // Canvas API is invoked via Supabase Edge Function.
  await page.route(/.*supabase.co\/functions\/v1\/canvas(\?.+)?/, async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (route.request().method() !== 'POST') {
      throw new Error(`Unmocked canvas endpoint requested: ${route.request().url()} ${route.request().method()}`);
    }

    const body = await route.request().postDataJSON();
    const endpoint = body?.endpoint as string;
    const method = body?.method as string;

    if (method === 'POST' && endpoint?.match(/^\/courses\/\d+\/modules$/)) {
      nextModuleId += 1;
      await route.fulfill({ status: 200, json: { id: nextModuleId } });
      return;
    }

    if (method === 'POST' && endpoint?.match(/^\/courses\/\d+\/pages$/)) {
      nextPageId += 1;
      requestLog.create.pages += 1;
      await route.fulfill({ status: 200, json: { page_id: nextPageId, url: `page-${nextPageId}`, title: `Page ${nextPageId}` } });
      return;
    }

    if (method === 'POST' && endpoint?.match(/^\/courses\/\d+\/quizzes$/)) {
      nextQuizId += 1;
      requestLog.create.quizzes += 1;
      if (body?.body?.quiz?.due_at) {
        requestLog.dueAt.createQuiz.push(body.body.quiz.due_at);
      }
      await route.fulfill({ status: 200, json: { id: nextQuizId, title: `Quiz ${nextQuizId}` } });
      return;
    }

    if (method === 'POST' && endpoint?.match(/^\/courses\/\d+\/assignments$/)) {
      nextAssignmentId += 1;
      requestLog.create.assignments += 1;
      if (body?.body?.assignment?.due_at) {
        requestLog.dueAt.createAssignment.push(body.body.assignment.due_at);
      }
      await route.fulfill({ status: 200, json: { id: nextAssignmentId, name: `Assignment ${nextAssignmentId}` } });
      return;
    }

    if (method === 'POST' && endpoint?.match(/^\/courses\/\d+\/modules\/\d+\/items$/)) {
      const moduleItemType = body?.body?.module_item?.type;
      if (moduleItemType && Object.prototype.hasOwnProperty.call(requestLog.moduleItems, moduleItemType)) {
        requestLog.moduleItems[moduleItemType as keyof typeof requestLog.moduleItems] += 1;
      }
      await route.fulfill({ status: 200, json: { id: 1 } });
      return;
    }

    if (method === 'PUT' && endpoint?.match(/^\/courses\/\d+\/modules\/\d+$/)) {
      await route.fulfill({ status: 200, json: { id: 1, published: true } });
      return;
    }

    if (method === 'PUT' && endpoint?.match(/^\/courses\/\d+\/pages\/\d+$/)) {
      requestLog.update.pages += 1;
      await route.fulfill({ status: 200, json: { id: 1, published: true } });
      return;
    }

    if (method === 'PUT' && endpoint?.match(/^\/courses\/\d+\/quizzes\/\d+$/)) {
      requestLog.update.quizzes += 1;
      if (body?.body?.quiz?.due_at) {
        requestLog.dueAt.updateQuiz.push(body.body.quiz.due_at);
      }
      await route.fulfill({ status: 200, json: { id: 1, published: true } });
      return;
    }

    if (method === 'PUT' && endpoint?.match(/^\/courses\/\d+\/assignments\/\d+$/)) {
      requestLog.update.assignments += 1;
      if (body?.body?.assignment?.due_at) {
        requestLog.dueAt.updateAssignment.push(body.body.assignment.due_at);
      }
      await route.fulfill({ status: 200, json: { id: 1, published: true } });
      return;
    }

    throw new Error(`Unhandled canvas invoke payload: ${JSON.stringify(body)}`);
  });

  return requestLog;
}

test('course link form renders and validates required fields', async ({ page }) => {
  await initBasicCourse({ page });

  await navigateToDashboard(page);
  await openCourseLinking(page);

  const linkButton = page.getByRole('button', { name: 'Link course', exact: true });
  const unlinkButton = page.getByRole('button', { name: 'Unlink course' });
  const repairButton = page.getByRole('button', { name: 'Repair' });
  const viewCanvasButton = page.getByRole('button', { name: 'View Canvas' });
  const viewCourseButton = page.getByRole('button', { name: 'View Course' });

  await expect(linkButton).toBeDisabled();
  await expect(unlinkButton).toBeDisabled();
  await expect(repairButton).toBeDisabled();
  await expect(viewCanvasButton).toBeDisabled();
  await expect(viewCourseButton).toBeDisabled();

  await page.getByLabel('Course', { exact: true }).selectOption('14602d77-0ff3-4267-b25e-4a7c3c47848b');
  await page.waitForTimeout(300);
  await page.getByLabel('Canvas course ID', { exact: true }).fill('12345');
  await expect(page.getByLabel('Schedule for due dates', { exact: true })).toBeVisible();

  await expect(page.getByLabel('Course', { exact: true })).toHaveValue('14602d77-0ff3-4267-b25e-4a7c3c47848b');
  await expect(page.getByLabel('Canvas course ID', { exact: true })).toHaveValue('12345');
});

test('course link performs successful link flow', async ({ page }) => {
  await initBasicCourse({ page });
  await mockLinkRequests(page);

  await navigateToDashboard(page);
  await openCourseLinking(page);

  await page.getByLabel('Course', { exact: true }).selectOption('14602d77-0ff3-4267-b25e-4a7c3c47848b');
  await page.waitForTimeout(300);
  await page.getByLabel('Canvas course ID', { exact: true }).fill('12345');
  await expect(page.getByRole('button', { name: 'Link course', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Link course', exact: true }).click();

  await expect(page.locator('#root')).toContainText('Rocket Science linked successfully');
});

test('course link preselects saved schedule from course external refs', async ({ page }) => {
  await initBasicCourse({
    page,
    courseJsonOverride: {
      externalRefs: {
        canvasCourseId: '12345',
        canvasScheduleFileId: 'alt-schedule',
      },
      schedule: {
        id: 'a7db85a9-da40-4623-bce2-b99162b416f9',
        files: [
          { id: 'default', title: 'Default Schedule', path: 'schedule/schedule.md', default: true, state: 'published' },
          { id: 'alt-schedule', title: 'Alt Schedule', path: 'schedule/alt-schedule.md', default: false, state: 'published' },
        ],
      },
    },
  });

  await navigateToDashboard(page);
  await openCourseLinking(page);

  await page.getByLabel('Course', { exact: true }).selectOption('14602d77-0ff3-4267-b25e-4a7c3c47848b');
  await page.waitForTimeout(300);
  await expect(page.getByLabel('Canvas course ID', { exact: true })).toHaveValue('12345');
  await expect(page.getByLabel('Schedule for due dates', { exact: true })).toHaveValue('alt-schedule');
});

test('course link maps topic types to page, quiz, and assignment endpoints', async ({ page }) => {
  await initBasicCourse({
    page,
    courseJsonOverride: {
      modules: [
        {
          title: 'Type Coverage',
          topics: [
            { id: 'a1', title: 'Instruction Topic', type: 'instruction', path: 'instruction/instruction-topic/instruction-topic.md' },
            { id: 'a2', title: 'Exam Topic', type: 'exam', path: 'instruction/exam-topic/exam-topic.md' },
            { id: 'a3', title: 'Project Topic', type: 'project', path: 'instruction/project-topic/project-topic.md' },
            { id: 'a4', title: 'Embedded Topic', type: 'embedded', path: 'https://www.youtube.com/embed/HXNx_Gp0jyM' },
          ],
        },
      ],
    },
  });
  const requestLog = await mockLinkRequests(page);

  await navigateToDashboard(page);
  await openCourseLinking(page);

  await page.getByLabel('Course', { exact: true }).selectOption('14602d77-0ff3-4267-b25e-4a7c3c47848b');
  await page.waitForTimeout(300);
  await page.getByLabel('Canvas course ID', { exact: true }).fill('12345');
  await page.getByRole('button', { name: 'Link course', exact: true }).click();

  await expect(page.locator('#root')).toContainText('Rocket Science linked successfully');
  await expect.poll(() => requestLog.create.pages).toBe(2);
  await expect.poll(() => requestLog.create.quizzes).toBe(1);
  await expect.poll(() => requestLog.create.assignments).toBe(1);
  await expect.poll(() => requestLog.update.pages).toBe(2);
  await expect.poll(() => requestLog.update.quizzes).toBe(1);
  await expect.poll(() => requestLog.update.assignments).toBe(1);
  await expect.poll(() => requestLog.moduleItems.Page).toBe(2);
  await expect.poll(() => requestLog.moduleItems.Quiz).toBe(1);
  await expect.poll(() => requestLog.moduleItems.Assignment).toBe(1);
});

test('course link applies schedule due dates to exam quizzes and project assignments', async ({ page }) => {
  await initBasicCourse({
    page,
    topicMarkdown: `# Spring 2027 Schedule

| Week | Date | Module | Due | Topics Covered | Slides |
| :--: | ---- | ------ | --- | -------------- | ------ |
| 1 | Jan 10 2027 | Type Coverage | [Exam Topic](../instruction/exam-topic/exam-topic.md) | | |
| 1 | Jan 12 2027 | Type Coverage | [Project Topic](../instruction/project-topic/project-topic.md) | | |
`,
    courseJsonOverride: {
      modules: [
        {
          title: 'Type Coverage',
          topics: [
            { id: 'a2', title: 'Exam Topic', type: 'exam', path: 'instruction/exam-topic/exam-topic.md' },
            { id: 'a3', title: 'Project Topic', type: 'project', path: 'instruction/project-topic/project-topic.md' },
          ],
        },
      ],
    },
  });
  const requestLog = await mockLinkRequests(page);

  await navigateToDashboard(page);
  await openCourseLinking(page);

  await page.getByLabel('Course', { exact: true }).selectOption('14602d77-0ff3-4267-b25e-4a7c3c47848b');
  await page.waitForTimeout(300);
  await page.getByLabel('Canvas course ID', { exact: true }).fill('12345');
  await page.getByRole('button', { name: 'Link course', exact: true }).click();

  await expect(page.locator('#root')).toContainText('Rocket Science linked successfully');
  await expect.poll(() => requestLog.dueAt.createQuiz.length).toBeGreaterThan(0);
  await expect.poll(() => requestLog.dueAt.createAssignment.length).toBeGreaterThan(0);
  await expect.poll(() => requestLog.dueAt.updateQuiz.length).toBeGreaterThan(0);
  await expect.poll(() => requestLog.dueAt.updateAssignment.length).toBeGreaterThan(0);
});
