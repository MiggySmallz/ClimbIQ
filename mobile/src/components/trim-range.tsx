import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

const STRIP_HEIGHT = 64;
const HANDLE_WIDTH = 16;
const MIN_GAP_MS = 500;

interface Props {
  thumbnails: string[];
  durationMs: number;
  startMs: number;
  endMs: number;
  onChange: (startMs: number, endMs: number) => void;
}

/**
 * Two-handle trim range over a thumbnail strip (spec §6, M3.14). Pre-filled to
 * the full range by the parent; dragging either handle reports the new range.
 */
export function TrimRange({ thumbnails, durationMs, startMs, endMs, onChange }: Props) {
  const [width, setWidth] = useState(0);
  const activeHandle = useRef<'start' | 'end'>('start');
  const trackW = Math.max(width, 1);

  const msToX = (ms: number) => (ms / durationMs) * trackW;
  const xToMs = (x: number) => Math.max(0, Math.min(durationMs, (x / trackW) * durationMs));

  const panHandlers = useMemo(() => {
    const apply = (x: number) => {
      const ms = xToMs(x);
      if (activeHandle.current === 'start') {
        onChange(Math.min(ms, endMs - MIN_GAP_MS), endMs);
      } else {
        onChange(startMs, Math.max(ms, startMs + MIN_GAP_MS));
      }
    };
    // activeHandle.current is only read/written inside these gesture callbacks
    // (fired by native touches), never during render.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        // Grab whichever handle is nearer the touch.
        activeHandle.current =
          Math.abs(x - msToX(startMs)) <= Math.abs(x - msToX(endMs)) ? 'start' : 'end';
        apply(x);
      },
      onPanResponderMove: (e) => apply(e.nativeEvent.locationX),
    });
    // trackW/durationMs/range bounds change what a touch maps to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackW, durationMs, startMs, endMs, onChange]);

  const startX = msToX(startMs);
  const endX = msToX(endMs);

  return (
    <View
      style={styles.container}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...panHandlers}>
      <View style={styles.strip}>
        {thumbnails.map((uri, i) => (
          <Image key={i} source={{ uri }} style={styles.thumb} contentFit="cover" />
        ))}
      </View>

      {width > 0 && (
        <>
          {/* dimmed regions outside the selection */}
          <View style={[styles.dim, { left: 0, width: startX }]} pointerEvents="none" />
          <View style={[styles.dim, { left: endX, right: 0 }]} pointerEvents="none" />

          {/* selection border */}
          <View
            style={[styles.selection, { left: startX, width: Math.max(endX - startX, 0) }]}
            pointerEvents="none"
          />

          {/* handles */}
          <View style={[styles.handle, { left: startX - HANDLE_WIDTH }]} pointerEvents="none">
            <View style={styles.grip} />
          </View>
          <View style={[styles.handle, { left: endX }]} pointerEvents="none">
            <View style={styles.grip} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: STRIP_HEIGHT, justifyContent: 'center' },
  strip: {
    flexDirection: 'row',
    height: STRIP_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#00000020',
  },
  thumb: { flex: 1, height: STRIP_HEIGHT },
  dim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
  },
  selection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: '#208AEF',
    borderRadius: 8,
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_WIDTH,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { width: 3, height: 22, borderRadius: 2, backgroundColor: '#fff' },
});
