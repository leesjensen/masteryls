import test from 'node:test';
import assert from 'node:assert/strict';
import { collapseSidebarForNavigation, handleSidebarLinkClick } from './sidebarNavigation.js';

function makeCourseOps(sidebarVisible) {
  const saved = [];
  return {
    saved,
    getEnrollmentUiSettings: () => ({ sidebarVisible }),
    saveEnrollmentUiSettings: (courseId, settings) => saved.push({ courseId, settings }),
  };
}

function withViewport(isMobile, fn) {
  const prev = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: isMobile }) };
  try {
    return fn();
  } finally {
    globalThis.window = prev;
  }
}

test('collapseSidebarForNavigation collapses a pinned-open ("end") sidebar on any viewport', () => {
  const courseOps = makeCourseOps('end');
  withViewport(false, () => collapseSidebarForNavigation(courseOps, 'c1'));
  assert.deepEqual(courseOps.saved, [{ courseId: 'c1', settings: { sidebarVisible: 'start' } }]);
});

test('collapseSidebarForNavigation collapses an open sidebar on a mobile viewport', () => {
  const courseOps = makeCourseOps(undefined);
  withViewport(true, () => collapseSidebarForNavigation(courseOps, 'c1'));
  assert.deepEqual(courseOps.saved, [{ courseId: 'c1', settings: { sidebarVisible: 'start' } }]);
});

test('collapseSidebarForNavigation leaves an already-collapsed mobile sidebar alone', () => {
  const courseOps = makeCourseOps('start');
  withViewport(true, () => collapseSidebarForNavigation(courseOps, 'c1'));
  assert.deepEqual(courseOps.saved, []);
});

test('collapseSidebarForNavigation leaves a desktop sidebar that is not pinned open', () => {
  const courseOps = makeCourseOps(undefined);
  withViewport(false, () => collapseSidebarForNavigation(courseOps, 'c1'));
  assert.deepEqual(courseOps.saved, []);
});

test('collapseSidebarForNavigation is a no-op without ui-settings ops', () => {
  assert.doesNotThrow(() => collapseSidebarForNavigation({}, 'c1'));
  assert.doesNotThrow(() => collapseSidebarForNavigation(undefined, 'c1'));
});

test('handleSidebarLinkClick collapses the sidebar and navigates on a plain click', () => {
  const courseOps = makeCourseOps('end');
  let navigatedTo = null;
  let defaultPrevented = false;
  const event = { preventDefault: () => (defaultPrevented = true) };
  withViewport(false, () =>
    handleSidebarLinkClick(event, { courseOps, courseId: 'c1', navigate: (to) => (navigatedTo = to), to: '/course/c1/schedule' }),
  );
  assert.equal(defaultPrevented, true);
  assert.equal(navigatedTo, '/course/c1/schedule');
  assert.deepEqual(courseOps.saved, [{ courseId: 'c1', settings: { sidebarVisible: 'start' } }]);
});

test('handleSidebarLinkClick lets a modifier-click fall through to the browser', () => {
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey']) {
    const courseOps = makeCourseOps('end');
    let navigatedTo = null;
    let defaultPrevented = false;
    const event = { [modifier]: true, preventDefault: () => (defaultPrevented = true) };
    withViewport(false, () =>
      handleSidebarLinkClick(event, { courseOps, courseId: 'c1', navigate: (to) => (navigatedTo = to), to: '/course/c1/schedule' }),
    );
    assert.equal(defaultPrevented, false, modifier);
    assert.equal(navigatedTo, null, modifier);
    assert.deepEqual(courseOps.saved, [], modifier);
  }
});
