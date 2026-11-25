import { useEffect } from 'react';

// Imperatively apply a SEO head spec (from buildTopicHead) to document.head: description, canonical,
// robots, Open Graph, Twitter cards, and a JSON-LD script. Tags this hook creates carry `data-seo` so
// they can be removed on cleanup. The robots meta (seeded as `noindex` in index.html so non-JS crawlers
// never index the empty shell) is MUTATED in place — never duplicated — and reset to `noindex` on
// cleanup, so navigating away from a public topic de-indexes correctly.

function setRobots(content) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector('meta[name="robots"]');
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    document.head.appendChild(el); // left in place (not data-seo) since index.html normally seeds it
  }
  el.setAttribute('content', content);
}

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${CSS?.escape ? CSS.escape(key) : key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute('data-seo', '');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content ?? '');
}

export default function useHeadTags(head) {
  const key = head ? JSON.stringify(head) : '';
  useEffect(() => {
    if (!head || typeof document === 'undefined') return undefined;

    setRobots(head.robots || 'noindex,follow');
    upsertMeta('name', 'description', head.description || '');
    for (const [k, v] of Object.entries(head.og || {})) upsertMeta('property', k, v);
    for (const [k, v] of Object.entries(head.twitter || {})) upsertMeta('name', k, v);

    let canonical = document.head.querySelector('link[rel="canonical"][data-seo]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.setAttribute('data-seo', '');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', head.canonical || '');

    let ld = document.head.querySelector('script[data-seo-jsonld]');
    if (!ld) {
      ld = document.createElement('script');
      ld.setAttribute('type', 'application/ld+json');
      ld.setAttribute('data-seo-jsonld', '');
      document.head.appendChild(ld);
    }
    ld.textContent = head.jsonLd ? JSON.stringify(head.jsonLd) : '';

    return () => {
      setRobots('noindex,follow'); // leaving the topic page → de-index
      document.head.querySelectorAll('[data-seo], [data-seo-jsonld]').forEach((el) => el.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
