import { defaultSchema } from 'rehype-sanitize';

const mergeUnique = (...lists) => [...new Set(lists.flat().filter(Boolean))];

const toReactStyleKey = (key) =>
  key.includes('-')
    ? key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    : key;

const ALLOWED_STYLE_PROPERTIES = new Set(['color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'font-size']);
const UNSAFE_STYLE_PATTERNS = /(url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:)/i;
const SAFE_STYLE_VALUE_PATTERN = /^[a-zA-Z0-9#(),.%\s\-+/]*$/;
const ALERT_CLASS_PATTERN = /^markdown-alert(?:-(?:note|tip|important|warning|caution|title))?$/;
const OCTICON_CLASS_PATTERN = /^octicon(?:-[\w-]+)?$/;

function sanitizeStyleValue(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || UNSAFE_STYLE_PATTERNS.test(trimmed) || !SAFE_STYLE_VALUE_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function sanitizeInlineStyle(styleProp) {
  if (!styleProp) {
    return undefined;
  }

  const safeStyle = {};

  const addSafeStyle = (property, value) => {
    const normalizedProperty = property.trim().toLowerCase();
    if (!ALLOWED_STYLE_PROPERTIES.has(normalizedProperty)) {
      return;
    }

    const safeValue = sanitizeStyleValue(value);
    if (!safeValue) {
      return;
    }

    safeStyle[toReactStyleKey(normalizedProperty)] = safeValue;
  };

  if (typeof styleProp === 'string') {
    styleProp.split(';').forEach((declaration) => {
      const [property, ...valueParts] = declaration.split(':');
      if (!property || valueParts.length === 0) {
        return;
      }
      addSafeStyle(property, valueParts.join(':'));
    });
  } else if (typeof styleProp === 'object') {
    Object.entries(styleProp).forEach(([property, value]) => {
      addSafeStyle(property, String(value));
    });
  }

  return Object.keys(safeStyle).length > 0 ? safeStyle : undefined;
}

export const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: mergeUnique(defaultSchema.tagNames, ['audio', 'iframe', 'path', 'source', 'span', 'svg', 'video']),
  attributes: {
    ...defaultSchema.attributes,
    a: mergeUnique(defaultSchema.attributes?.a, ['href', 'target', 'rel', 'title']),
    audio: ['controls', 'loop', 'muted', 'preload', 'src'],
    blockquote: [...(defaultSchema.attributes?.blockquote || []), ['className', ALERT_CLASS_PATTERN]],
    div: [...(defaultSchema.attributes?.div || []), ['className', ALERT_CLASS_PATTERN]],
    iframe: ['allow', 'allowfullscreen', 'allowFullScreen', 'frameborder', 'frameBorder', 'height', 'loading', 'referrerpolicy', 'referrerPolicy', 'sandbox', 'src', 'title', 'width'],
    img: mergeUnique(defaultSchema.attributes?.img, ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding']),
    p: [...(defaultSchema.attributes?.p || []), ['className', ALERT_CLASS_PATTERN]],
    path: ['d', 'fill', 'fillRule', 'fill-rule', 'clipRule', 'clip-rule'],
    source: ['src', 'type', 'media'],
    span: [...(defaultSchema.attributes?.span || []), 'style', ['className', OCTICON_CLASS_PATTERN]],
    svg: ['xmlns', 'width', 'height', 'viewBox', 'fill', 'ariaHidden', 'aria-hidden', 'role', ['className', OCTICON_CLASS_PATTERN]],
    video: ['controls', 'height', 'loop', 'muted', 'playsinline', 'playsInline', 'poster', 'preload', 'src', 'width'],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: mergeUnique(defaultSchema.protocols?.href, ['http', 'https', 'mailto', 'tel']),
    src: mergeUnique(defaultSchema.protocols?.src, ['http', 'https']),
  },
};
