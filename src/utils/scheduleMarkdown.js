export function parseScheduleMarkdown(markdown = '') {
  const lines = markdown.split(/\r?\n/);

  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const docTitle = titleMatch ? titleMatch[1].trim() : '';

  const tableStart = findScheduleTableStart(lines);
  const links = parseTopLinks(lines, tableStart === -1 ? lines.length : tableStart);

  const { weeks, tableEnd } = parseScheduleTable(lines, tableStart);
  const specialDays = parseSpecialDays(lines, tableEnd);

  return {
    docTitle,
    links,
    weeks,
    specialDays,
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

  lines.push('| Week | Date | Module | Due | Topics Covered | Slides |');
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

  return (
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
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

function parseTopLinks(lines, endIndex) {
  const links = [];
  const linkRegex = /^\s*(?:[-*]\s+)?\[([^\]]+)\]\(([^)]+)\)\s*$/;

  for (let i = 0; i < endIndex; i += 1) {
    const match = lines[i].match(linkRegex);
    if (match) {
      links.push({ id: `link-${i}`, label: match[1].trim(), url: match[2].trim() });
    }
  }

  return links;
}

function parseScheduleTable(lines, tableStart) {
  if (tableStart === -1) {
    return { weeks: [], tableEnd: -1 };
  }

  const headers = splitTableRow(lines[tableStart]).map(normalizeHeader);
  const colMap = {
    week: headers.findIndex((h) => h === 'week'),
    date: headers.findIndex((h) => h === 'date'),
    module: headers.findIndex((h) => h === 'module'),
    dueItems: headers.findIndex((h) => h === 'due' || h === 'assignments due'),
    topicsCovered: headers.findIndex((h) => h === 'topics covered' || h === 'topics'),
    slides: headers.findIndex((h) => h === 'slides'),
  };

  const weeks = [];
  let index = tableStart + 2;
  while (index < lines.length && looksLikeTableLine(lines[index])) {
    const cells = splitTableRow(lines[index]);
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

  return { weeks, tableEnd: index - 1 };
}

function parseSpecialDays(lines, fromIndex) {
  if (fromIndex === -1) {
    return [];
  }

  let specialIndex = -1;
  for (let i = Math.max(0, fromIndex); i < lines.length; i += 1) {
    if (/^#{2,3}\s*special days\s*$/i.test(lines[i].trim())) {
      specialIndex = i;
      break;
    }
  }

  if (specialIndex === -1) {
    return [];
  }

  const days = [];
  for (let i = specialIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,3}\s+/.test(line)) {
      break;
    }

    const bullet = line.match(/^\s*-\s+(.+)$/);
    if (!bullet) {
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

  return days;
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
