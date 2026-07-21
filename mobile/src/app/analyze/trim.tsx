import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { useLocalSearchParams, router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TrimRange } from '@/components/trim-range';
import { useTheme } from '@/hooks/use-theme';
import { createVideo, requestAnalysis, saveToGallery, uploadToR2 } from '@/services/uploads';
import {
  extractThumbnails,
  isVideoProcessingSupported,
  MAX_CLIP_SECONDS,
  MIN_SHORT_SIDE,
  preCheck,
  probeDuration,
  processClip,
  type ProcessedClip,
  type VideoOrigin,
  type VideoSource,
} from '@/services/video';

type Status = 'loading' | 'ready' | 'error' | 'processing' | 'done' | 'unsupported';

export default function TrimScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    uri: string;
    durationMs: string;
    width: string;
    height: string;
    origin: string;
  }>();
  const uri = params.uri;
  const width = params.width ? Number(params.width) : null;
  const height = params.height ? Number(params.height) : null;
  const origin = (params.origin as VideoOrigin) ?? 'import';

  const [status, setStatus] = useState<Status>(
    isVideoProcessingSupported ? 'loading' : 'unsupported',
  );
  const [durationMs, setDurationMs] = useState(Number(params.durationMs) || 0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [result, setResult] = useState<ProcessedClip | null>(null);

  useEffect(() => {
    if (!isVideoProcessingSupported) return;
    let cancelled = false;
    (async () => {
      let dur = Number(params.durationMs) || 0;
      if (dur <= 0) dur = await probeDuration(uri);
      if (dur <= 0) throw new Error('no_duration');
      const thumbs = await extractThumbnails(uri, dur);
      if (cancelled) return;
      setDurationMs(dur);
      setEndMs(dur);
      setThumbnails(thumbs);
      setStatus('ready');
    })().catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [uri, params.durationMs]);

  const source: VideoSource = { uri, durationMs, width, height, origin };
  const selectedS = (endMs - startMs) / 1000;

  async function confirm() {
    const check = preCheck(source, startMs, endMs);
    if (!check.ok) {
      Alert.alert('Trim', check.reason);
      return;
    }
    setStatus('processing');
    try {
      const clip = await processClip(source, startMs, endMs);
      setResult(clip);
      setStatus('done');
    } catch (e) {
      setStatus('ready');
      const msg = e instanceof Error ? e.message : '';
      Alert.alert(
        'Trim',
        msg.startsWith('resolution_too_low')
          ? `This video is below ${MIN_SHORT_SIDE}p, too low to analyze.`
          : "Couldn't process that clip. Try again.",
      );
    }
  }

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <ThemedText themeColor="textSecondary" type="small">
          Preparing your clip…
        </ThemedText>
      </View>
    );
  }

  if (status === 'unsupported') {
    return (
      <View style={styles.center}>
        <Ionicons name="construct-outline" size={40} color="#8B8D98" />
        <ThemedText style={styles.title}>Trimming needs a dev build</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Video trim &amp; compress use a native module that isn&apos;t in Expo Go. Run a
          development build (`expo run:android` or an EAS dev build) to use this screen.
        </ThemedText>
        <Pressable style={styles.primary} onPress={() => router.back()}>
          <Text style={styles.primaryText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color="#8B8D98" />
        <ThemedText style={styles.title}>Couldn&apos;t open that video</ThemedText>
        <Pressable style={styles.primary} onPress={() => router.back()}>
          <Text style={styles.primaryText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'done' && result) {
    return <ReadyState clip={result} width={width} height={height} origin={origin} />;
  }

  const processing = status === 'processing';

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <ThemedText style={styles.title}>Trim your climb</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Cut to the good part — from the pull-on to the top-out. Shorter clips analyze faster.
        </ThemedText>

        <View style={styles.rangeBlock}>
          <TrimRange
            thumbnails={thumbnails}
            durationMs={durationMs}
            startMs={startMs}
            endMs={endMs}
            onChange={(s, e) => {
              setStartMs(s);
              setEndMs(e);
            }}
          />
          <View style={styles.readout}>
            <ThemedText themeColor="textSecondary" type="small">
              {formatTime(startMs / 1000)} – {formatTime(endMs / 1000)}
            </ThemedText>
            <ThemedText
              type="smallBold"
              style={{ color: selectedS > MAX_CLIP_SECONDS ? '#E5484D' : theme.text }}>
              {Math.round(selectedS)}s selected
            </ThemedText>
          </View>
        </View>
      </View>

      <Pressable
        style={[styles.primary, processing && styles.primaryDisabled]}
        onPress={confirm}
        disabled={processing}>
        {processing ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.primaryText}>Processing…</Text>
          </>
        ) : (
          <Text style={styles.primaryText}>Use this clip</Text>
        )}
      </Pressable>
    </View>
  );
}

