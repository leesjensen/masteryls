// Pure scoring for a Disciplinary Reasoning Assessment. Extracted from DraEvaluation so
// the same 0-100 score can be computed where progress/mastery is recorded (no React).

export const RATING_LEVELS = ['Beginning', 'Emerging', 'Developing', 'Proficient', 'Exemplary'];
export const RATING_BASE_SCORES = {
  Beginning: 0,
  Emerging: 25,
  Developing: 50,
  Proficient: 75,
  Exemplary: 100,
};

const POSITIVE_SUPPORT_VALUES = { light: 10, moderate: 20, strong: 34 };
const NEGATIVE_SUPPORT_VALUES = { light: 10, moderate: 20, strong: 30 };
const SUPPORT_CAP = 110;
const DIFFICULTY_SUPPORT_MULTIPLIERS = {
  1: 1.75,
  2: 1.4,
  3: 1.0,
  4: 0.85,
  5: 0.7,
};

// A stage counts as "contributed to" once its notes exceed this many characters.
export const DRA_ITEM_CHAR_THRESHOLD = 300;

export function getRating(entity, fallback = 'Beginning') {
  if (entity?.rating) return entity.rating;
  return fallback;
}

export function ratingToBaseScore(level) {
  return RATING_BASE_SCORES[level] ?? 0;
}

export function scoreToRatingLevel(score) {
  if (score >= 80) return 'Exemplary';
  if (score >= 60) return 'Proficient';
  if (score >= 40) return 'Developing';
  if (score >= 20) return 'Emerging';
  return 'Beginning';
}

function normalizeEvidenceItem(item) {
  if (typeof item === 'string') {
    return { detail: item, polarity: 'positive', impact: 'moderate' };
  }
  if (!item || typeof item !== 'object') {
    return { detail: '', polarity: 'positive', impact: 'moderate' };
  }

  const detail = typeof item.detail === 'string' ? item.detail : typeof item.text === 'string' ? item.text : '';
  const polarity = item.polarity === 'negative' ? 'negative' : 'positive';
  const impact = ['light', 'moderate', 'strong'].includes(item.impact) ? item.impact : 'moderate';
  return { detail, polarity, impact };
}

export function getEvidenceValue(item) {
  if (item.polarity === 'negative') {
    return -NEGATIVE_SUPPORT_VALUES[item.impact];
  }
  return POSITIVE_SUPPORT_VALUES[item.impact];
}

export function getDifficultySupportMultiplier(difficulty) {
  const normalizedDifficulty = Math.max(1, Math.min(5, Math.round(Number(difficulty) || 3)));
  return DIFFICULTY_SUPPORT_MULTIPLIERS[normalizedDifficulty] || DIFFICULTY_SUPPORT_MULTIPLIERS[3];
}

export function getEvidenceStats(items, difficulty = 3) {
  const normalized = (items || [])
    .map(normalizeEvidenceItem)
    .filter((item) => item.detail);

  const positiveSupportRaw = normalized
    .filter((item) => item.polarity === 'positive')
    .reduce((sum, item) => sum + getEvidenceValue(item), 0);
  const negativeSupport = normalized
    .filter((item) => item.polarity === 'negative')
    .reduce((sum, item) => sum + Math.abs(getEvidenceValue(item)), 0);

  const positiveSupport = Math.min(SUPPORT_CAP, positiveSupportRaw);
  const netSupport = Math.max(0, positiveSupport - negativeSupport);
  const difficultyMultiplier = getDifficultySupportMultiplier(difficulty);
  const adjustedSupport = Math.max(0, Math.min(100, netSupport * difficultyMultiplier));
  const supportFactor = adjustedSupport / 100;

  return {
    items: normalized,
    count: normalized.length,
    positiveSupport,
    negativeSupport,
    netSupport,
    adjustedSupport,
    supportFactor,
  };
}

export function calculateAttributeScore(attribute, fallbackRating, difficulty) {
  const baseScore = ratingToBaseScore(getRating(attribute, fallbackRating));
  const evidenceStats = getEvidenceStats(attribute?.evidence, difficulty);
  const supportedScore = baseScore * (0.5 + (0.5 * evidenceStats.supportFactor));
  return {
    baseScore,
    supportedScore,
    displayedLevel: scoreToRatingLevel(supportedScore),
    evidenceStats,
  };
}

