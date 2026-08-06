// Cloudflare R2 presigned-URL client. R2 speaks the S3 API, so we use the AWS SDK
// v3 S3 client + presigner against R2's account-scoped endpoint (region "auto").
// The orchestrator never proxies bytes: the phone PUTs its clip straight to R2,
// the Nosana job GETs the video and PUTs its artifacts, the report screen GETs
// them — all via short-lived presigned URLs issued here.
//
// SECURITY: job-facing URLs live in a public-IPFS job definition, so every URL is
// scoped to a single object and capped at ≤1 h expiry (MAX_PRESIGN_SECONDS). When
// the byte count is known up front (the phone upload) we also sign Content-Length
// so a leaked URL can't upload a larger object.

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Third arg of getSignedUrl (the package doesn't re-export the type by name). */
type PresignOptions = NonNullable<Parameters<typeof getSignedUrl>[2]>;

import type { Config } from '../config.js';

/** Hard cap on any presigned-URL lifetime (≤1 h on job-facing URLs). */
export const MAX_PRESIGN_SECONDS = 3600;

/** Build an S3 client pointed at the account's R2 endpoint. */
export function createR2Client(config: Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    // Path-style, NOT virtual-hosted. R2's TLS cert is a single-level wildcard
    // (*.r2.cloudflarestorage.com), so a <bucket>.<account>.r2… host fails the
    // TLS handshake on strict clients (e.g. the mobile app's BoringSSL).
    forcePathStyle: true,
    // AWS SDK v3 (≥3.729) adds a default CRC32 request checksum to PutObject,
    // making the presigned PUT require an x-amz-checksum-crc32 header the
    // uploading client never sends (R2 then 403s). WHEN_REQUIRED restores the
    // older behavior: checksum only when the operation mandates it.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });
}

// --- Key layout -----------------------------------------------------------
// videos/{user_id}/{video_id}.mp4         (expiring — retention sweep)
// reports/{report_id}/overlay.mp4         (permanent)
// reports/{report_id}/timeline.json       (permanent)
// reports/{report_id}/result.json         (permanent)

/** Source video object key. */
export function videoKey(userId: string, videoId: string): string {
  return `videos/${userId}/${videoId}.mp4`;
}

/** Report artifact keys. `reportId` is pre-allocated at job-post time so the
 *  job can PUT to the final location before the reports row exists. */
export function reportResultKey(reportId: string): string {
  return `reports/${reportId}/result.json`;
}
export function reportOverlayKey(reportId: string): string {
  return `reports/${reportId}/overlay.mp4`;
}
export function reportTimelineKey(reportId: string): string {
  return `reports/${reportId}/timeline.json`;
}

/** Clamp any requested lifetime into (0, MAX_PRESIGN_SECONDS]. */
function clampExpiry(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return MAX_PRESIGN_SECONDS;
  return Math.min(Math.floor(seconds), MAX_PRESIGN_SECONDS);
}

export interface PresignPutInput {
  key: string;
  /**
   * Exact byte count to sign into the URL. Provide it whenever the size is known
   * (the phone upload) so the URL can't upload a larger object. Omit it for
   * container-generated artifacts, whose size isn't known at post time — those
   * rely on single-object scope + short expiry instead.
   */
  contentLength?: number;
  contentType?: string;
  /** Defaults to (and is capped at) MAX_PRESIGN_SECONDS. */
  expiresIn?: number;
}

/** Presigned PUT URL for a single object. */
export function presignPut(
  client: S3Client,
  bucket: string,
  { key, contentLength, contentType, expiresIn = MAX_PRESIGN_SECONDS }: PresignPutInput,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentLength: contentLength,
    ContentType: contentType,
  });

  const options: PresignOptions = { expiresIn: clampExpiry(expiresIn) };
  // Force Content-Length to be part of the signature (and keep it out of the
  // query string) so the uploading client must send exactly this many bytes.
  if (contentLength !== undefined) {
    options.signableHeaders = new Set(['content-length']);
    options.unhoistableHeaders = new Set(['content-length']);
  }

  return getSignedUrl(client, command, options);
}

/** HEAD an object; returns its byte size, or null if it doesn't exist. Used to
 *  confirm an upload actually landed before posting a job. */
export async function headObject(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<{ contentLength: number } | null> {
  try {
    const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { contentLength: res.ContentLength ?? 0 };
  } catch (err) {
    // S3/R2 signals a missing object with a 404 / NotFound / NoSuchKey.
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    const name = (err as { name?: string }).name;
    if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') return null;
    throw err;
  }
}

/** Download an object's body as text (server-side, no presign needed). Used by
 *  the poller to read result.json. */
export async function getObjectText(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<string> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error('empty object body');
  return res.Body.transformToString();
}

/** Delete a single object. Idempotent — S3/R2 returns success for a missing key,
 *  so the retention sweep can safely re-run. */
export async function deleteObject(client: S3Client, bucket: string, key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** All object keys under a prefix (paginated). Used by account deletion to sweep
 *  everything a user owns, including orphans not tracked in Postgres. */
export async function listObjectKeys(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const obj of res.Contents ?? []) if (obj.Key) keys.push(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Delete many objects (chunked to the S3 1000-key-per-request limit). No-op on
 *  an empty list. Idempotent, like deleteObject. */
export async function deleteObjects(
  client: S3Client,
  bucket: string,
  keys: string[],
): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

/** Presigned GET URL for a single object. */
export function presignGet(
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number = MAX_PRESIGN_SECONDS,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: clampExpiry(expiresIn) });
}
