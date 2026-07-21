import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { useLocalSearchParams, router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TrimRange } from '@/components/trim-range';
import { useTheme } from '@/hooks/use-theme';
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
    return <ReadyState clip={result} />;
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

/**
 * Interim terminal state: the clip is trimmed + compressed locally, but upload
 * and analysis (M3.15+) are blocked on R2/the orchestrator. Honest, not a fake
 * "analyzing" spinner.
 */
function ReadyState({ clip }: { clip: ProcessedClip }) {
  const theme = useTheme();
  const player = useVideoPlayer(clip.uri, (p) => {
    p.loop = true;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <View style={styles.readyHeader}>
          <Ionicons name="checkmark-circle" size={24} color="#30A46C" />
          <ThemedText style={styles.title}>Clip ready</ThemedText>
        </View>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Trimmed to {Math.round(clip.durationS)}s and compressed to ≤1080p. Upload and analysis
          turn on once the backend is connected.
        </ThemedText>

        <Pressable onPress={() => (isPlaying ? player.pause() : player.play())}>
          <VideoView
            player={player}
            style={styles.preview}
            contentFit="contain"
            nativeControls={false}
          />
        </Pressable>
      </View>

      <Pressable
        style={[styles.primary, { backgroundColor: theme.backgroundSelected }]}
        onPress={() => router.back()}>
        <Text style={[styles.primaryText, { color: theme.text }]}>Done</Text>
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
