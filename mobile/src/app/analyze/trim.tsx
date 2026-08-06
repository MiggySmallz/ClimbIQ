import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { Button, Card, NavBar, ProgressBar, Screen, Txt } from '@/components/ui';
import { radius } from '@/constants/design';
import { TrimRange } from '@/components/trim-range';
import { useTheme } from '@/hooks/use-theme';
import { createVideo, requestAnalysis, saveToGallery, uploadToR2 } from '@/services/uploads';
import {
  isVideoProcessingSupported,
  MAX_CLIP_SECONDS,
  MIN_SHORT_SIDE,
  preCheck,
  probeDuration,
  processClip,
  type VideoOrigin,
  type VideoSource,
} from '@/services/video';

/** Load state → then the analyze flow phases, all on one screen (design 10 / 10a–c). */
type Stage = 'loading' | 'unsupported' | 'loaderror' | 'trim' | 'processing' | 'uploading' | 'starting' | 'error' | 'started';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

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

  const [stage, setStage] = useState<Stage>(isVideoProcessingSupported ? 'loading' : 'unsupported');
  const [durationMs, setDurationMs] = useState(Number(params.durationMs) || 0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [saveIntent, setSaveIntent] = useState(origin === 'record');
  const [savedToGallery, setSavedToGallery] = useState(false);

  // Live preview: dragging an edge seeks this player so the user sees the exact
  // in/out frame. Muted; a tap previews the selected range.
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.timeUpdateEventInterval = 0.2;
  });
  const [previewing, setPreviewing] = useState(false);
  const lastSeekAt = useRef(0);

  useEffect(() => {
    if (!isVideoProcessingSupported) return;
    let cancelled = false;
    (async () => {
      let dur = Number(params.durationMs) || 0;
      if (dur <= 0) dur = await probeDuration(uri);
      if (dur <= 0) throw new Error('no_duration');
      if (cancelled) return;
      setDurationMs(dur);
      setEndMs(dur);
      setStage('trim');
    })().catch(() => {
      if (!cancelled) setStage('loaderror');
    });
    return () => {
      cancelled = true;
    };
  }, [uri, params.durationMs]);

  const selectedS = (endMs - startMs) / 1000;
  const tooLong = selectedS > MAX_CLIP_SECONDS;

  function seekTo(ms: number) {
    player.seekBy(ms / 1000 - player.currentTime);
  }
  function handleScrub(ms: number) {
    if (previewing) {
      player.pause();
      setPreviewing(false);
    }
    const now = Date.now();
    if (now - lastSeekAt.current < 90) return;
    lastSeekAt.current = now;
    seekTo(ms);
  }
  function handleScrubEnd(ms: number) {
    seekTo(ms);
  }
  function togglePreview() {
    if (previewing) {
      player.pause();
      setPreviewing(false);
    } else {
      seekTo(startMs);
      player.play();
      setPreviewing(true);
    }
  }

  useEffect(() => {
    if (!previewing) return;
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      if (currentTime * 1000 >= endMs) {
        player.pause();
        player.seekBy(startMs / 1000 - currentTime);
        setPreviewing(false);
      }
    });
    return () => sub.remove();
  }, [player, previewing, startMs, endMs]);

  // The whole flow: process (trim/compress) → upload to R2 → request analysis.
  // Resumable: a set videoId means the clip is already uploaded, so a retry only
  // re-requests analysis (never re-uploads).
  async function runAnalyze() {
    setRangeError(null);
    // Prefer the player's real track size — recordings arrive without dimensions,
    // and the frame-extraction probe in processClip is a last resort. Params
    // (from the image picker) win when present.
    const trackSize = player.videoTrack?.size;
    const source: VideoSource = {
      uri,
      durationMs,
      width: width ?? trackSize?.width ?? null,
      height: height ?? trackSize?.height ?? null,
      origin,
    };
    if (!videoId) {
      const check = preCheck(source, startMs, endMs);
      if (!check.ok) {
        setRangeError(check.reason ?? "That trim range won't work — adjust the ends.");
        return;
      }
    }
    try {
      let id = videoId;
      if (!id) {
        player.pause();
        setPreviewing(false);
        setStage('processing');
        const clip = await processClip(source, startMs, endMs);
        if (origin === 'record' && saveIntent) {
          try {
            const ok = await saveToGallery(clip.uri);
            setSavedToGallery(ok);
          } catch {
            /* gallery save is best-effort */
          }
        }
        setStage('uploading');
        setProgress(0);
        const created = await createVideo({ uri: clip.uri, durationS: clip.durationS, width, height });
        await uploadToR2(created.upload_url, clip.uri, setProgress);
        id = created.video_id;
        setVideoId(id);
      }
      setStage('starting');
      const { job_id } = await requestAnalysis(id);
      setJobId(job_id);
      setStage('started');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.startsWith('resolution_too_low')) {
        setStage('trim');
        setRangeError(`This video is below ${MIN_SHORT_SIDE}p — too low to analyze.`);
      } else {
        setStage('error');
      }
    }
  }

  // ---------- Load states ----------
  if (stage === 'loading') {
    return (
      <Screen edges={['top']}>
        <NavBar title="Trim clip" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Txt weight={600} size={14} color="ink2">
            Opening your clip…
          </Txt>
        </View>
      </Screen>
    );
  }
  if (stage === 'unsupported' || stage === 'loaderror') {
    return (
      <Screen edges={['top']} padded={20}>
        <NavBar title="Trim clip" onBack={() => router.back()} />
        <Card pad={24} style={{ gap: 12, marginTop: 8 }}>
          <Txt weight={700} size={18} tracking={-0.3}>
            {stage === 'unsupported' ? 'Trimming needs a dev build' : "Couldn't open that video"}
          </Txt>
          <Txt weight={500} size={13} lh={20} color="ink2">
            {stage === 'unsupported'
              ? "Video trim & compress use a native module that isn't in Expo Go. Run a development build to use this screen."
              : 'The file may be corrupt or in an unsupported format. Pick another clip.'}
          </Txt>
          <Button label="Go back" variant="ink" size="md" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  // ---------- Started hand-off (design 10c) ----------
  if (stage === 'started') {
    return (
      <Screen edges={['top']} padded={20}>
        <NavBar title="Trim clip" />
        <Card pad={24} style={{ alignItems: 'center', gap: 12, marginTop: 8 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: theme.good,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="checkmark" size={26} color="#fff" />
          </View>
          <Txt weight={700} size={19} tracking={-0.4}>
            Clip is in the queue
          </Txt>
          <Txt weight={500} size={14} lh={21} color="ink2" style={{ textAlign: 'center' }}>
            You can close the app. We&apos;ll notify you the moment the report is ready.
          </Txt>
          {savedToGallery ? (
            <Txt weight={600} size={12} color="good">
              ✓ Saved to your gallery
            </Txt>
          ) : null}
          <Button
            label="Watch progress"
            variant="ink"
            onPress={() =>
              jobId
                ? router.replace({ pathname: '/analyze/status', params: { jobId } })
                : router.replace('/(tabs)/analyze')
            }
            style={{ marginTop: 4 }}
          />
          <Txt weight={700} size={13} color="ink2" onPress={() => router.replace('/(tabs)/analyze')}>
            Analyze another clip
          </Txt>
        </Card>
      </Screen>
    );
  }

  // ---------- Uploading / processing (design 10a) ----------
  if (stage === 'processing' || stage === 'uploading' || stage === 'starting') {
    const pct = stage === 'uploading' ? Math.round(progress * 100) : stage === 'starting' ? 100 : 0;
    const label = stage === 'processing' ? 'Preparing clip' : stage === 'starting' ? 'Starting analysis' : 'Uploading clip';
    return (
      <Screen edges={['top']} padded={20}>
        <NavBar title="Trim clip" />
        <Card pad={22} style={{ gap: 12, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Txt weight={700} size={15}>
              {label}
            </Txt>
            {stage === 'uploading' ? (
              <Txt font="mono" weight={700} size={15} color="accent">
                {pct}%
              </Txt>
            ) : null}
          </View>
          <ProgressBar value={stage === 'uploading' ? progress : stage === 'starting' ? 1 : 0.15} color={theme.accent} gradientTo={theme.accent2} />
          <Txt weight={600} size={12} color="ink2">
            {stage === 'processing'
              ? 'Trimming and compressing your clip…'
              : stage === 'starting'
                ? 'Handing the clip to a GPU node…'
                : 'Keep the app open until this finishes.'}
          </Txt>
        </Card>
      </Screen>
    );
  }

  // ---------- Upload/analyze error (design 10b) ----------
  if (stage === 'error') {
    return (
      <Screen edges={['top']} padded={20}>
        <NavBar title="Trim clip" onBack={() => router.back()} />
        <Card pad={22} style={{ gap: 12, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: 'rgba(224,50,42,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="alert" size={16} color={theme.bad} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt weight={700} size={15}>
                {videoId ? "Couldn't start the analysis" : 'Upload failed'}
              </Txt>
              <Txt weight={500} size={12} lh={18} color="ink2">
                {videoId
                  ? 'Your clip is uploaded and kept — resume to start the analysis.'
                  : 'Network dropped. The trim is kept — resume when you have signal.'}
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Resume" size="md" onPress={runAnalyze} />
            <Button label="Discard" variant="secondary" size="md" onPress={() => router.back()} />
          </View>
        </Card>
      </Screen>
    );
  }

  // ---------- Trim (design 10) ----------
  return (
    <Screen edges={['top']}>
      <NavBar title="Trim clip" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        <Pressable onPress={togglePreview} style={{ borderRadius: radius.xl, overflow: 'hidden', aspectRatio: 9 / 13, backgroundColor: '#171b22' }}>
          <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls={false} />
          {!previewing ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
              <View
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 31,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="play" size={26} color="#111" style={{ marginLeft: 3 }} />
              </View>
            </View>
          ) : null}
          <View style={{ position: 'absolute', left: 14, top: 14, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Txt font="mono" weight={700} size={11} color="#fff">
              {origin === 'record' ? 'RECORDED' : 'IMPORTED'}
            </Txt>
          </View>
          <View style={{ position: 'absolute', right: 14, bottom: 14, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Txt font="mono" weight={700} size={11} color="#fff">
              {formatTime(selectedS)} / {formatTime(durationMs / 1000)}
            </Txt>
          </View>
        </Pressable>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Txt weight={700} size={11} tracking={1.4} color="ink3">
              TRIM RANGE
            </Txt>
            <Txt font="mono" weight={700} size={15} color={tooLong ? theme.bad : theme.accent}>
              SELECTED {formatTime(selectedS)}
            </Txt>
          </View>
          <TrimRange
            durationMs={durationMs}
            startMs={startMs}
            endMs={endMs}
            onChange={(s, e) => {
              setStartMs(s);
              setEndMs(e);
              if (rangeError) setRangeError(null);
            }}
            onScrub={handleScrub}
            onScrubEnd={handleScrubEnd}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt font="mono" weight={600} size={11} color="ink3">
              START {formatTime(startMs / 1000)}
            </Txt>
            <Txt font="mono" weight={600} size={11} color="ink3">
              {formatTime(durationMs / 1000)} TOTAL
            </Txt>
            <Txt font="mono" weight={600} size={11} color="ink3">
              END {formatTime(endMs / 1000)}
            </Txt>
          </View>
          {rangeError ? (
            <Txt weight={700} size={12} color="bad">
              {rangeError}
            </Txt>
          ) : null}
        </View>

        {origin === 'record' ? (
          <Card pad={0} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ gap: 2 }}>
              <Txt weight={700} size={15}>
                Save clip to gallery
              </Txt>
              <Txt weight={600} size={12} color="ink2">
                In-app recordings only
              </Txt>
            </View>
            <Switch
              value={saveIntent}
              onValueChange={setSaveIntent}
              trackColor={{ true: theme.good, false: theme.chip }}
              thumbColor="#fff"
              ios_backgroundColor={theme.chip}
            />
          </Card>
        ) : null}

        <Card inset pad={14} style={{ flexDirection: 'row', gap: 9 }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: theme.accent2,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Txt weight={700} size={11} color="#fff">
              i
            </Txt>
          </View>
          <Txt weight={500} size={12} lh={17} color="ink2" style={{ flex: 1 }}>
            Trim to the attempt itself. Walk-ups and rests make the model less certain.
          </Txt>
        </Card>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
        <Button label={`Analyze this clip · ${formatTime(selectedS)}`} onPress={runAnalyze} disabled={tooLong} />
      </View>
    </Screen>
  );
}
