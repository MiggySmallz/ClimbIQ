import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

const TRACK_HEIGHT = 56;
const HANDLE_WIDTH = 22;
const MIN_GAP_MS = 500;
// Side gutters keep both handles clear of the OS edge-swipe-back gesture zone,
// which otherwise steals the drag when a handle sits at full-range against the
// screen edge. The track is inset by the same gutter.
const GUTTER = 32;
// Enlarge each handle's touch target well past its 22px visual width so it's
// easy to grab.
const HANDLE_HITSLOP = { top: 12, bottom: 12, left: 18, right: 18 };

interface Props {
  durationMs: number;
  startMs: number;
  endMs: number;
  onChange: (startMs: number, endMs: number) => void;
  /** The dragged edge's position, fired continuously during a drag — the parent
   *  seeks the video preview to this time so the user sees the exact frame. */
  onScrub?: (ms: number) => void;
  /** The dragged edge's final position on release (precise seek). */
  onScrubEnd?: (ms: number) => void;
}

/** Everything the gesture callbacks read, kept fresh via a ref so the two
 *  PanResponders can be created ONCE and never recreated mid-drag. */
interface Live {
  startMs: number;
  endMs: number;
  durationMs: number;
  trackW: number;
  onChange: Props['onChange'];
  onScrub: Props['onScrub'];
  onScrubEnd: Props['onScrubEnd'];
}

/**
 * Two-handle trim range over a plain scrub track. Dragging an edge seeks the live
 * video preview. Each handle has its own PanResponder and drags by gesture delta
 * (`dx`). The responders are created once and read live state from a ref:
 * recreating a PanResponder mid-drag tears down the active gesture, so the handle
 * would "snap back" instead of tracking the finger.
 */
export function TrimRange({ durationMs, startMs, endMs, onChange, onScrub, onScrubEnd }: Props) {
  const [width, setWidth] = useState(0);
  const trackW = Math.max(width - 2 * GUTTER, 1);
  const msToX = (ms: number) => GUTTER + (ms / durationMs) * trackW;

  // Latest props for the gesture callbacks. Synced after every render (not
  // during) so it stays compiler-safe; a drag only starts after a render anyway.
  const live = useRef<Live>({ startMs, endMs, durationMs, trackW, onChange, onScrub, onScrubEnd });
  useEffect(() => {
    live.current = { startMs, endMs, durationMs, trackW, onChange, onScrub, onScrubEnd };
  });

  // The handle's ms value at grab time; the move handler applies the gesture
  // delta (`dx`) to it. `active` holds the latest value so release can report it.
  const grabbed = useRef(0);
  const active = useRef(0);

  // Lazy `useState` initializers run once, so each responder has a stable
  // identity and an in-flight drag is never torn down by a re-render. Dynamic
  // state is read from `live` inside the callbacks (which run at gesture time).
  // eslint-disable-next-line react-hooks/refs
  const [startPan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Once we own the drag, don't let a parent ScrollView reclaim it.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        grabbed.current = live.current.startMs;
        active.current = live.current.startMs;
        live.current.onScrub?.(live.current.startMs);
      },
      onPanResponderMove: (_e, g) => {
        const l = live.current;
        const deltaMs = (g.dx / l.trackW) * l.durationMs;
        const next = Math.max(0, Math.min(grabbed.current + deltaMs, l.endMs - MIN_GAP_MS));
        active.current = next;
        l.onChange(next, l.endMs);
        l.onScrub?.(next);
      },
      onPanResponderRelease: () => live.current.onScrubEnd?.(active.current),
    }),
  );

  // eslint-disable-next-line react-hooks/refs
  const [endPan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        grabbed.current = live.current.endMs;
        active.current = live.current.endMs;
        live.current.onScrub?.(live.current.endMs);
      },
      onPanResponderMove: (_e, g) => {
        const l = live.current;
        const deltaMs = (g.dx / l.trackW) * l.durationMs;
        const next = Math.min(l.durationMs, Math.max(grabbed.current + deltaMs, l.startMs + MIN_GAP_MS));
        active.current = next;
        l.onChange(l.startMs, next);
        l.onScrub?.(next);
      },
      onPanResponderRelease: () => live.current.onScrubEnd?.(active.current),
    }),
  );

  const startX = msToX(startMs);
  const endX = msToX(endMs);

  return (
    <View style={styles.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.track} />

      {width > 0 && (
        <>
          {/* dimmed regions outside the selection */}
          <View style={[styles.dim, { left: GUTTER, width: startX - GUTTER }]} pointerEvents="none" />
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
  container: { height: TRACK_HEIGHT, justifyContent: 'center' },
  track: {
    height: TRACK_HEIGHT,
    marginHorizontal: GUTTER,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.28)',
  },
  dim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  selection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: '#3D81DC',
    borderRadius: 8,
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_WIDTH,
    backgroundColor: '#3D81DC',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { width: 3, height: 22, borderRadius: 2, backgroundColor: '#fff' },
});
