export function createCanvasCourseMembershipChecker({ checkLearnerEligibility }) {
  const cache = new Map();

  async function isLearnerInCanvasCourse(canvasCourseId, learnerEmail, catalogId) {
    const normalizedCourseId = String(canvasCourseId || '').trim();
    const normalizedLearnerEmail = String(learnerEmail || '')
      .trim()
      .toLowerCase();
    const normalizedCatalogId = String(catalogId || '').trim();

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
        const result = await checkLearnerEligibility({ courseId: normalizedCourseId, learnerEmail: normalizedLearnerEmail, catalogId: normalizedCatalogId || undefined });
        return Boolean(result?.eligible);
      } catch (ex) {
        console.error('Error occurred while checking Canvas course membership:', ex);
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