type UploadPhase = 'preview' | 'uploading' | 'starting' | 'started' | 'error';

/**
 * Terminal state: preview the trimmed+compressed clip, then upload it straight to
 * R2 with a progress bar and start the analysis job (spec §6, M3.15). The
 * job-status realtime screen (M3.16) takes over from the "started" state.
 */
function ReadyState({
  clip,
  width,
  height,
  origin,
}: {
  clip: ProcessedClip;
  width: number | null;
  height: number | null;
  origin: VideoOrigin;
}) {
  const theme = useTheme();
  const player = useVideoPlayer(clip.uri, (p) => {
    p.loop = true;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  const [phase, setPhase] = useState<UploadPhase>('preview');
  const [progress, setProgress] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function startAnalysis() {
    try {
      let id = videoId;
      if (!id) {
        setPhase('uploading');
        setProgress(0);
        const created = await createVideo({
          uri: clip.uri,
          durationS: clip.durationS,
          width,
          height,
        });
        await uploadToR2(created.upload_url, clip.uri, setProgress);
        id = created.video_id;
        setVideoId(id); // keep it so a retry re-triggers analysis without re-uploading
      }
      setPhase('starting');
      await requestAnalysis(id);
      setPhase('started');
    } catch {
      setPhase('error');
    }
  }

  async function save() {
    try {
      const ok = await saveToGallery(clip.uri);
      if (ok) setSaved(true);
      else Alert.alert('Save', 'Allow photo access to save this clip to your gallery.');
    } catch {
      Alert.alert('Save', "Couldn't save this clip to your gallery.");
    }
  }

  const busy = phase === 'uploading' || phase === 'starting';

  if (phase === 'started') {
    return (
      <View style={styles.container}>
        <View style={styles.body}>
          <View style={styles.readyHeader}>
            <Ionicons name="checkmark-circle" size={24} color="#30A46C" />
            <ThemedText style={styles.title}>Analysis started</ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            We&apos;ll notify you when your coaching report is ready. First analyses can take a
            little longer while a GPU spins up.
          </ThemedText>
          {origin === 'record' && (
            <Pressable
              style={[styles.secondary, { borderColor: theme.textSecondary }]}
              onPress={save}
              disabled={saved}>
              <Ionicons
                name={saved ? 'checkmark' : 'download-outline'}
                size={20}
                color={theme.text}
              />
              <ThemedText style={styles.secondaryText}>
                {saved ? 'Saved to gallery' : 'Save clip to gallery'}
              </ThemedText>
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.primary, { backgroundColor: theme.backgroundSelected }]}
          onPress={() => router.replace('/(tabs)/analyze')}>
          <Text style={[styles.primaryText, { color: theme.text }]}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <View style={styles.readyHeader}>
          <Ionicons name="checkmark-circle" size={24} color="#30A46C" />
          <ThemedText style={styles.title}>Clip ready</ThemedText>
        </View>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Trimmed to {Math.round(clip.durationS)}s and compressed to ≤1080p.
        </ThemedText>

        <Pressable onPress={() => (isPlaying ? player.pause() : player.play())}>
          <VideoView
            player={player}
            style={styles.preview}
            contentFit="contain"
            nativeControls={false}
          />
        </Pressable>

        {phase === 'uploading' && (
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <ThemedText themeColor="textSecondary" type="small">
              Uploading… {Math.round(progress * 100)}%
            </ThemedText>
          </View>
        )}

        {phase === 'error' && (
          <ThemedText type="small" style={styles.errorText}>
            {videoId
              ? "Uploaded, but we couldn't start the analysis. Try again."
              : "Couldn't upload that clip. Check your connection and try again."}
          </ThemedText>
        )}
      </View>

      <Pressable
        style={[styles.primary, busy && styles.primaryDisabled]}
        onPress={startAnalysis}
        disabled={busy}>
        {busy ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.primaryText}>
              {phase === 'starting' ? 'Starting…' : 'Uploading…'}
            </Text>
          </>
        ) : (
          <Text style={styles.primaryText}>
            {phase === 'error' ? 'Try again' : 'Analyze this clip'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  body: { gap: 12 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  hint: { fontSize: 15 },
  rangeBlock: { gap: 8, marginTop: 12 },
  readout: { flexDirection: 'row', justifyContent: 'space-between' },
  readyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { width: '100%', height: 320, borderRadius: 12, backgroundColor: '#000', marginTop: 8 },
  progressBlock: { gap: 6, marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#00000022', overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: '#208AEF' },
  errorText: { color: '#E5484D', marginTop: 4 },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  secondaryText: { fontSize: 16, fontWeight: '600' },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
  },
  primaryDisabled: { opacity: 0.7 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
