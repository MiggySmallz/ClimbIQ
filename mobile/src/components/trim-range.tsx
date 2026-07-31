import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

const STRIP_HEIGHT = 64;
const HANDLE_WIDTH = 22;
const MIN_GAP_MS = 500;
// Side gutters keep both handles clear of the OS edge-swipe-back gesture zone,
// which otherwise steals the drag when a handle sits at full-range against the
// screen edge. The strip is inset by the same gutter.
const GUTTER = 32;
// Enlarge each handle's touch target well past its 22px visual width so it's
// easy to grab (the whole strip is no longer draggable — the handles are).
const HANDLE_HITSLOP = { top: 12, bottom: 12, left: 18, right: 18 };

interface Props {
  thumbnails: string[];
  durationMs: number;
  startMs: number;
  endMs: number;
  onChange: (startMs: number, endMs: number) => void;
}

/**
 * Two-handle trim range over a thumbnail strip (spec §6, M3.14). Each handle has
 * its own PanResponder and drags by gesture delta (`dx`), which is robust to
 * which child element the finger lands on — the shared-track "grab nearest
 * handle" approach didn't register drags on device (M3.19).
 */
export function TrimRange({ thumbnails, durationMs, startMs, endMs, onChange }: Props) {
  const [width, setWidth] = useState(0);
  const trackW = Math.max(width - 2 * GUTTER, 1);
  const msToX = (ms: number) => GUTTER + (ms / durationMs) * trackW;

  // The ms value of the handle being dragged, captured on grant so the move
  // handler can apply a gesture delta (`dx`). Only read/written inside the
  // gesture callbacks (native touches), never during render.
  const grabbed = useRef(0);

  const startPan = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          grabbed.current = startMs;
        },
        onPanResponderMove: (_e, g) => {
          const deltaMs = (g.dx / trackW) * durationMs;
          const next = Math.max(0, Math.min(grabbed.current + deltaMs, endMs - MIN_GAP_MS));
          onChange(next, endMs);
        },
      }),
    [trackW, durationMs, startMs, endMs, onChange],
  );

  const endPan = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          grabbed.current = endMs;
        },
        onPanResponderMove: (_e, g) => {
          const deltaMs = (g.dx / trackW) * durationMs;
          const next = Math.min(durationMs, Math.max(grabbed.current + deltaMs, startMs + MIN_GAP_MS));
          onChange(startMs, next);
        },
      }),
    [trackW, durationMs, startMs, endMs, onChange],
  );

  const startX = msToX(startMs);
  const endX = msToX(endMs);

  return (
    <View style={styles.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.strip}>
        {thumbnails.map((uri, i) => (
          <Image key={i} source={{ uri }} style={styles.thumb} contentFit="cover" />
        ))}
      </View>

      {width > 0 && (
        <>
          {/* dimmed regions outside the selection (within the inset strip) */}
          <View
            style={[styles.dim, { left: GUTTER, width: startX - GUTTER }]}
            pointerEvents="none"
          />
          <View style={[styles.dim, { left: endX, right: GUTTER }]} pointerEvents="none" />

          {/* selection border */}
          <View
            style={[styles.selection, { left: startX, width: Math.max(endX - startX, 0) }]}
            pointerEvents="none"
          />

          {/* draggable handles */}
          <View
            style={[styles.handle, { left: startX - HANDLE_WIDTH }]}
            hitSlop={HANDLE_HITSLOP}
            {...startPan.panHandlers}>
            <View style={styles.grip} />
          </View>
          <View
            style={[styles.handle, { left: endX }]}
            hitSlop={HANDLE_HITSLOP}
            {...endPan.panHandlers}>
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
    marginHorizontal: GUTTER,
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
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { width: 3, height: 22, borderRadius: 2, backgroundColor: '#fff' },
});
