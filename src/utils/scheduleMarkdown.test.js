import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWeeks, parseCellItems, parseScheduleMarkdown, serializeScheduleMarkdown, SCHEDULE_WARNING } from './scheduleMarkdown.js';

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

test('parseScheduleMarkdown supports header aliases and normalizes to canonical fields', () => {
  const md = `# Alias Header Schedule

| Week | Date | Module | Assignments Due | Topics | Slides |
| :--: | ---- | ------ | --------------- | ------ | ------ |
| 1 | Jan 1 | Intro | [A](../a.md) | [B](../b.md) | |

## Special days

- Jan 1: Start
`;

  const parsed = parseScheduleMarkdown(md);
  assert.equal(parsed.weeks.length, 1);
  assert.equal(parsed.weeks[0].dueItems[0].href, '../a.md');
  assert.equal(parsed.weeks[0].topicsCovered[0].href, '../b.md');
});

test('parseScheduleMarkdown emits warnings and preserves optional tail content', () => {
  const md = `No title line here
This line is not a link

| Week | Date | Module | Due | Topics Covered | Slides |
| :--: | ---- | ------ | --- | -------------- | ------ |
| 1 | Jan 1 | Intro | [A](../a.md) | [B](../b.md) | |

## Special days

non-bullet special line
- Jan 1: Start

## Appendix

Extra trailing notes
`;

  const parsed = parseScheduleMarkdown(md);
  const warningCodes = parsed.warnings.map((w) => w.code);

  assert.ok(warningCodes.includes(SCHEDULE_WARNING.MISSING_TITLE));
  assert.ok(warningCodes.includes(SCHEDULE_WARNING.UNMAPPED_PRETABLE_LINE));
  assert.ok(warningCodes.includes(SCHEDULE_WARNING.NON_BULLET_SPECIAL_DAYS_LINE));
  assert.ok(parsed.optionalTail.content.includes('Extra trailing notes'));
});

test('parseScheduleMarkdown strict mode throws on malformed table row width', () => {
  const md = `# Broken Table

| Week | Date | Module | Due | Topics Covered | Slides |
| :--: | ---- | ------ | --- | -------------- | ------ |
| 1 | Jan 1 | Intro | [A](../a.md) |
`;

  assert.throws(() => parseScheduleMarkdown(md, { strict: true }), /Malformed schedule table row/);
});

test('serializeScheduleMarkdown appends optionalTail content and normalizes spacing', () => {
  const markdown = serializeScheduleMarkdown({
    docTitle: 'Tail Test',
    links: [],
    weeks: buildWeeks(1),
    specialDays: [],
    optionalTail: { content: '## Appendix\n\nNotes here' },
  });

  assert.ok(!markdown.includes('## Special days'));
  assert.ok(markdown.includes('## Appendix'));
  assert.ok(markdown.endsWith('\n'));
});

test('week numbers are derived by order when parsing and serializing', () => {
  const md = `# Week Number Test

| Week | Date | Module | Due | Topics Covered | Slides |
| :--: | ---- | ------ | --- | -------------- | ------ |
| 99 | Jan 1 | Intro |  |  |  |
| 42 | Jan 8 | Module 2 |  |  |  |
`;

  const parsed = parseScheduleMarkdown(md);
  assert.deepEqual(
    parsed.weeks.map((w) => w.week),
    [1, 2],
  );

  const serialized = serializeScheduleMarkdown({
    docTitle: parsed.docTitle,
    links: parsed.links,
    weeks: [{ ...parsed.weeks[0], week: 777 }, { ...parsed.weeks[1], week: -3 }],
    specialDays: parsed.specialDays,
  });

  assert.ok(serialized.includes('| 1 | Jan 1 | Intro |'));
  assert.ok(serialized.includes('| 2 | Jan 8 | Module 2 |'));
});

test('parseScheduleMarkdown supports multiple session rows within the same week', () => {
  const md = `# Multi Session

| Week | Date | Module | Due | Topics Covered | Slides |
| :--: | ---- | ------ | --- | -------------- | ------ |
| 1 | Tue Jan 13 | Module A | | | |
|   | Thu Jan 15 |         | | | |
| 2 | Tue Jan 20 | Module B | | | |
`;

  const parsed = parseScheduleMarkdown(md);
  assert.equal(parsed.weeks.length, 3);
  assert.deepEqual(
    parsed.weeks.map((w) => w.week),
    [1, 1, 2],
  );
});

test('serializeScheduleMarkdown writes blank week cells for additional sessions in the same week', () => {
  const markdown = serializeScheduleMarkdown({
    docTitle: 'Multi Session Serialize',
    links: [],
    weeks: [
      { id: 'w1', week: 1, date: 'Tue Jan 13', module: 'Module A', dueItems: [], topicsCovered: [], slides: [] },
      { id: 'w2', week: 1, date: 'Thu Jan 15', module: '', dueItems: [], topicsCovered: [], slides: [] },
      { id: 'w3', week: 2, date: 'Tue Jan 20', module: 'Module B', dueItems: [], topicsCovered: [], slides: [] },
    ],
    specialDays: [],
  });

  assert.ok(markdown.includes('| 1 | Tue Jan 13 | Module A |'));
  assert.ok(markdown.includes('|  | Thu Jan 15 |  |'));
  assert.ok(markdown.includes('| 2 | Tue Jan 20 | Module B |'));
});
