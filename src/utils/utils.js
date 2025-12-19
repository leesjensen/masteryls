export function generateId() {
  return crypto.randomUUID();
}

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function scrollToAnchor(anchor, containerRef) {
  if (!containerRef.current || !anchor) return;

  let anchorId = anchor.startsWith('#') ? anchor.substring(1) : anchor;
  let targetElement = containerRef.current.querySelector(`#${CSS.escape(anchorId)}`);

  if (!targetElement) {
    const headings = containerRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings) {
      anchorId = anchorId.replaceAll('-', ' ');
      targetElement = Array.from(headings).find((h) => h.textContent.trim().toLowerCase() === anchorId.toLowerCase());
    }
  }

  if (targetElement) {
    targetElement.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
  }
}
