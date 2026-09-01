import React from 'react';
import { useNavigate } from 'react-router-dom';

// interactionInstruction.jsx provides a resolver (href -> real navigable app URL) through this
// context. inlineLiteMarkdown - the lightweight renderer used for interaction bodies/choices -
// renders links with the InteractionLink component below, which consumes the resolver so that
// relative markdown links inside a `masteryls` fence behave like links in the main topic
// content: resolved to a topic route (or absolute resource URL) and intercepted for SPA
// navigation. Default is null so any caller rendered without a provider simply falls back to
// the raw href (unchanged legacy behavior) instead of crashing.
export const InteractionLinkResolverContext = React.createContext(null);

// A markdown link inside an interaction body. Mirrors the anchor handling in Markdown.jsx: the
// resolved href is baked into the attribute so open-in-new-tab / middle-click / cmd-click land
// on a valid destination, while a plain left-click is intercepted for in-app navigation.
export function InteractionLink({ href, children }) {
  const resolveHref = React.useContext(InteractionLinkResolverContext);
  const navigate = useNavigate();
  const resolvedHref = resolveHref ? resolveHref(href) : href;

  return (
    <a
      href={resolvedHref}
      onClick={(e) => {
        // Let modified clicks (new tab / new window) fall through to the browser, which uses
        // the now-resolved href attribute.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (resolvedHref?.startsWith('/')) {
          e.preventDefault();
          navigate(resolvedHref);
        } else if (resolvedHref?.startsWith('http')) {
          e.preventDefault();
          window.open(resolvedHref, '_blank', 'noopener,noreferrer');
        }
        // Anchors / other schemes: let the browser handle the resolved href natively.
      }}
    >
      {children}
    </a>
  );
}
