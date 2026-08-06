import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Config } from '../config.js';
import {
  MAX_PRESIGN_SECONDS,
  createR2Client,
  presignGet,
  presignPut,
  reportOverlayKey,
  reportResultKey,
  reportTimelineKey,
  videoKey,
} from './client.js';

const config: Config = {
  port: 8080,
  logLevel: 'info',
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service-role',
  r2AccountId: 'acct123',
  r2AccessKeyId: 'AKIAEXAMPLE',
  r2SecretAccessKey: 'secretexample',
  r2Bucket: 'climbiq',
  ownerUserId: null,
  creditsAlertUsd: 5,
};

const client = createR2Client(config);

test('key builders follow the R2 layout', () => {
  assert.equal(videoKey('user-1', 'vid-1'), 'videos/user-1/vid-1.mp4');
  assert.equal(reportResultKey('rep-1'), 'reports/rep-1/result.json');
  assert.equal(reportOverlayKey('rep-1'), 'reports/rep-1/overlay.mp4');
  assert.equal(reportTimelineKey('rep-1'), 'reports/rep-1/timeline.json');
});

test('presigned URLs are path-style on the account endpoint (R2 TLS cert)', async () => {
  const url = new URL(await presignGet(client, config.r2Bucket, videoKey('u', 'v')));
  // Path-style: the account host is one level under r2.cloudflarestorage.com so
  // the *.r2.cloudflarestorage.com cert covers it; the bucket is in the path.
  assert.equal(url.hostname, 'acct123.r2.cloudflarestorage.com');
  assert.equal(url.pathname, '/climbiq/videos/u/v.mp4');
  assert.ok(url.searchParams.get('X-Amz-Signature'));
});

test('expiry is clamped to ≤1 h', async () => {
  const url = new URL(
    await presignGet(client, config.r2Bucket, reportResultKey('r'), 24 * 3600),
  );
  assert.equal(url.searchParams.get('X-Amz-Expires'), String(MAX_PRESIGN_SECONDS));
});

test('a non-positive/NaN expiry falls back to the max', async () => {
  const url = new URL(await presignGet(client, config.r2Bucket, reportResultKey('r'), 0));
  assert.equal(url.searchParams.get('X-Amz-Expires'), String(MAX_PRESIGN_SECONDS));
});

test('presignPut signs content-length when the size is known', async () => {
  const url = new URL(
    await presignPut(client, config.r2Bucket, {
      key: videoKey('u', 'v'),
      contentLength: 1_234_567,
      contentType: 'video/mp4',
    }),
  );
  const signed = url.searchParams.get('X-Amz-SignedHeaders') ?? '';
  assert.ok(
    signed.split(';').includes('content-length'),
    `expected content-length in SignedHeaders, got "${signed}"`,
  );
});

test('presignPut without a content-length does not sign one (artifact PUTs)', async () => {
  const url = new URL(await presignPut(client, config.r2Bucket, { key: reportResultKey('r') }));
  const signed = url.searchParams.get('X-Amz-SignedHeaders') ?? '';
  assert.equal(signed.split(';').includes('content-length'), false);
});
