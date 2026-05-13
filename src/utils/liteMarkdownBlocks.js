export function parseLiteMarkdownBlocks(md) {
  if (!md) return [];

  const lines = String(md).split('\n');
  const blocks = [];
  let i = 0;

  const isUnorderedListLine = (line) => /^\s*[*+-]\s+/.test(line);
  const isOrderedListLine = (line) => /^\s*\d+\.\s+/.test(line);
  const isListLine = (line) => isUnorderedListLine(line) || isOrderedListLine(line);

  function listInfo(line) {
    if (isOrderedListLine(line)) {
      const match = line.match(/^\s*(\d+)\.\s+(.*)$/);
      return { type: 'ol', text: match ? match[2] : line.trim(), start: match ? Number(match[1]) : 1 };
    }
    return { type: 'ul', text: line.replace(/^\s*[*+-]\s+/, ''), start: 1 };
  }

  while (i < lines.length) {
    if (!lines[i].trim()) {
      i += 1;
      continue;
    }

    if (isListLine(lines[i])) {
      const items = [];
      const first = listInfo(lines[i]);
      while (i < lines.length) {
        const current = lines[i];
        if (!current.trim()) {
          const next = lines.slice(i + 1).find((line) => line.trim() !== '');
          if (next && isListLine(next) && listInfo(next).type === first.type) {
            i += 1;
            continue;
          }
          break;
        }
        if (!isListLine(current)) {
          break;
        }
        const currentItem = listInfo(current);
        if (currentItem.type !== first.type) {
          break;
        }
        items.push(currentItem.text);
        i += 1;
      }

      blocks.push(first.type === 'ol' ? { type: 'ol', items, start: first.start } : { type: 'ul', items });
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
