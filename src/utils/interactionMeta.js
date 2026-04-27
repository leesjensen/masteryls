const DEFAULT_INTERACTION_META = { id: undefined, title: '', type: 'multiple-choice' };
const SUBMITTABLE_INTERACTION_TYPES = new Set(['multiple-choice', 'multiple-select', 'survey', 'essay', 'file-submission', 'url-submission', 'teaching', 'prompt']);

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