export function calculateDimensionScore(dimension, difficulty) {
  const fallbackRating = getRating(dimension);
  const attributes = Array.isArray(dimension?.attributes) ? dimension.attributes : [];

  if (attributes.length === 0) {
    const baseScore = ratingToBaseScore(fallbackRating);
    return {
      summary: dimension?.summary || '',
      score: baseScore,
      displayedLevel: scoreToRatingLevel(baseScore),
      attributes: [],
      evidenceStats: { count: 0, positiveSupport: 0, negativeSupport: 0, netSupport: 0, supportFactor: 0 },
    };
  }

  const scoredAttributes = attributes.map((attribute) => ({
    ...attribute,
    calculation: calculateAttributeScore(attribute, fallbackRating, difficulty),
  }));

  const score = scoredAttributes.reduce((sum, attribute) => sum + attribute.calculation.supportedScore, 0) / scoredAttributes.length;
  const evidenceStats = scoredAttributes.reduce(
    (acc, attribute) => {
      const stats = attribute.calculation.evidenceStats;
      acc.count += stats.count;
      acc.positiveSupport += stats.positiveSupport;
      acc.negativeSupport += stats.negativeSupport;
      return acc;
    },
    { count: 0, positiveSupport: 0, negativeSupport: 0 },
  );
  evidenceStats.netSupport = Math.max(0, evidenceStats.positiveSupport - evidenceStats.negativeSupport);
  evidenceStats.adjustedSupport = Math.max(0, Math.min(100, evidenceStats.netSupport * getDifficultySupportMultiplier(difficulty)));
  evidenceStats.supportFactor = evidenceStats.adjustedSupport / 100;

  return {
    summary: dimension?.summary || '',
    score,
    displayedLevel: scoreToRatingLevel(score),
    attributes: scoredAttributes,
    evidenceStats,
  };
}

/**
 * Computes the overall 0-100 assessment score from an evaluation.
 * Process is the primary driver; Character (Competency + Disposition) scales how much of
 * the Process score counts.
 *
 * @returns {null | { rawScore: number, score: number, level: string, process, competency, disposition, characterScore: number, processMultiplier: number }}
 */
export function computeDraScore(evaluation, difficulty = 3) {
  if (!evaluation) return null;

  const process = calculateDimensionScore(evaluation.process, difficulty);
  const competency = calculateDimensionScore(evaluation.competency, difficulty);
  const disposition = calculateDimensionScore(evaluation.disposition, difficulty);
  const characterScore = (competency.score + disposition.score) / 2;
  const characterFactor = characterScore / 100;
  const processMultiplier = 0.5 + 0.5 * characterFactor;
  const rawScore = process.score * processMultiplier;

  return {
    rawScore,
    score: Math.round(rawScore),
    level: scoreToRatingLevel(rawScore),
    process,
    competency,
    disposition,
    characterScore,
    processMultiplier,
  };
}

/**
 * Number of stages the learner has written more than the threshold of characters into.
 */
export function countDraItemsCompleted(stageNotes = {}, threshold = DRA_ITEM_CHAR_THRESHOLD) {
  return Object.values(stageNotes || {}).filter((value) => typeof value === 'string' && value.trim().length > threshold).length;
}

/**
 * Rolls a single scenario run's details into the compact summary stored in
 * enrollment.progress[topicId] and used by the learner MasteryView.
 */
export function summarizeDraRun(details, difficulty) {
  const stageNotes = details?.stageNotes || {};
  const totalItems = Array.isArray(details?.stages) ? details.stages.length : Object.keys(stageNotes).length;
  const itemsCompleted = countDraItemsCompleted(stageNotes);
  const scored = details?.evaluation ? computeDraScore(details.evaluation, difficulty ?? details?.difficulty) : null;

  return {
    score: scored ? scored.score : null,
    level: scored ? scored.level : null,
    itemsCompleted,
    totalItems,
  };
}
