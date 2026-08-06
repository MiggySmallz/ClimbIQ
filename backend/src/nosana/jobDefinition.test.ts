import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateJobDefinition } from '@nosana/kit';
import type { JobDefinition } from '@nosana/kit';

import {
  assertNoSecretsInEnv,
  buildAnalysisJobDefinition,
  type BuildAnalysisJobInput,
} from './jobDefinition.js';

/** Narrow the first op's args (the builder always emits exactly one). */
function opArgs(def: JobDefinition): { image: string; gpu: boolean; env: Record<string, string> } {
  const [op] = def.ops;
  assert.ok(op, 'expected one op');
  return op.args as { image: string; gpu: boolean; env: Record<string, string> };
}

function jobParams(def: JobDefinition): Record<string, unknown> {
  const encoded = opArgs(def).env.JOB_PARAMS;
  assert.ok(encoded, 'expected JOB_PARAMS');
  // JOB_PARAMS is base64-encoded JSON (Nosana mangles raw-JSON env values).
  const raw = Buffer.from(encoded, 'base64').toString('utf-8');
  return JSON.parse(raw);
}

const baseInput: BuildAnalysisJobInput = {
  image: 'registry.example.com/climbiq-analysis:abc123',
  urls: {
    videoUrl: 'https://r2.example.com/videos/u1/v1.mp4?sig=get',
    resultPutUrl: 'https://r2.example.com/reports/r1/result.json?sig=put',
    overlayPutUrl: 'https://r2.example.com/reports/r1/overlay.mp4?sig=put',
    timelinePutUrl: 'https://r2.example.com/reports/r1/timeline.json?sig=put',
  },
  params: { video_id: 'v1', sample_fps: 3, declared_grade: 'V4' },
};

test('builds a single-op container/run GPU job on the given image', () => {
  const def = buildAnalysisJobDefinition(baseInput);
  assert.equal(def.version, '0.1');
  assert.equal(def.type, 'container');
  assert.equal(def.ops.length, 1);

  const [op] = def.ops;
  assert.ok(op);
  assert.equal(op.type, 'container/run');
  const args = opArgs(def);
  assert.equal(args.image, baseInput.image);
  assert.equal(args.gpu, true);
});

test('env carries exactly the entrypoint contract, with JOB_PARAMS as base64 JSON', () => {
  const def = buildAnalysisJobDefinition(baseInput);
  const env = opArgs(def).env;

  assert.deepEqual(Object.keys(env).sort(), [
    'JOB_PARAMS',
    'OVERLAY_PUT_URL',
    'RESULT_PUT_URL',
    'TIMELINE_PUT_URL',
    'VIDEO_URL',
  ]);
  assert.equal(env.VIDEO_URL, baseInput.urls.videoUrl);
  assert.equal(env.RESULT_PUT_URL, baseInput.urls.resultPutUrl);
  assert.equal(env.OVERLAY_PUT_URL, baseInput.urls.overlayPutUrl);
  assert.equal(env.TIMELINE_PUT_URL, baseInput.urls.timelinePutUrl);

  // JOB_PARAMS must be base64, not raw JSON — a raw `{...}` value gets mangled
  // by the Nosana node in transit to the container (regression guard).
  const encoded = env.JOB_PARAMS;
  assert.ok(encoded, 'expected JOB_PARAMS');
  assert.match(encoded, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.ok(!encoded.startsWith('{'), 'JOB_PARAMS must not be raw JSON');
  assert.deepEqual(jobParams(def), baseInput.params);
});

test('omits declared_grade from JOB_PARAMS when not provided', () => {
  const def = buildAnalysisJobDefinition({
    ...baseInput,
    params: { video_id: 'v1', sample_fps: 3 },
  });
  const parsed = jobParams(def);
  assert.equal('declared_grade' in parsed, false);
  assert.equal(parsed.video_id, 'v1');
  assert.equal(parsed.sample_fps, 3);
});

test('the built definition passes Nosana schema validation', () => {
  const def = buildAnalysisJobDefinition(baseInput);
  const result = validateJobDefinition(def);
  assert.equal(result.success, true, JSON.stringify((result as { errors?: unknown }).errors));
});

test('assertNoSecretsInEnv rejects secret-looking or unexpected keys', () => {
  assert.throws(() =>
    assertNoSecretsInEnv({ VIDEO_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'leak' }),
  );
  assert.throws(() => assertNoSecretsInEnv({ AWS_SECRET_ACCESS_KEY: 'leak' }));
  assert.doesNotThrow(() =>
    assertNoSecretsInEnv({
      VIDEO_URL: 'x',
      RESULT_PUT_URL: 'x',
      OVERLAY_PUT_URL: 'x',
      TIMELINE_PUT_URL: 'x',
      JOB_PARAMS: '{}',
    }),
  );
});
