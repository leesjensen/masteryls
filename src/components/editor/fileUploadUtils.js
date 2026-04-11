export function cleanFilename(name) {
  return String(name || '').replace(/[^a-zA-Z0-9-_\.]/g, '_');
}

export function extensionFromMimeType(type) {
  const mime = String(type || '').toLowerCase();
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/svg+xml') return 'svg';
  return 'png';
}

export function toUploadDescriptor(file, fallbackNamePrefix = 'pasted-image') {
  const fallbackName = `${fallbackNamePrefix}-${Date.now()}.${extensionFromMimeType(file?.type)}`;
  const name = cleanFilename(file?.name || fallbackName);

  return {
    name,
    size: file?.size,
    type: file?.type,
    lastModified: file?.lastModified,
    props: file,
  };
}

export function createUploadDescriptors(files, fallbackNamePrefix = 'pasted-image') {
  return (Array.isArray(files) ? files : []).map((file, index) => toUploadDescriptor(file, `${fallbackNamePrefix}-${index + 1}`));
}
