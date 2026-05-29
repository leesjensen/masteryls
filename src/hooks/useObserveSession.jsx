import React from 'react';

const OBSERVE_SESSION_STORAGE_KEY = 'masteryls.observeSession.v1';

export function getEffectiveLearnerId({ userId, courseId, observeSession }) {
  const observeForCourse = Boolean(observeSession?.active && observeSession?.courseId === courseId);
  return {
    observeForCourse,
    learnerId: observeForCourse ? observeSession?.learnerId : userId,
  };
}

export default function useObserveSession(user) {
  const [observeSession, setObserveSession] = React.useState(null);

  const persistObserveSession = React.useCallback((nextSession) => {
    if (nextSession?.active) {
      try {
        window.localStorage.setItem(OBSERVE_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      } catch {
        // ignore storage errors
      }
    } else {
      try {
        window.localStorage.removeItem(OBSERVE_SESSION_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const clearObserveSession = React.useCallback(() => {
    setObserveSession(null);
    persistObserveSession(null);
  }, [persistObserveSession]);

  React.useEffect(() => {
    if (!user?.id) {
      return;
    }
    try {
      const raw = window.localStorage.getItem(OBSERVE_SESSION_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.startedByUserId !== user.id) {
        window.localStorage.removeItem(OBSERVE_SESSION_STORAGE_KEY);
        return;
      }
      setObserveSession(parsed);
    } catch {
      // ignore restore failures
    }
  }, [user?.id]);

  React.useEffect(() => {
    if (!user?.id || !observeSession?.active) {
      return;
    }
    const courseId = observeSession.courseId;
    const hasAccess = user.isRoot() || (courseId ? user.isEditor(courseId) : false);
    if (!hasAccess) {
      clearObserveSession();
    }
  }, [clearObserveSession, observeSession, user]);

  const startObserveSession = React.useCallback(
    ({ courseId, learnerId, learnerName, learnerEmail }) => {
      if (!user?.id || !courseId || !learnerId) {
        return;
      }
      const nextSession = {
        active: true,
        courseId,
        learnerId,
        learnerName: learnerName || 'Learner',
        learnerEmail: learnerEmail || '',
        startedByUserId: user.id,
      };
      setObserveSession(nextSession);
      persistObserveSession(nextSession);
    },
    [persistObserveSession, user?.id],
  );

  return {
    observeSession,
    startObserveSession,
    exitObserveSession: clearObserveSession,
    clearObserveSession,
  };
}
