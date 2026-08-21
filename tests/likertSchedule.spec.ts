import { test, expect } from './fixtures';
import { initBasicCourse, navigateToCourse } from './testInit';

const LIKERT_ID = 'a1b2c3d4-e5f6-7890-1234-5678901234c0';

const likertMarkdown = `
# Session feedback

\`\`\`masteryls
{"id":"${LIKERT_ID}", "title":"Session Feedback", "type":"likert", "showResults":"always"}
Rate the session.

Scale: Disagree | Neutral | Agree

| qid | item |
|-----|------|
| q1 | I found the session useful. |
\`\`\`
`;

// Only the likert-summary queries (they filter by interactionId); ignore topic/notes progress GETs.
function likertProgressGets(urls: string[]) {
  return urls.filter((u) => new RegExp(`interactionId=eq.${LIKERT_ID}`).test(u));
}

test('likert results default to the schedule period and can toggle to all time', async ({ page }) => {
  const progressGets: string[] = [];
  page.on('request', (req) => {
    const u = req.url();
    if (req.method() === 'GET' && /rest\/v1\/progress/.test(u)) progressGets.push(u);
  });

  await initBasicCourse({
    page,
    topicMarkdown: likertMarkdown,
    courseJsonOverride: {
      schedule: {
        id: 'a7db85a9-da40-4623-bce2-b99162b416f9',
        files: [{ id: 'default', title: 'Fall 2026', path: 'schedule/schedule.md', default: true, state: 'published', startDate: '2026-01-10', endDate: '2026-05-01' }],
      },
    },
  });
  await navigateToCourse(page);
  await page.getByText('topic 1').click();

  const widget = page.locator(`[data-plugin-masteryls-id="${LIKERT_ID}"]`);
  await widget.getByText('Results', { exact: true }).click();

  const periodSelect = widget.locator('select');
  await expect(periodSelect).toBeVisible();
  // Defaults to the schedule file's period, and offers an "All time" escape hatch.
  await expect(periodSelect).toHaveValue('default');
  await expect(widget.getByRole('option', { name: 'Fall 2026' })).toHaveCount(1);
  await expect(widget.getByRole('option', { name: 'All time' })).toHaveCount(1);

  // The default (schedule-period) query is scoped by createdAt bounds.
  await expect.poll(() => likertProgressGets(progressGets).length).toBeGreaterThan(0);
  const scoped = likertProgressGets(progressGets).at(-1)!;
  expect(scoped).toContain('createdAt=gte.');
  expect(scoped).toContain('createdAt=lte.');

  // Switching to "All time" re-queries without any date bounds.
  const before = likertProgressGets(progressGets).length;
  await periodSelect.selectOption('all');
  await expect.poll(() => likertProgressGets(progressGets).length).toBeGreaterThan(before);
  const unscoped = likertProgressGets(progressGets).at(-1)!;
  expect(unscoped).not.toContain('createdAt=');
});

test('likert results show no period selector when the schedule has no start/end dates', async ({ page }) => {
  await initBasicCourse({ page, topicMarkdown: likertMarkdown });
  await navigateToCourse(page);
  await page.getByText('topic 1').click();

  const widget = page.locator(`[data-plugin-masteryls-id="${LIKERT_ID}"]`);
  await widget.getByText('Results', { exact: true }).click();

  await expect(widget.getByRole('button', { name: 'Refresh' })).toBeVisible();
  await expect(widget.locator('select')).toHaveCount(0);
});
