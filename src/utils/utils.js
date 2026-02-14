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

export function scrollToBottom(container) {
  if (!container) return false;
  let attempts = 0;
  const maxAttempts = 20;

  const tryScroll = () => {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });

    attempts++;
    const actualPosition = container.scrollTop + container.clientHeight;
    const isClose = Math.abs(actualPosition - container.scrollHeight) < 5;

    // If we're close enough or hit max attempts, stop
    if (!isClose && attempts < maxAttempts) {
      setTimeout(tryScroll, 100);
    }
  };

  requestAnimationFrame(tryScroll);
}

/**
 * Extracts the text content that precedes a target element, starting from the nearest heading.
 *
 * This function searches upward through the DOM tree to find the closest heading element (h1-h6)
 * that precedes the target element. Once found, it collects the text content of all paragraph
 * elements between that heading and the target element.
 *
 * @param {HTMLElement} targetElement - The DOM element to find preceding content for
 * @returns {string} A string containing the concatenated text content of all paragraphs
 *                   between the nearest preceding heading and the target element,
 *                   joined by newline characters. Returns an empty string if no
 *                   heading or paragraphs are found.
 *
 * @example
 * const quizElement = document.querySelector('.quiz');
 * const context = getPrecedingContent(quizElement);
 * // Returns: "First paragraph text\nSecond paragraph text\nThird paragraph text"
 */
export function getPrecedingContent(targetElement) {
  let precedingContent = '';
  // Find the closest preceding heading element
  let currentElement = targetElement;
  let headingElement = null;

  // Walk up the DOM tree to find a heading
  while (currentElement && currentElement !== document.body) {
    const precedingHeading = currentElement.closest(':is(h1, h2, h3, h4, h5, h6)');
    if (precedingHeading) {
      headingElement = precedingHeading;
      break;
    }
    // If no heading found in current path, try previous siblings
    let sibling = currentElement.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/i.test(sibling.tagName)) {
        headingElement = sibling;
        break;
      }
      const nestedHeading = sibling.querySelector(':is(h1, h2, h3, h4, h5, h6)');
      if (nestedHeading) {
        headingElement = nestedHeading;
        break;
      }
      sibling = sibling.previousElementSibling;
    }
    if (headingElement) break;
    currentElement = currentElement.parentElement;
  }

  // If we found a heading, collect all paragraphs between it and the target element
  if (headingElement) {
    let walker = headingElement.nextElementSibling;
    const paragraphs = [];

    while (walker && walker !== targetElement) {
      if (walker.tagName === 'P') {
        paragraphs.push(walker.textContent.trim());
      } else if (walker.contains(targetElement)) {
        // If the walker contains our target element, look for paragraphs inside it before the target element
        const innerParagraphs = Array.from(walker.querySelectorAll('p')).filter((p) => !targetElement.contains(p));
        paragraphs.push(...innerParagraphs.map((p) => p.textContent.trim()));
        break;
      }
      walker = walker.nextElementSibling;
    }

    precedingContent = paragraphs.join('\n');
  }
  return precedingContent;
}
