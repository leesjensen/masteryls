export const SCHEDULE_WARNING = {
  MISSING_TITLE: 'WARN_MISSING_TITLE',
  MISSING_TABLE: 'WARN_MISSING_TABLE',
  UNMAPPED_PRETABLE_LINE: 'WARN_UNMAPPED_PRETABLE_LINE',
  MALFORMED_TABLE_ROW: 'WARN_MALFORMED_TABLE_ROW',
  NON_BULLET_SPECIAL_DAYS_LINE: 'WARN_NON_BULLET_SPECIAL_DAYS_LINE',
};

const CANONICAL_HEADERS = ['Week', 'Date', 'Module', 'Due', 'Topics Covered', 'Slides'];

export function parseScheduleMarkdown(markdown = '', options = {}) {
  const strict = Boolean(options.strict);
  const lines = markdown.split(/\r?\n/);
  const warnings = [];

  const { docTitle, titleLineIndex } = parseTitle(lines);
  if (!docTitle) {
    warnings.push({ code: SCHEDULE_WARNING.MISSING_TITLE });
  }

  const tableStart = findScheduleTableStart(lines);
  if (tableStart === -1) {
    warnings.push({ code: SCHEDULE_WARNING.MISSING_TABLE });
  }

  const { links, preTableNotes, preTableWarnings, consumedLines: linkConsumed } = parseTopLinks(lines, tableStart === -1 ? lines.length : tableStart, titleLineIndex);
  warnings.push(...preTableWarnings);

  const { weeks, tableEnd, tableWarnings } = parseScheduleTable(lines, tableStart);
  warnings.push(...tableWarnings);

  const { specialDays, specialWarnings, specialRange } = parseSpecialDays(lines, tableEnd);
  warnings.push(...specialWarnings);

  if (strict) {
    const malformed = warnings.find((w) => w.code === SCHEDULE_WARNING.MALFORMED_TABLE_ROW);
    if (malformed) {
      const location = malformed.line ? ` at line ${malformed.line}` : '';
      throw new Error(`Malformed schedule table row${location}`);
    }
  }

  const optionalTail = collectOptionalTail(lines, {
    titleLineIndex,
    tableStart,
    tableEnd,
    specialRange,
    linkConsumed,
    preTableNotes,
  });

  return {
    docTitle,
    links,
    weeks,
    specialDays,
    optionalTail,
    warnings,
  };
}

export function serializeScheduleMarkdown(model) {
  const lines = [];
  lines.push(`# ${model.docTitle || 'Schedule'}`);
  lines.push('');

  if (model.links?.length) {
    model.links.forEach((link) => {
      if (link?.label && link?.url) {
        lines.push(`[${link.label}](${link.url})`);
      }
    });
    lines.push('');
  }

  lines.push(`| ${CANONICAL_HEADERS.join(' | ')} |`);
  lines.push('| :--: | ---- | ------ | --- | -------------- | ------ |');

  (model.weeks || []).forEach((week) => {
    const row = [week.week ?? '', week.date || '', week.module || '', serializeCellItems(week.dueItems), serializeCellItems(week.topicsCovered), serializeCellItems(week.slides)].map((value) => String(value).replace(/\|/g, '\\|')).join(' | ');

    lines.push(`| ${row} |`);
  });

  lines.push('');
  lines.push('## Special days');
  lines.push('');

  (model.specialDays || []).forEach((day) => {
    if (!day?.label && !day?.dateText) {
      return;
    }

    if (day.dateText) {
      lines.push(`- ${day.dateText}: ${day.label || ''}`.trim());
    } else {
      lines.push(`- ${day.label || ''}`);
    }

    if (day.notes) {
      lines.push(`  ${day.notes}`);
    }
  });

  const optionalTail = model?.optionalTail?.content || '';
  if (optionalTail.trim()) {
    lines.push('');
    lines.push(optionalTail.trimEnd());
  }

  return (
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

function findScheduleTableStart(lines) {
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!looksLikeTableLine(lines[i])) {
      continue;
    }

    if (!looksLikeTableSeparator(lines[i + 1])) {
      continue;
    }

    const headers = splitTableRow(lines[i]).map(normalizeHeader);
    if (headers.includes('week') && headers.includes('date') && headers.includes('module')) {
      return i;
    }
  }

  return -1;
}

