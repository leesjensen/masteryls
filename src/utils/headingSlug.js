// The slug used as the DOM id of a rendered markdown heading, and therefore the `#anchor`
// target for jumping to it. Markdown.jsx assigns this id to headings and the TOC heading
// jump-list builds its `#slug` links from the same function, so the two can never drift.
export function headingSlug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}
