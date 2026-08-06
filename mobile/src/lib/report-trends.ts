// Technique-progress aggregation. Pure functions over the user's stored `reports`
// rows. The stable `observations[].key` vocabulary is what makes progress-over-
// time possible: a key means the same thing across every report.

import type { Observation, Scores } from '@climbiq/shared';

/** The slice of a report row the progress screen needs. */
export interface TrendReport {
  id: string;
  created_at: string;
  observations: Observation[];
  scores: Scores;
  /** "beta" grade estimate, e.g. "V4"; null when the heuristic had too little signal. */
  grade_estimate: string | null;
}

export interface TrendPoint {
  /** Short date label, e.g. "Mar 3". */
  label: string;
  value: number;
}

export interface IssueTrend {
  key: string;
  /** One point per report in the window (oldest → newest). */
  points: TrendPoint[];
  /** Severity in the most recent report (0 = clear), for "worst now" ordering. */
  latest: number;
}

const SEVERITY_VALUE: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** Human label for a severity value 0–3 (matches SEVERITY_VALUE). */
export function severityWord(value: number): string {
  if (value >= 3) return 'High';
  if (value === 2) return 'Medium';
  if (value === 1) return 'Low';
  return 'Clear';
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/** Overall technique score (0–100) across the window (oldest → newest). */
export function overallScoreTrend(reports: TrendReport[]): TrendPoint[] {
  return reports.map((r) => ({ label: dateLabel(r.created_at), value: r.scores.overall }));
}

/**
 * Per-issue severity trend: for every issue *verified* in at least one report in
 * the window, a value per report (0 = not flagged / dismissed that climb, else
 * severity 1–3). Only verified observations count. Sorted worst-now first.
 */
export function issueSeverityTrends(reports: TrendReport[]): IssueTrend[] {
  const keys = new Set<string>();
  const perReport = reports.map((r) => {
    const m = new Map<string, number>();
    for (const o of r.observations) {
      if (!o.verified) continue;
      keys.add(o.key);
      const v = SEVERITY_VALUE[o.severity] ?? 0;
      if (v > (m.get(o.key) ?? 0)) m.set(o.key, v); // keep worst if duplicated
    }
    return m;
  });

  const trends: IssueTrend[] = [];
  for (const key of keys) {
    const points = reports.map((r, i) => ({
      label: dateLabel(r.created_at),
      value: perReport[i].get(key) ?? 0,
    }));
    trends.push({ key, points, latest: points[points.length - 1]?.value ?? 0 });
  }

  const windowSum = (t: IssueTrend): number => t.points.reduce((s, p) => s + p.value, 0);
  trends.sort((a, b) => b.latest - a.latest || windowSum(b) - windowSum(a));
  return trends;
}
