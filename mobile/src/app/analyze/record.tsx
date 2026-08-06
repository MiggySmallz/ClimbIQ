import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui';
import { MAX_RECORD_SECONDS } from '@/services/video';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** One of the dashed viewfinder corner brackets. */
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = { position: 'absolute' as const, width: 26, height: 26, borderColor: '#fff' };
  const map = {
    tl: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
    tr: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
    bl: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
    br: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  };
  return <View style={[base, map[pos]]} />;
}

export default function RecordScreen() {
  const [cameraPermission, requestCamera, getCamera] = useCameraPermissions();
  const [micPermission, requestMic, getMic] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [facing, setFacing] = useState<'back' | 'front'>('back');

  const granted = cameraPermission?.granted && micPermission?.granted;

  const mustOpenSettings =
    (cameraPermission != null && !cameraPermission.granted && !cameraPermission.canAskAgain) ||
    (micPermission != null && !micPermission.granted && !micPermission.canAskAgain);

  async function requestAccess() {
    if (mustOpenSettings) {
      await Linking.openSettings();
      return;
    }
    if (!cameraPermission?.granted) await requestCamera();
    if (!micPermission?.granted) await requestMic();
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void getCamera();
        void getMic();
      }
    });
    return () => sub.remove();
  }, [getCamera, getMic]);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function toggleRecording() {
    if (!cameraRef.current) return;
    if (isRecording) {
      cameraRef.current.stopRecording();
      return;
    }
    setIsRecording(true);
    setElapsed(0);
    startRef.current = Date.now();
    timerRef.current = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      250,
    );
    try {
      const recording = await cameraRef.current.recordAsync({ maxDuration: MAX_RECORD_SECONDS });
      const durationMs = Date.now() - startRef.current;
      if (recording?.uri) {
        router.replace({
          pathname: '/analyze/trim',
          params: { uri: recording.uri, durationMs: String(durationMs), width: '', height: '', origin: 'record' },
        });
      }
    } finally {
      stopTimer();
      setIsRecording(false);
    }
  }

  if (!cameraPermission || !micPermission) {
    return <View style={styles.black} />;
  }

  // --- Permission denied (design 9a) ---
  if (!granted) {
    return (
      <SafeAreaView style={styles.permission}>
        <View style={styles.permIcon}>
          <Ionicons name="videocam-off-outline" size={22} color="#f6f6f4" />
        </View>
        <Txt weight={700} size={18} tracking={-0.3} color="#f6f6f4">
          Camera access is off
        </Txt>
        <Txt weight={500} size={13} lh={20} color="#9a9ca5">
          {mustOpenSettings
            ? 'Open Settings ▸ Permissions and turn on Camera and Microphone for ClimbIQ, then come back — the camera opens automatically.'
            : 'ClimbIQ needs the camera to record an attempt. Nothing is uploaded until you tap Analyze.'}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          <Pressable style={[styles.permBtn, { backgroundColor: '#fff' }]} onPress={requestAccess}>
            <Txt weight={700} size={14} color="#111">
              {mustOpenSettings ? 'Open settings' : 'Grant access'}
            </Txt>
          </Pressable>
          <Pressable style={[styles.permBtn, styles.permBtnGhost]} onPress={() => router.replace('/(tabs)/analyze')}>
            <Txt weight={700} size={14} color="#f6f6f4">
              Import instead
            </Txt>
          </Pressable>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginTop: 8 }}>
          <Txt weight={600} size={14} color="#9a9ca5">
            Not now
          </Txt>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.black}>
      {/* Record at 1080p so clips clear the ≥720p analysis floor; expo-camera
          falls back to the device's highest quality if 1080p isn't available.
          Without this it uses a device default that can be below 720p. */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        mode="video"
        facing={facing}
        videoQuality="1080p"
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          {isRecording ? (
            <View style={styles.timerPill}>
              <View style={styles.recDot} />
              <Txt font="mono" weight={700} size={12} color="#fff">
                REC {formatTime(elapsed)}
              </Txt>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            hitSlop={12}
            style={styles.iconButton}>
            <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.guideWrap} pointerEvents="none">
          <View style={styles.guideFrame}>
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />
            {!isRecording ? (
              <Txt
                weight={700}
                size={12}
                tracking={0.8}
                color="rgba(255,255,255,0.9)"
                style={styles.guideText}>
                KEEP THE WHOLE BODY{'\n'}AND THE WALL IN FRAME
              </Txt>
            ) : null}
          </View>
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.sideSlot} />
          <Pressable
            onPress={toggleRecording}
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}>
            <View style={isRecording ? styles.recordSquare : styles.recordCircle} />
          </Pressable>
          <View style={styles.sideSlot}>
            <Txt font="mono" weight={700} size={16} color="#fff">
              {formatTime(elapsed)}
            </Txt>
            <Txt weight={700} size={10} tracking={0.6} color="rgba(255,255,255,0.7)">
              MAX {formatTime(MAX_RECORD_SECONDS)}
            </Txt>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#0b0c0f' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3D81DC' },
  guideWrap: { alignItems: 'center', paddingHorizontal: 32 },
  guideFrame: {
    width: '100%',
    aspectRatio: 0.68,
    maxHeight: 460,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  guideText: { textAlign: 'center' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  sideSlot: { width: 60, alignItems: 'center', gap: 4 },
  recordButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: { borderColor: '#E5484D' },
  recordCircle: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#3D81DC' },
  recordSquare: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#E5484D' },
  permission: {
    flex: 1,
    backgroundColor: '#141519',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  permIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
  },
  permBtnGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
});
