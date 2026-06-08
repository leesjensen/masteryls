const DEFAULT_INTERACTION_META = { id: undefined, title: '', type: 'multiple-choice' };
const SUBMITTABLE_INTERACTION_TYPES = new Set(['multiple-choice', 'multiple-select', 'survey', 'likert', 'essay', 'file-submission', 'url-submission', 'teaching', 'prompt', 'ai-web-page']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeInteractionMetaJson(jsonText) {
  return jsonText.replace(/("(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?|true|false|null)\s+(?="[^"]+"\s*:)/g, '$1, ');
}

export function parseInteractionMeta(interactionContent, defaults = {}) {
  const jsonMatch = interactionContent.match(/^\{[\s\S]*?\}(?:\n|$)/);
  let meta = { ...DEFAULT_INTERACTION_META, ...defaults };
  let body = interactionContent;

  if (jsonMatch) {
    const jsonText = jsonMatch[0].trim();
    try {
      meta = { ...meta, ...JSON.parse(jsonText) };
    } catch {
      try {
        meta = { ...meta, ...JSON.parse(normalizeInteractionMetaJson(jsonText)) };
      } catch {}
    }

    body = interactionContent.slice(jsonMatch.index + jsonMatch[0].length).trim();
  }

  if (typeof meta.type === 'string') {
    meta.type = meta.type.toLowerCase().trim();
  }

  return { meta, body };
}

export function extractInteractionMetas(content) {
  const regex = /```masteryls\s*\n?([\s\S]*?)```/g;
  const interactions = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    interactions.push(parseInteractionMeta(match[1]).meta);
  }

  return interactions;
}

export function isSubmittableInteractionType(type) {
  return SUBMITTABLE_INTERACTION_TYPES.has((type || '').toLowerCase().trim());
}

export function normalizeInteractionIds(markdown, generateId = () => crypto.randomUUID(), existingIds = new Set()) {
  const source = String(markdown || '');
  if (!source.trim()) {
    return source;
  }

  const seenIds = new Set(existingIds);

  return source.replace(/```masteryls\s*\n?([\s\S]*?)```/g, (fullMatch, fenceBody) => {
    const parsed = parseInteractionMeta(fenceBody);
    const meta = parsed.meta || {};
    const id = typeof meta.id === 'string' ? meta.id.trim() : '';
    const isValidAndUnique = UUID_PATTERN.test(id) && !seenIds.has(id);

    if (isValidAndUnique) {
      seenIds.add(id);
      return fullMatch;
    }

    const jsonMatch = String(fenceBody || '').match(/^\{[\s\S]*?\}(?:\n|$)/);
    if (!jsonMatch) {
      return fullMatch;
    }

    const newId = generateId();
    seenIds.add(newId);
    const fixedMeta = { ...meta, id: newId };
    const jsonReplacement = `${JSON.stringify(fixedMeta)}\n`;
    const newFenceBody = String(fenceBody).replace(jsonMatch[0], jsonReplacement);
    return `\`\`\`masteryls\n${newFenceBody}\`\`\``;
  });
}
