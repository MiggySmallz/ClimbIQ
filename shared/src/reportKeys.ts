// Stable observation-key vocabulary. Additive-only: adding a key is safe,
// renaming or removing one breaks progress-over-time tracking and every report
// that already references it.

/**
 * Issue keys — rule-detected problems. Each is documented with the rule that
 * flags it; the rule decides *what* was detected, the LLM only verifies/enriches.
 */
export const ISSUE_KEYS = [
  // Lateral hip travel exceeds a body-scale-normalized threshold during a move.
  'barn_door',
  // Hip height drops below the 90th-percentile baseline (first 2s of detected climbing).
  'hip_drop',
  // Elbow stays flexed through a static hang (wasted energy) instead of a
  // straight-arm skeleton hang.
  'bent_arm_hang',
  // DIP hyperextension on a held hold — full-crimp injury risk.
  'full_crimp_risk',
  // Heel-toe axis angle doesn't match any clean contact class (heel-hook/toe-hook/smear/edge).
  'poor_foot_contact',
] as const;

/**
 * Positive keys — good technique the rules can also detect. Kept in a
 * separate enum from ISSUE_KEYS because not every key makes sense on both
 * sides (e.g. a clean heel-hook has no corresponding "issue").
 */
export const POSITIVE_KEYS = [
  // Heel-toe axis angle matches the heel-hook contact class.
  'heel_hook',
] as const;

export type IssueKey = (typeof ISSUE_KEYS)[number];
export type PositiveKey = (typeof POSITIVE_KEYS)[number];
