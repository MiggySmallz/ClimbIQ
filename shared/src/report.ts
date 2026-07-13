// The analysis job's `result.json` contract (spec §10) and its structured
// error-JSON counterpart (spec §8.1). `report.schema.json` / `error.schema.json`
// mirror these types exactly — the JSON Schema files are what the Python
// container and the orchestrator both validate against; keep all three in sync
// by hand (contract changes are additive-only per spec §10).

import type { IssueKey, PositiveKey } from './reportKeys';

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

/** `result.json` — written to `reports/{report_id}/result.json`, spec §10. */
export interface AnalysisReport {
  /** Bump only for breaking shape changes; unknown versions get a client fallback (spec §10). */
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

/** Which pipeline stage failed (spec §8.1: "any failure: PUT a structured error JSON"). */
export type AnalysisErrorStage =
  | 'download'
  | 'pose'
  | 'features'
  | 'llm'
  | 'render'
  | 'upload'
  | 'unknown';

/**
 * Structured error JSON PUT to `RESULT_PUT_URL` on failure, in place of a
 * report. `message` is for orchestrator logs only — never forwarded verbatim
 * to the client (spec §3: never leak internal errors).
 */
export interface AnalysisErrorResult {
  version: 1;
  video_id: string;
  error: {
    stage: AnalysisErrorStage;
    message: string;
  };
}
