import type { Climb } from '@climbiq/shared';

export interface GradeCount {
  grade: string;
  count: number;
}

export interface MonthCount {
  /** e.g. "Mar" */
  label: string;
  count: number;
}

const GRADE_ORDER = ['VB', ...Array.from({ length: 16 }, (_, i) => `V${i}`)];

/** Sent climbs per grade, in V-scale order, zero-count grades omitted. */
export function gradePyramid(climbs: Climb[]): GradeCount[] {
  const counts = new Map<string, number>();
  for (const c of climbs) {
    if (c.sent && c.grade) counts.set(c.grade, (counts.get(c.grade) ?? 0) + 1);
  }
  return GRADE_ORDER.filter((g) => counts.has(g)).map((g) => ({
    grade: g,
    count: counts.get(g) ?? 0,
  }));
}

/** Sends per calendar month for the trailing `months` months (oldest first). */
export function sendsPerMonth(climbs: Climb[], months = 6, now = new Date()): MonthCount[] {
  const buckets: { key: string; label: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en', { month: 'short' }),
      count: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const c of climbs) {
    if (!c.sent) continue;
    const bucket = byKey.get(c.attempted_at.slice(0, 7));
    if (bucket) bucket.count += 1;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}

export function totals(climbs: Climb[]): { sends: number; attempts: number } {
  let sends = 0;
  for (const c of climbs) if (c.sent) sends++;
  return { sends, attempts: climbs.length - sends };
}
