// Shared click handling for links in the TOC sidebar (topics, schedule, attendance).
// Every sidebar link should behave the same way: honour modifier-click (open in a new
// tab / keep default browser behaviour), otherwise collapse the sidebar when appropriate
// and navigate within the app. Keeping this in one place avoids the links drifting apart.

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

// onClick handler for any sidebar link. Lets a modifier-click fall through to the
// browser (new tab, etc.); otherwise prevents default, collapses the sidebar, and
// navigates to `to`.
export function handleSidebarLinkClick(event, { courseOps, courseId, navigate, to }) {
  if (event.metaKey || event.ctrlKey || event.shiftKey) {
    return;
  }

  event.preventDefault();
  collapseSidebarForNavigation(courseOps, courseId);
  navigate(to);
}
