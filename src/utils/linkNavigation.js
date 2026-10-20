// Shared click handling for in-app navigation links — the TOC sidebar (topics,
// schedule, attendance) and the classroom toolbar icons. Rendering these as real
// `<a href>` anchors is what lets the browser offer "Open in new tab/window" on a
// right-click; this module handles the left-click so a plain click still navigates
// inside the SPA while a modifier-click falls through to the browser.

// Generic handler for a link that navigates within the SPA. A modifier-click (the
// browser's new-tab/new-window gestures) is left alone so the anchor's href is honoured;
// a plain primary click is intercepted and runs `onNavigate` instead.
export function handleInAppLinkClick(event, onNavigate) {
  if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  event.preventDefault();
  onNavigate();
}

// Collapse the sidebar after a sidebar navigation when it would otherwise stay in the
// way: on a mobile viewport (unless already collapsed) or whenever it is pinned open
// ('end'). No-op when the ui-settings ops aren't available.
export function collapseSidebarForNavigation(courseOps, courseId) {
  if (!courseOps?.getEnrollmentUiSettings || !courseOps?.saveEnrollmentUiSettings) {
    return;
  }

  const settings = courseOps.getEnrollmentUiSettings(courseId);
  const isMobileViewport = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  if ((isMobileViewport && settings?.sidebarVisible !== 'start') || settings?.sidebarVisible === 'end') {
    courseOps.saveEnrollmentUiSettings(courseId, { sidebarVisible: 'start' });
  }
}

// onClick handler for a TOC sidebar link: navigate in-app on a plain click (collapsing
// the sidebar first), and let a modifier-click open the href in a new tab/window.
export function handleSidebarLinkClick(event, { courseOps, courseId, navigate, to }) {
  handleInAppLinkClick(event, () => {
    collapseSidebarForNavigation(courseOps, courseId);
    navigate(to);
  });
}
