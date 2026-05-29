export function createCanvasCourseMembershipChecker({ makeCanvasApiRequest }) {
  const cache = new Map();

  async function isLearnerInCanvasCourse(canvasCourseId, learnerEmail) {
    const normalizedCourseId = String(canvasCourseId || '').trim();
    const normalizedLearnerEmail = String(learnerEmail || '')
      .trim()
      .toLowerCase();

    if (!normalizedCourseId || !normalizedLearnerEmail) {
      return false;
    }

    const cacheKey = `${normalizedCourseId}:${normalizedLearnerEmail}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const requestPromise = (async () => {
      try {
        const users = await makeCanvasApiRequest(`/courses/${normalizedCourseId}/search_users?search_term=${encodeURIComponent(normalizedLearnerEmail)}`);
        if (!Array.isArray(users) || users.length === 0) {
          return false;
        }

        return users.some((entry) => {
          const email = String(entry?.email || '')
            .trim()
            .toLowerCase();
          const login = String(entry?.login_id || '')
            .trim()
            .toLowerCase();
          return email === normalizedLearnerEmail || login === normalizedLearnerEmail;
        });
      } catch {
        return false;
      }
    })();

    cache.set(cacheKey, requestPromise);
    const resolved = await requestPromise;
    cache.set(cacheKey, resolved);
    return resolved;
  }

  return {
    isLearnerInCanvasCourse,
    _cache: cache,
  };
}
