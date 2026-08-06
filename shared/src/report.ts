// The analysis job's `result.json` contract and its structured error-JSON
// counterpart. `report.schema.json` / `error.schema.json` mirror these types
// exactly — the JSON Schema files are what the Python container and the
// orchestrator validate against; keep all three in sync by hand (additive-only).

import type { IssueKey, PositiveKey } from './reportKeys.js';

export type Severity = 'high' | 'medium' | 'low';

export interface Segment {
  start_s: number;
  end_s: number;
}

export interface Observation {
  key: IssueKey;
  severity: Severity;
  evidence: string;
  segments: Segment[];
  /** Did the LLM confirm this issue on keyframes, or downgrade it as a false positive? */
  verified: boolean;
  drill: string;
}

export interface Positive {
  key: PositiveKey;
  evidence: string;
}

export interface Scores {
  balance: number;
  footwork: number;
  grip: number;
  body_position: number;
  overall: number;
}

export interface Pipeline {
  pose_fps: number;
  frames_analyzed: number;
  duration_s: number;
}

/** `result.json` — written to `reports/{report_id}/result.json`. */
export interface AnalysisReport {
  /** Bump only for breaking shape changes; unknown versions get a client fallback. */
  version: 1;
  video_id: string;
  observations: Observation[];
  positives: Positive[];
  scores: Scores;
  /** "beta" grade estimate, e.g. "V4"; null if the heuristic has too little signal. */
  grade_estimate: string | null;
  coaching_text: string;
  llm_model: string;
  pipeline: Pipeline;
}

/**
 * `timeline.json` — the per-frame biomechanics series for the report screen's
 * chart, stored in R2 (never in the Postgres report row). Values are
 * body-scale-normalized (torso lengths) so a chart is comparable across videos;
 * `null` = not measurable that frame. Produced by timeline.py — keep in sync.
 */
export interface TimelineSeries {
  /** Sample timestamps (seconds), one per analyzed frame. */
  t_s: number[];
  hip_x_torsos: (number | null)[];
  hip_height_torsos: (number | null)[];
  elbow_angle_l_deg: (number | null)[];
  elbow_angle_r_deg: (number | null)[];
  foot_axis_l_deg: (number | null)[];
  foot_axis_r_deg: (number | null)[];
}

export interface Timeline {
  /** Bump only for breaking shape changes (mirrors report `version`). */
  version: 1;
  /** Hip-height baseline (torsos) the hip_drop rule compares against. */
  hip_baseline_torsos: number;
  series: TimelineSeries;
}

/** Which pipeline stage failed. */
export type AnalysisErrorStage =
  | 'download'
  | 'pose'
  | 'features'
  | 'llm'
  | 'render'
  | 'upload'
  | 'unknown';

/**
 * Structured error JSON PUT to `RESULT_PUT_URL` on failure, in place of a report.
 * `message` is for orchestrator logs only — never forwarded verbatim to the client.
 */
export interface AnalysisErrorResult {
  version: 1;
  video_id: string;
  error: {
    stage: AnalysisErrorStage;
    message: string;
  };
}
