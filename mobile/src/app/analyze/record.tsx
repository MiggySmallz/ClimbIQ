import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MAX_RECORD_SECONDS } from '@/services/video';

export default function RecordScreen() {
  const [cameraPermission, requestCamera, getCamera] = useCameraPermissions();
  const [micPermission, requestMic, getMic] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const granted = cameraPermission?.granted && micPermission?.granted;

  // Once either permission has been denied, Android/iOS won't show the system
  // dialog again — requestCamera()/requestMic() resolve instantly with no prompt
  // (the "nothing happens on Grant access" bug). In that case send the user to
  // the OS settings screen instead. `canAskAgain` false ⇒ prompt is exhausted.
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

  // When the user flips the toggle in OS Settings and returns to the app, re-read
  // both permissions so the screen advances to the camera automatically — no
  // second "Grant access" tap needed (M3.18).
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
          params: {
            uri: recording.uri,
            durationMs: String(durationMs),
            width: '',
            height: '',
            origin: 'record',
          },
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

  if (!granted) {
    return (
      <SafeAreaView style={styles.permission}>
        <Ionicons name="camera-outline" size={44} color="#fff" />
        <ThemedText style={styles.permissionTitle}>Camera access needed</ThemedText>
        <Text style={styles.permissionHint}>
          {mustOpenSettings
            ? 'Open Settings ▸ Permissions and turn on Camera and Microphone for ClimbIQ, then come back — the camera opens automatically.'
            : 'ClimbIQ needs your camera and microphone to film your climbs.'}
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestAccess}>
          <Text style={styles.permissionButtonText}>
            {mustOpenSettings ? 'Open Settings' : 'Grant access'}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.cancelText}>Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.black}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} mode="video" facing="back" />

      {/* Framing guidance (spec §6) */}
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          {isRecording ? (
            <View style={styles.timerPill}>
              <View style={styles.recDot} />
              <Text style={styles.timerText}>
                {formatTime(elapsed)} / {formatTime(MAX_RECORD_SECONDS)}
              </Text>
            </View>
          ) : (
            <View />
          )}
        </View>

        <View style={styles.guideWrap} pointerEvents="none">
          <View style={styles.guideFrame} />
          {!isRecording && (
            <ThemedText style={styles.guideText}>
              Keep your whole body and the wall in frame
            </ThemedText>
          )}
        </View>

        <View style={styles.bottomBar}>
          <Pressable
            onPress={toggleRecording}
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}>
            <View style={isRecording ? styles.recordSquare : styles.recordCircle} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5484D' },
  timerText: { color: '#fff', fontWeight: '700', fontVariant: ['tabular-nums'] },
  guideWrap: { alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  guideFrame: {
    width: '78%',
    aspectRatio: 0.62,
    maxHeight: 420,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  guideText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  bottomBar: { alignItems: 'center', paddingBottom: 24 },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: { borderColor: '#E5484D' },
  recordCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#E5484D' },
  recordSquare: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#E5484D' },
  permission: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
  },
  permissionTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  permissionHint: { color: '#B0B4BA', fontSize: 15, textAlign: 'center' },
  permissionButton: {
    marginTop: 8,
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelText: { color: '#B0B4BA', fontSize: 15, marginTop: 4 },
});