function parseTitle(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(/^#\s+(.+)$/);
    if (match) {
      return { docTitle: match[1].trim(), titleLineIndex: i };
    }
    break;
  }

  return { docTitle: '', titleLineIndex: -1 };
}

function parseTopLinks(lines, endIndex, titleLineIndex) {
  const links = [];
  const preTableNotes = [];
  const preTableWarnings = [];
  const consumedLines = new Set();
  const linkRegex = /^\s*(?:[-*]\s+)?\[([^\]]+)\]\(([^)]+)\)\s*$/;

  for (let i = Math.max(0, titleLineIndex + 1); i < endIndex; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const match = lines[i].match(linkRegex);
    if (match) {
      links.push({ id: `link-${i}`, label: match[1].trim(), url: match[2].trim() });
      consumedLines.add(i);
    } else {
      preTableNotes.push(lines[i]);
      preTableWarnings.push({ code: SCHEDULE_WARNING.UNMAPPED_PRETABLE_LINE, line: i + 1, value: lines[i] });
    }
  }

  return { links, preTableNotes, preTableWarnings, consumedLines };
}

function parseScheduleTable(lines, tableStart) {
  if (tableStart === -1) {
    return { weeks: [], tableEnd: -1, tableWarnings: [] };
  }

  const headers = splitTableRow(lines[tableStart]).map((header) => mapHeaderAlias(normalizeHeader(header)));
  const colMap = {
    week: headers.findIndex((h) => h === 'week'),
    date: headers.findIndex((h) => h === 'date'),
    module: headers.findIndex((h) => h === 'module'),
    dueItems: headers.findIndex((h) => h === 'due'),
    topicsCovered: headers.findIndex((h) => h === 'topics covered'),
    slides: headers.findIndex((h) => h === 'slides'),
  };

  const weeks = [];
  const tableWarnings = [];
  const expectedCells = splitTableRow(lines[tableStart]).length;
  let index = tableStart + 2;
  while (index < lines.length && looksLikeTableLine(lines[index])) {
    const cells = splitTableRow(lines[index]);
    if (cells.length !== expectedCells) {
      tableWarnings.push({ code: SCHEDULE_WARNING.MALFORMED_TABLE_ROW, line: index + 1, expectedCells, actualCells: cells.length });
      index += 1;
      continue;
    }

    weeks.push({
      id: `week-${index}`,
      week: parseWeek(getCell(cells, colMap.week)),
      date: getCell(cells, colMap.date),
      module: getCell(cells, colMap.module),
      dueItems: parseCellItems(getCell(cells, colMap.dueItems)),
      topicsCovered: parseCellItems(getCell(cells, colMap.topicsCovered)),
      slides: parseCellItems(getCell(cells, colMap.slides)),
    });
    index += 1;
  }

  return { weeks, tableEnd: index - 1, tableWarnings };
}

function parseSpecialDays(lines, fromIndex) {
  if (fromIndex === -1) {
    return { specialDays: [], specialWarnings: [], specialRange: null };
  }

  let specialIndex = -1;
  for (let i = Math.max(0, fromIndex); i < lines.length; i += 1) {
    if (/^#{2,3}\s*special days\s*$/i.test(lines[i].trim())) {
      specialIndex = i;
      break;
    }
  }

  if (specialIndex === -1) {
    return { specialDays: [], specialWarnings: [], specialRange: null };
  }

  const days = [];
  const specialWarnings = [];
  let specialEnd = lines.length - 1;
  for (let i = specialIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,3}\s+/.test(line)) {
      specialEnd = i - 1;
      break;
    }

    const bullet = line.match(/^\s*-\s+(.+)$/);
    if (!bullet) {
      if (line.trim()) {
        specialWarnings.push({ code: SCHEDULE_WARNING.NON_BULLET_SPECIAL_DAYS_LINE, line: i + 1, value: line });
      }
      continue;
    }

    const content = bullet[1].trim();
    const day = { id: `special-${i}`, dateText: '', label: content, notes: '' };

    const colon = content.indexOf(':');
    const dash = content.indexOf(' - ');
    if (colon > 0) {
      day.dateText = content.slice(0, colon).trim();
      day.label = content.slice(colon + 1).trim();
    } else if (dash > 0) {
      day.dateText = content.slice(0, dash).trim();
      day.label = content.slice(dash + 3).trim();
    }

    if (i + 1 < lines.length && /^\s{2,}\S+/.test(lines[i + 1])) {
      day.notes = lines[i + 1].trim();
    }

    days.push(day);
  }

  return {
    specialDays: days,
    specialWarnings,
    specialRange: { start: specialIndex, end: specialEnd },
  };
}

