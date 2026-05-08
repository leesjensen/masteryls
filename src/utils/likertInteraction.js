export function parseLikertScale(scaleLine = '', fallbackMin = 1, fallbackMax = 5, fallbackLabels = null) {
  const parsedFromLine = {};

  if (typeof scaleLine === 'string' && /^\s*scale\s*:/i.test(scaleLine)) {
    const tokens = scaleLine
      .replace(/^\s*scale\s*:/i, '')
      .split('|')
      .map((token) => token.trim())
      .filter(Boolean);

    tokens.forEach((token) => {
      const match = token.match(/^(\d+)\s*=\s*(.+)$/);
      if (match) {
        parsedFromLine[Number(match[1])] = match[2].trim();
      }
    });
  }

  const sourceLabels = Object.keys(parsedFromLine).length > 0 ? parsedFromLine : fallbackLabels || {};
  const explicitValues = Object.keys(sourceLabels)
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  let values = explicitValues;
  if (values.length === 0) {
    const min = Number.isFinite(Number(fallbackMin)) ? Number(fallbackMin) : 1;
    const max = Number.isFinite(Number(fallbackMax)) ? Number(fallbackMax) : 5;
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);
    values = Array.from({ length: upper - lower + 1 }, (_, i) => lower + i);
  }

  const labels = {};
  values.forEach((value) => {
    labels[value] = sourceLabels[value] || sourceLabels[String(value)] || String(value);
  });

  return { values, labels };
}

export function canViewLikertResults(showResults, user) {
  const visibility = String(showResults || 'editor')
    .trim()
    .toLowerCase();
  if (visibility === 'always') {
    return true;
  }

  return Boolean(user?.isRoot?.() || user?.isEditor?.());
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isDividerRow(line) {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function parseLikertBody(body, meta = {}) {
  const lines = (body || '').split('\n');
  const scaleLineIndex = lines.findIndex((line) => /^\s*scale\s*:/i.test(line));
  const tableStart = lines.findIndex((line) => line.trim().startsWith('|'));

  const promptEndCandidates = [lines.length];
  if (tableStart >= 0) promptEndCandidates.push(tableStart);
  if (scaleLineIndex >= 0) promptEndCandidates.push(scaleLineIndex);
  const promptEnd = Math.min(...promptEndCandidates);
  const prompt = lines.slice(0, promptEnd).join('\n').trim();

  const scaleLine = scaleLineIndex >= 0 ? lines[scaleLineIndex] : '';
  const scale = parseLikertScale(scaleLine, meta.scaleMin, meta.scaleMax, meta.scaleLabels || null);

  const tableLines = [];
  if (tableStart >= 0) {
    for (let i = tableStart; i < lines.length; i += 1) {
      if (!lines[i].trim().startsWith('|')) {
        break;
      }
      tableLines.push(lines[i]);
    }
  }

  let questions = [];
  if (tableLines.length >= 3 && isDividerRow(tableLines[1])) {
    const header = parseTableRow(tableLines[0]).map((cell) => cell.toLowerCase());
    const qidIndex = header.findIndex((name) => ['qid', 'id', 'key'].includes(name));
    const itemIndex = header.findIndex((name) => ['item', 'statement', 'question', 'text'].includes(name));

    if (qidIndex >= 0 && itemIndex >= 0) {
      questions = tableLines
        .slice(2)
        .map((line) => parseTableRow(line))
        .filter((cells) => cells.length > Math.max(qidIndex, itemIndex))
        .map((cells, index) => ({
          qid: cells[qidIndex],
          text: cells[itemIndex],
          index,
        }))
        .filter((question) => question.qid && question.text);
    }
  }

  return { prompt, questions, scale };
}

export function summarizeLikertResponses({ questions, scaleValues, latestResponsesByUser }) {
  const countsTemplate = {};
  scaleValues.forEach((value) => {
    countsTemplate[value] = 0;
  });

  let allAnswerCount = 0;
  let allAnswerSum = 0;

  const questionSummaries = questions.map((question) => {
    const counts = { ...countsTemplate };
    let sum = 0;
    let responseCount = 0;

    latestResponsesByUser.forEach((entry) => {
      const rawValue = entry.responses?.[question.qid];
      const value = Number(rawValue);
      if (!Number.isFinite(value) || !scaleValues.includes(value)) {
        return;
      }

      counts[value] += 1;
      sum += value;
      responseCount += 1;
      allAnswerCount += 1;
      allAnswerSum += value;
    });

    return {
      qid: question.qid,
      text: question.text,
      counts,
      responses: responseCount,
      average: responseCount > 0 ? Number((sum / responseCount).toFixed(2)) : 0,
    };
  });

  return {
    voters: latestResponsesByUser.length,
    overallAverage: allAnswerCount > 0 ? Number((allAnswerSum / allAnswerCount).toFixed(2)) : 0,
    questions: questionSummaries,
  };
}
