// Validate a finished job's result.json and insert the reports row. The heavy
// per-frame data (overlay clip, timeline) stays in R2; the row carries the report
// contract's JSON fields + the artifact keys.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import type { AnalysisReport } from '@climbiq/shared';
// Named import: under NodeNext CJS interop ajv's default resolves to the
// namespace, so the named export is the clean one.
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { FastifyInstance } from 'fastify';

import { getObjectText, reportOverlayKey, reportResultKey, reportTimelineKey } from '../r2/client.js';

// The JSON Schema is the single source of truth; read it from the shared package
// at load time rather than duplicating it here.
const require = createRequire(import.meta.url);
const reportSchema = JSON.parse(
  readFileSync(require.resolve('@climbiq/shared/src/report.schema.json'), 'utf8'),
) as object;

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validateReport = ajv.compile(reportSchema);

export interface JobVideo {
  id: string;
  user_id: string;
  climb_id: string | null;
  r2_key: string;
}

export type IngestOutcome = 'done' | 'error';

/**
 * Download reports/{report_id}/result.json, validate it against the shared
 * schema, and insert the reports row. Returns 'error' (not throwing) for any
 * download/parse/validation/insert problem so the poller can retry or fail the
 * job. Idempotent: a duplicate insert (a retry that already landed) is 'done'.
 */
export async function ingestReport(
  app: FastifyInstance,
  reportId: string,
  video: JobVideo,
): Promise<IngestOutcome> {
  let raw: string;
  try {
    raw = await getObjectText(app.r2.client, app.r2.bucket, reportResultKey(reportId));
  } catch (err) {
    app.log.error(err, 'result.json download failed');
    return 'error';
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    // A structured error JSON or a truncated upload also lands here.
    app.log.warn({ reportId }, 'result.json is not valid JSON');
    return 'error';
  }

  if (!validateReport(data)) {
    app.log.warn({ reportId, errors: validateReport.errors }, 'result.json failed schema validation');
    return 'error';
  }
  const report = data as AnalysisReport;

  const { error } = await app.supabase.from('reports').insert({
    id: reportId,
    user_id: video.user_id,
    video_id: video.id,
    climb_id: video.climb_id,
    version: report.version,
    observations: report.observations,
    positives: report.positives,
    scores: report.scores,
    grade_estimate: report.grade_estimate ?? null,
    coaching_text: report.coaching_text,
    llm_model: report.llm_model,
    overlay_key: reportOverlayKey(reportId),
    timeline_key: reportTimelineKey(reportId),
    visibility: 'private',
  });
  if (error) {
    // Unique violation = the row already exists (idempotent poller); treat as done.
    if (error.code === '23505') return 'done';
    app.log.error(error, 'reports insert failed');
    return 'error';
  }
  return 'done';
}
