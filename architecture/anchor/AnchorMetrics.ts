import type { CanonicalAnchor, TransitionTarget } from "./AnchorTypes";

export type TransitionMetric = {
  id: number;
  from: TransitionTarget;
  target: TransitionTarget;
  durationMs: number;
  accuracyScore?: number;
  attempt?: number;
  status: "complete" | "failed" | "cancelled";
};

const recentMetrics: TransitionMetric[] = [];
const MAX_METRICS = 100;

/** A privacy-safe 0–100 comparison of logical reading position. */
export function anchorAccuracyScore(
  expected: CanonicalAnchor,
  actual: CanonicalAnchor | null | undefined,
) {
  if (!actual || expected.documentId !== actual.documentId) return 0;
  if (expected.sourcePage !== actual.sourcePage) return 0;
  if (!expected.sourceBlockId) return 100;

  let score = 25;
  if (expected.sourceBlockId !== actual.sourceBlockId) return score;
  score += 45;

  if (
    expected.blockProgress !== undefined &&
    actual.blockProgress !== undefined
  ) {
    const error = Math.abs(expected.blockProgress - actual.blockProgress);
    score += 30 * (1 - Math.min(1, error / 0.2));
  } else if (
    expected.characterOffset !== undefined &&
    actual.characterOffset !== undefined
  ) {
    const error = Math.abs(expected.characterOffset - actual.characterOffset);
    score += 30 * (1 - Math.min(1, error / 40));
  } else {
    score += 20;
  }
  return Math.round(score);
}

export function recordTransitionMetric(metric: TransitionMetric) {
  recentMetrics.push(metric);
  if (recentMetrics.length > MAX_METRICS) recentMetrics.shift();
  if (__DEV__) console.info("[Transition Metrics]", metric);
}

export function getRecentTransitionMetrics() {
  return recentMetrics.slice();
}

export function summarizeTransitionMetrics(
  metrics: TransitionMetric[] = recentMetrics,
) {
  if (!metrics.length) {
    return { sampleSize: 0, successRate: 0, averageAccuracy: 0, p50Ms: 0, p95Ms: 0 };
  }
  const completed = metrics.filter((metric) => metric.status === "complete");
  const durations = metrics.map((metric) => metric.durationMs).sort((a, b) => a - b);
  const accuracies = completed
    .map((metric) => metric.accuracyScore)
    .filter((score): score is number => score !== undefined);
  const percentile = (fraction: number) =>
    durations[Math.min(durations.length - 1, Math.ceil(durations.length * fraction) - 1)];
  return {
    sampleSize: metrics.length,
    successRate: Math.round((completed.length / metrics.length) * 100),
    averageAccuracy: accuracies.length
      ? Math.round(accuracies.reduce((total, score) => total + score, 0) / accuracies.length)
      : 0,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
  };
}

export function resetTransitionMetrics() {
  recentMetrics.length = 0;
}
