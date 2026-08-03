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

export default completedInteractionIds;
