// On-device video capture + processing for the analyze flow. All the imperative
// device/library work lives here so the screens stay presentational. Trim +
// compress + frame extraction are one native module (react-native-video-trim),
// which uses native hardware re-encoding rather than the retired ffmpeg-kit.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

/**
 * Trim/compress uses a native module (react-native-video-trim) that isn't in
 * Expo Go — only in a development/standalone build. Screens check this to show a
 * "needs a dev build" state instead of tripping a native-module invariant.
 */
export const isVideoProcessingSupported =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

// react-native-video-trim registers its TurboModule (`getEnforcing('VideoTrim')`)
// at module-evaluation time, which throws where the native binary isn't present
// (e.g. Expo Go). Load it lazily so importing this service never triggers that —
// only the functions that actually trim/compress/extract touch the native side,
// and they surface a normal error if it's missing.
type VideoTrimModule = typeof import('react-native-video-trim');
let videoTrimModule: Promise<VideoTrimModule> | null = null;
function loadVideoTrim(): Promise<VideoTrimModule> {
  if (!videoTrimModule) videoTrimModule = import('react-native-video-trim');
  return videoTrimModule;
}

/** Trimmed clips must be ≤90 s. */
export const MAX_CLIP_SECONDS = 90;
/** Source must be ≥720p on its short side. */
export const MIN_SHORT_SIDE = 720;
/** Output is capped to ≤1080p on the short side, never upscaled. */
export const MAX_OUTPUT_SHORT_SIDE = 1080;
/** Recording is limited to the max clip length up front. */
export const MAX_RECORD_SECONDS = MAX_CLIP_SECONDS;

export type VideoOrigin = 'record' | 'import';

export interface VideoSource {
  uri: string;
  durationMs: number;
  /** Pixel dimensions when known up front (image picker provides them). */
  width: number | null;
  height: number | null;
  origin: VideoOrigin;
}

export interface ProcessedClip {
  uri: string;
  durationS: number;
}

export interface PreCheckResult {
  ok: boolean;
  reason?: string;
}

/** RN's Image/expo-video need a URI scheme; native trim paths come back bare. */
function ensureFileUri(path: string): string {
  return /^[a-z]+:\/\//i.test(path) ? path : `file://${path}`;
}

/** Import a video from the library (the non-camera path). */
export async function pickVideoFromLibrary(): Promise<VideoSource | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    durationMs: asset.duration ?? 0,
    width: asset.width ?? null,
    height: asset.height ?? null,
    origin: 'import',
  };
}

/** Read a video's pixel dimensions via a full-res frame (works for recordings,
 *  which don't report dimensions). Returns null if it can't be determined. */
export async function probeDimensions(
  uri: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const { getFrameAt, deleteFile } = await loadVideoTrim();
    const { outputPath } = await getFrameAt(uri, { time: 0, maxWidth: -1, maxHeight: -1 });
    const frameUri = ensureFileUri(outputPath);
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      Image.getSize(
        frameUri,
        (width, height) => resolve({ width, height }),
        (err) => reject(err instanceof Error ? err : new Error('getSize failed')),
      );
    });
    await deleteFile(outputPath).catch(() => {});
    return dims;
  } catch {
    return null;
  }
}

/** Fallback duration probe (ms) for sources that arrive without one. */
export async function probeDuration(uri: string): Promise<number> {
  try {
    const { isValidFile } = await loadVideoTrim();
    const { duration } = await isValidFile(uri);
    return duration > 0 ? duration : 0;
  } catch {
    return 0;
  }
}

function shortSide(width: number | null, height: number | null): number | null {
  return width && height ? Math.min(width, height) : null;
}

/**
 * Validate a selected range before processing. Dimension checks are skipped when
 * dimensions are unknown — `processClip` probes and re-checks.
 */
export function preCheck(source: VideoSource, startMs: number, endMs: number): PreCheckResult {
  const durationS = (endMs - startMs) / 1000;
  if (durationS < 1) return { ok: false, reason: 'The selected clip is too short.' };
  if (durationS > MAX_CLIP_SECONDS) {
    return {
      ok: false,
      reason: `Trim to ${MAX_CLIP_SECONDS}s or less (currently ${Math.round(durationS)}s).`,
    };
  }
  const side = shortSide(source.width, source.height);
  if (side && side < MIN_SHORT_SIDE) {
    return { ok: false, reason: `Video must be at least ${MIN_SHORT_SIDE}p — this one is ${side}p.` };
  }
  return { ok: true };
}

/**
 * Trim to the selected range, then compress to ≤1080p H.264. Probes dimensions
 * first so it can enforce ≥720p and cap the output short side without upscaling.
 */
export async function processClip(
  source: VideoSource,
  startMs: number,
  endMs: number,
): Promise<ProcessedClip> {
  let { width, height } = source;
  if (!width || !height) {
    const dims = await probeDimensions(source.uri);
    if (dims) ({ width, height } = dims);
  }

  const side = shortSide(width, height);
  if (side && side < MIN_SHORT_SIDE) {
    throw new Error(`resolution_too_low:${side}`);
  }

  const { trim, compress, deleteFile } = await loadVideoTrim();
  const trimmed = await trim(source.uri, {
    startTime: Math.round(startMs),
    endTime: Math.round(endMs),
  });
  if (!trimmed.success) throw new Error('trim_failed');

  const options: { quality: string; outputExt: string; width?: number; height?: number } = {
    quality: 'medium',
    outputExt: 'mp4',
  };
  // Cap the short side to ≤1080 without upscaling. For portrait (w ≤ h) the
  // short side is the width; for landscape it's the height.
  if (side && side > MAX_OUTPUT_SHORT_SIDE && width && height) {
    if (width <= height) options.width = MAX_OUTPUT_SHORT_SIDE;
    else options.height = MAX_OUTPUT_SHORT_SIDE;
  }

  const compressed = await compress(trimmed.outputPath, options);
  await deleteFile(trimmed.outputPath).catch(() => {});

  return { uri: ensureFileUri(compressed.outputPath), durationS: (endMs - startMs) / 1000 };
}
