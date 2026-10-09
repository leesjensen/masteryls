// Helpers for reading an enrollment's per-topic progress entry.
//
// Completion is tracked by the `scores` map (interactionId -> percentCorrect,
// or null for unscored interaction types). Older enrollment records predate the
// `scores` map and instead carry a legacy `interactions` array of completed ids.
// These helpers read both so pre-migration records keep counting while data
// evolves toward scores-only.

/**
 * Returns the completed interaction ids for a topic's progress entry, unioning
 * the `scores` keys with any legacy `interactions` array.
 *
 * @param {object|undefined} topicProgress - enrollment.progress[topicId]
 * @returns {string[]} Completed interaction ids (deduped when both sources exist).
 */
export function completedInteractionIds(topicProgress) {
  const fromScores = topicProgress?.scores ? Object.keys(topicProgress.scores) : [];
  const fromLegacy = Array.isArray(topicProgress?.interactions) ? topicProgress.interactions : [];
  if (fromScores.length === 0) return fromLegacy;
  if (fromLegacy.length === 0) return fromScores;
  return Array.from(new Set([...fromScores, ...fromLegacy]));
}

/**
 * Returns how many interactions a topic's progress entry has completed. Prefers a precomputed
 * `completedCount` (emitted by the trimmed mastery-overview payload, where the raw `scores`/
 * `interactions` are dropped) and falls back to counting ids for a full progress entry. This
 * lets mastery be derived identically from either the trimmed list payload or a full blob.
 *
 * @param {object|undefined} topicProgress - enrollment.progress[topicId]
 * @returns {number} Completed interaction count.
 */
export function completedInteractionCount(topicProgress) {
  if (Number.isFinite(Number(topicProgress?.completedCount))) {
    return Number(topicProgress.completedCount);
  }
  return completedInteractionIds(topicProgress).length;
}

export default completedInteractionIds;
