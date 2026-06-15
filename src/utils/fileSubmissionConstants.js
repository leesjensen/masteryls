export const MAX_FILE_BYTES = 100 * 1024;
export const IMAGE_BUDGET_BYTES = 80 * 1024;
export const MAX_FILES_PER_SUBMISSION = 5;

export const ACCEPTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
];

export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(',');

export function isImageMime(type) {
  return /^image\//.test(type || '');
}

export function isAcceptedMime(type) {
  return ACCEPTED_MIME_TYPES.includes(type);
}