export function parseCellItems(value = '') {
  const items = String(value)
    .split(/<br\s*\/?>|<\/br>/gi)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => parseCellItem(entry, index));

  return items;
}

function parseCellItem(entry, index) {
  const checkedMatch = entry.match(/^(☑|- \[(?:x|X)\])\s+(.+)$/);
  const checked = Boolean(checkedMatch);
  const core = checked ? checkedMatch[2].trim() : entry;

  const linkMatch = core.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (linkMatch) {
    return {
      id: `item-${index}`,
      text: linkMatch[1].trim(),
      href: linkMatch[2].trim(),
      checked,
    };
  }

  return {
    id: `item-${index}`,
    text: core,
    href: '',
    checked,
  };
}

function serializeCellItems(items = []) {
  return items
    .filter((item) => item && item.text)
    .map((item) => {
      const base = item.href ? `[${item.text}](${item.href})` : item.text;
      return item.checked ? `☑ ${base}` : base;
    })
    .join('</br>');
}

function looksLikeTableLine(line) {
  return line.includes('|');
}

function looksLikeTableSeparator(line) {
  const normalized = line.replace(/\|/g, '').trim();
  return /^:?-{2,}:?(\s+:?-{2,}:?)*$/.test(normalized.replace(/\s+/g, ' '));
}

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function normalizeHeader(header) {
  return header.replace(/\s+/g, ' ').trim().toLowerCase();
}

function mapHeaderAlias(header) {
  if (header === 'assignments due') return 'due';
  if (header === 'topics') return 'topics covered';
  return header;
}

function parseWeek(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  const number = Number(trimmed);
  if (Number.isFinite(number) && number > 0) {
    return number;
  }

  return trimmed;
}

function getCell(cells, index) {
  if (index < 0 || index >= cells.length) {
    return '';
  }

  return cells[index] || '';
}

function collectOptionalTail(lines, parts) {
  const { titleLineIndex, tableStart, tableEnd, specialRange, linkConsumed, preTableNotes } = parts;
  const consumed = new Set(linkConsumed || []);

  if (titleLineIndex >= 0) {
    consumed.add(titleLineIndex);
  }

  if (tableStart >= 0) {
    for (let i = tableStart; i <= tableEnd; i += 1) {
      consumed.add(i);
    }
  }

  if (specialRange?.start >= 0) {
    for (let i = specialRange.start; i <= specialRange.end; i += 1) {
      consumed.add(i);
    }
  }

  const tailLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!consumed.has(i) && lines[i].trim()) {
      tailLines.push(lines[i]);
    }
  }

  const preTable = (preTableNotes || []).filter((line) => line.trim()).join('\n');
  const content = tailLines.join('\n').trim();
  const merged = [preTable, content].filter(Boolean).join('\n\n');

  return {
    preTableNotes: preTable,
    content: merged,
  };
}

export function buildWeeks(count) {
  const weeks = [];
  for (let i = 0; i < count; i += 1) {
    weeks.push({
      id: `gen-week-${i + 1}`,
      week: i + 1,
      date: '',
      module: '',
      dueItems: [],
      topicsCovered: [],
      slides: [],
    });
  }
  return weeks;
}
