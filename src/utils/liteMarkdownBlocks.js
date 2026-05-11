export function parseLiteMarkdownBlocks(md) {
  if (!md) return [];

  const lines = String(md).split('\n');
  const blocks = [];
  let i = 0;

  const isListLine = (line) => /^\s*[*+-]\s+/.test(line);
  const getListText = (line) => line.replace(/^\s*[*+-]\s+/, '');

  while (i < lines.length) {
    if (!lines[i].trim()) {
      i += 1;
      continue;
    }

    if (isListLine(lines[i])) {
      const items = [];
      while (i < lines.length) {
        const current = lines[i];
        if (!current.trim()) {
          const next = lines.slice(i + 1).find((line) => line.trim() !== '');
          if (next && isListLine(next)) {
            i += 1;
            continue;
          }
          break;
        }
        if (!isListLine(current)) {
          break;
        }
        items.push(getListText(current));
        i += 1;
      }

      blocks.push({ type: 'ul', items });
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() !== '' && !isListLine(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }

    blocks.push({ type: 'p', text: paragraph.join(' ') });
  }

  return blocks;
}
