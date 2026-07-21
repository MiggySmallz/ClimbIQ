// Upload + analysis flow (spec §6, M3.15): create a videos row → PUT the clip
// straight to R2 with a progress bar → trigger analysis. The orchestrator only
// ever hands out presigned URLs; bytes go phone → R2 directly, never through it.

import {
  type AnalyzeVideoResponse,
  type CreateVideoRequest,
  type CreateVideoResponse,
} from '@climbiq/shared';
import { File, UploadType } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

import { apiFetch } from '@/lib/api';

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

/** M3.4 — register the clip, get back a presigned PUT URL. */
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
  const result = await file.upload(uploadUrl, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    onProgress: ({ bytesSent, totalBytes }) => {
      if (totalBytes > 0) onProgress(Math.min(1, bytesSent / totalBytes));
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`upload_failed_${result.status}`);
  }
  onProgress(1);
}

/** M3.5 — start the analysis job for an uploaded video. */
export async function requestAnalysis(videoId: string): Promise<AnalyzeVideoResponse> {
  return apiFetch<AnalyzeVideoResponse>(`/videos/${videoId}/analyze`, { method: 'POST' });
}

/**
 * Save an in-app recording to the device gallery (spec §6 — the server copy
 * expires, this is the user's permanent raw video). Returns false if permission
 * is denied. Throws only on unexpected failures.
 */
export async function saveToGallery(fileUri: string): Promise<boolean> {
  const { granted } = await requestPermissionsAsync();
  if (!granted) return false;
  await Asset.create(fileUri);
  return true;
}
