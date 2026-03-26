import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWeeks, parseCellItems, parseScheduleMarkdown, serializeScheduleMarkdown } from './scheduleMarkdown.js';

test('parseScheduleMarkdown extracts title links table and special days', () => {
  const md = `# Winter 2026 Schedule

[BYU Academic Calendar](https://academiccalendar.byu.edu/)

| Week | Date       | Module  | Due                                         | Topics Covered                                                                 | Slides                     |
| :--: | ---------- | ------- | ------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------- |
|  1   | Thu Jan 8  | Intro   | ☑ [Startup](../instruction/startup.md)      | [Introduction](../instruction/introduction.md)</br>☑ Read syllabus            | [Deck](https://slides.com) |
|  2   | Thu Jan 15 | Service |                                             | [HTTP](../instruction/http.md)                                                 |                            |

## Special days

- Jan 7: First day of class
- Apr 15: Last day of class
`;

  const model = parseScheduleMarkdown(md);

  assert.equal(model.docTitle, 'Winter 2026 Schedule');
  assert.equal(model.links.length, 1);
  assert.equal(model.links[0].label, 'BYU Academic Calendar');
  assert.equal(model.weeks.length, 2);
  assert.equal(model.weeks[0].week, 1);
  assert.equal(model.weeks[0].dueItems[0].checked, true);
  assert.equal(model.weeks[0].dueItems[0].text, 'Startup');
  assert.equal(model.weeks[0].topicsCovered[1].checked, true);
  assert.equal(model.specialDays.length, 2);
  assert.equal(model.specialDays[0].dateText, 'Jan 7');
  assert.equal(model.specialDays[0].label, 'First day of class');
});

test('serializeScheduleMarkdown round-trips core schedule structure', () => {
  const source = {
    docTitle: 'Winter 2027 Schedule',
    links: [{ id: 'l1', label: 'Calendar', url: 'https://example.com/calendar' }],
    weeks: [
      {
        id: 'w1',
        week: 1,
        date: 'Tue Jan 5',
        module: 'Intro',
        dueItems: [{ id: 'd1', text: 'Project Setup', href: '../instruction/setup.md', checked: true }],
        topicsCovered: [{ id: 't1', text: 'Welcome', href: '../instruction/welcome.md', checked: false }],
        slides: [{ id: 's1', text: 'Kickoff', href: 'https://slides.example.com', checked: false }],
      },
    ],
    specialDays: [{ id: 'sd1', dateText: 'Jan 1', label: 'Holiday', notes: '' }],
  };

  const markdown = serializeScheduleMarkdown(source);
  const parsed = parseScheduleMarkdown(markdown);

  assert.equal(parsed.docTitle, source.docTitle);
  assert.equal(parsed.links[0].label, 'Calendar');
  assert.equal(parsed.weeks.length, 1);
  assert.equal(parsed.weeks[0].week, 1);
  assert.equal(parsed.weeks[0].dueItems[0].checked, true);
  assert.equal(parsed.weeks[0].dueItems[0].href, '../instruction/setup.md');
  assert.equal(parsed.specialDays[0].dateText, 'Jan 1');
});

test('parseCellItems supports checked and link syntaxes', () => {
  const cell = '☑ [A](../a.md)</br>- [x] [B](../b.md)</br>Plain note';
  const items = parseCellItems(cell);

  assert.equal(items.length, 3);
  assert.equal(items[0].checked, true);
  assert.equal(items[0].text, 'A');
  assert.equal(items[1].checked, true);
  assert.equal(items[1].href, '../b.md');
  assert.equal(items[2].text, 'Plain note');
  assert.equal(items[2].href, '');
});

test('buildWeeks creates sequential empty week rows', () => {
  const weeks = buildWeeks(3);

  assert.equal(weeks.length, 3);
  assert.deepEqual(
    weeks.map((w) => w.week),
    [1, 2, 3],
  );
  assert.equal(weeks[0].dueItems.length, 0);
  assert.equal(weeks[0].topicsCovered.length, 0);
  assert.equal(weeks[0].slides.length, 0);
});
