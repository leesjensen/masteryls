const TARGET_TYPE = 'image/jpeg';
const MIN_DIMENSION = 200;
const MAX_ATTEMPTS = 8;

export async function compressImageToBudget(file, maxBytes) {
  if (!file?.type?.startsWith('image/')) return file;
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  let quality = 0.85;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(MIN_DIMENSION, Math.round(width));
    canvas.height = Math.max(MIN_DIMENSION, Math.round(height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((res) => canvas.toBlob(res, TARGET_TYPE, quality));
    if (blob && blob.size <= maxBytes) {
      return new File([blob], renameAsJpeg(file.name), { type: TARGET_TYPE, lastModified: Date.now() });
    }

    if (quality > 0.4) {
      quality -= 0.15;
    } else {
      width *= 0.8;
      height *= 0.8;
    }
  }
  return null;
}

function renameAsJpeg(name) {
  const base = String(name || 'image').replace(/\.[^.]+$/, '');
  return `${base}.jpg`;
}
