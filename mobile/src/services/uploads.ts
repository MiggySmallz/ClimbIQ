// Upload + analysis flow: create a videos row → PUT the clip straight to R2 with
// a progress bar → trigger analysis. The orchestrator only hands out presigned
// URLs; bytes go phone → R2 directly, never through it.

import {
  type AnalyzeVideoResponse,
  type CreateVideoRequest,
  type CreateVideoResponse,
} from '@climbiq/shared';
import { File, UploadType } from 'expo-file-system';

import { apiFetch, apiVoid } from '@/lib/api';

export interface ClipMeta {
  uri: string;
  durationS: number;
  width: number | null;
  height: number | null;
}

/** Byte size of the local file — must match what the presigned PUT signs. */
function fileSize(uri: string): number {
  const size = new File(uri).size;
  if (!size || size <= 0) throw new Error('empty_file');
  return size;
}

/** Register the clip, get back a presigned PUT URL. */
export async function createVideo(clip: ClipMeta): Promise<CreateVideoResponse & { size: number }> {
  const size = fileSize(clip.uri);
  const body: CreateVideoRequest = {
    duration_s: clip.durationS,
    size_bytes: size,
    width: clip.width ?? undefined,
    height: clip.height ?? undefined,
  };
  const res = await apiFetch<CreateVideoResponse>('/videos', { method: 'POST', body });
  return { ...res, size };
}

/** PUT the file straight to R2. `onProgress` gets 0..1. */
export async function uploadToR2(
  uploadUrl: string,
  fileUri: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const file = new File(fileUri);
  console.log('[R2 upload] PUT', uploadUrl.split('?')[0], 'size', file.size); // TEMP diagnostic
  let result;
  try {
    result = await file.upload(uploadUrl, {
      httpMethod: 'PUT',
      uploadType: UploadType.BINARY_CONTENT,
      onProgress: ({ bytesSent, totalBytes }) => {
        if (totalBytes > 0) onProgress(Math.min(1, bytesSent / totalBytes));
      },
    });
  } catch (e) {
    console.error('[R2 upload] threw before response:', e); // TEMP diagnostic
    throw e;
  }
  if (result.status < 200 || result.status >= 300) {
    console.error('[R2 upload] HTTP', result.status, '\nbody:', result.body); // TEMP diagnostic
    throw new Error(`upload_failed_${result.status}`);
  }
  onProgress(1);
}

/** Start the analysis job for an uploaded video. */
export async function requestAnalysis(videoId: string): Promise<AnalyzeVideoResponse> {
  return apiFetch<AnalyzeVideoResponse>(`/videos/${videoId}/analyze`, { method: 'POST' });
}

/** Re-run a failed job (same video, no re-upload). */
export async function retryAnalysis(jobId: string): Promise<AnalyzeVideoResponse> {
  return apiFetch<AnalyzeVideoResponse>(`/jobs/${jobId}/retry`, { method: 'POST' });
}

/** Discard a failed analysis run and its uploaded clip (backend clears the job
 *  row, the video, and any R2 objects). Owner-only, enforced by the orchestrator. */
export async function deleteAnalysis(jobId: string): Promise<void> {
  await apiVoid(`/jobs/${jobId}`, { method: 'DELETE' });
}

/**
 * Save an in-app recording to the device gallery (the server copy expires, this
 * is the user's permanent raw video). Returns false if permission is denied.
 */
export async function saveToGallery(fileUri: string): Promise<boolean> {
  // Lazy-import so a missing native module never breaks the upload path — this is
  // an optional convenience, not part of the critical flow.
  const { Asset, requestPermissionsAsync } = await import('expo-media-library');
  const { granted } = await requestPermissionsAsync();
  if (!granted) return false;
  await Asset.create(fileUri);
  return true;
}
