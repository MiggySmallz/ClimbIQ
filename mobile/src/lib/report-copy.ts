// Presentation metadata for the report contract. The stable key vocabulary and
// its detection rules live in `@climbiq/shared`; the human-facing labels/colors
// stay here. An unknown key falls back to a de-cased label so a newer report
// never renders a blank card on an older app.

import type { IssueKey, PositiveKey, Severity } from '@climbiq/shared';

const ISSUE_LABELS: Record<IssueKey, string> = {
  barn_door: 'Barn door',
  hip_drop: 'Hip drop',
  bent_arm_hang: 'Bent-arm hang',
  full_crimp_risk: 'Full-crimp risk',
  poor_foot_contact: 'Poor foot contact',
};

const POSITIVE_LABELS: Record<PositiveKey, string> = {
  heel_hook: 'Heel hook',
};

/** De-case an unknown key (`some_new_key` → `Some new key`) as a safe fallback. */
function fallbackLabel(key: string): string {
  const spaced = key.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function issueLabel(key: string): string {
  return ISSUE_LABELS[key as IssueKey] ?? fallbackLabel(key);
}

export function positiveLabel(key: string): string {
  return POSITIVE_LABELS[key as PositiveKey] ?? fallbackLabel(key);
}

export interface SeverityStyle {
  label: string;
  /** Accent used for the card's severity stripe/badge. */
  color: string;
  /** Tinted background for the badge. */
  bg: string;
}

export const SEVERITY_STYLES: Record<Severity, SeverityStyle> = {
  high: { label: 'High', color: '#E5484D', bg: 'rgba(229,72,77,0.14)' },
  medium: { label: 'Medium', color: '#F5A623', bg: 'rgba(245,166,35,0.16)' },
  low: { label: 'Low', color: '#30A46C', bg: 'rgba(48,164,108,0.14)' },
};

export function severityStyle(severity: Severity): SeverityStyle {
  return SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low;
}

/** Score-category display order + labels. */
export const SCORE_CATEGORIES: { key: 'balance' | 'footwork' | 'grip' | 'body_position'; label: string }[] =
  [
    { key: 'balance', label: 'Balance' },
    { key: 'footwork', label: 'Footwork' },
    { key: 'grip', label: 'Grip' },
    { key: 'body_position', label: 'Body position' },
  ];

/** A 0–100 score → an accent color (red/amber/green band). */
export function scoreColor(value: number): string {
  if (value >= 80) return '#30A46C';
  if (value >= 60) return '#F5A623';
  return '#E5484D';
}
