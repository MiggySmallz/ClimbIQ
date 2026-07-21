import type { Timeline, TimelineSeries } from '@climbiq/shared';
import { useMemo, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type SeriesKey = keyof Omit<TimelineSeries, 't_s'>;

interface SeriesDef {
  key: SeriesKey;
  label: string;
  color: string;
  /** Value formatter for the cursor readout. */
  fmt: (v: number) => string;
  /** Show the hip-height baseline reference line. */
  baseline?: boolean;
}

const SERIES: SeriesDef[] = [
  { key: 'hip_height_torsos', label: 'Hip height', color: '#208AEF', fmt: (v) => v.toFixed(1), baseline: true },
  { key: 'hip_x_torsos', label: 'Hip lateral', color: '#8E4EC6', fmt: (v) => v.toFixed(1) },
  { key: 'elbow_angle_l_deg', label: 'L elbow', color: '#30A46C', fmt: (v) => `${Math.round(v)}°` },
  { key: 'elbow_angle_r_deg', label: 'R elbow', color: '#E5484D', fmt: (v) => `${Math.round(v)}°` },
];

const HEIGHT = 200;
const PAD = { top: 16, right: 12, bottom: 22, left: 12 };

interface Props {
  timeline: Timeline;
  /** Total climb duration (s) — the x-axis full range. */
  duration: number;
  currentTime: number;
  onSeek: (t: number) => void;
}

/**
 * Biomechanics timeline chart (M4.4), synced two-way with the video: the cursor
 * tracks `currentTime`, and dragging across the plot calls `onSeek` so scrubbing
 * the chart seeks the video and vice versa.
 */
export function BiomechChart({ timeline, duration, currentTime, onSeek }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [seriesKey, setSeriesKey] = useState<SeriesKey>('hip_height_torsos');
  const def = SERIES.find((s) => s.key === seriesKey)!;

  const t = timeline.series.t_s;
  const values = timeline.series[seriesKey];
  const span = duration > 0 ? duration : t[t.length - 1] || 1;

  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const xFor = (time: number) => PAD.left + (time / span) * plotW;

  // y-range from the visible series (ignoring gaps), padded 5% each side.
  const { yFor, path, baselineY } = useMemo(() => {
    const nums = values.filter((v): v is number => v != null);
    let min = nums.length ? Math.min(...nums) : 0;
    let max = nums.length ? Math.max(...nums) : 1;
    if (def.baseline) {
      min = Math.min(min, timeline.hip_baseline_torsos);
      max = Math.max(max, timeline.hip_baseline_torsos);
    }
    if (min === max) max = min + 1;
    const pad = (max - min) * 0.05;
    min -= pad;
    max += pad;
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

    let d = '';
    let penDown = false;
    for (let i = 0; i < t.length; i++) {
      const v = values[i];
      if (v == null) {
        penDown = false;
        continue;
      }
      const cmd = penDown ? 'L' : 'M';
      d += `${cmd}${xFor(t[i]).toFixed(1)} ${y(v).toFixed(1)} `;
      penDown = true;
    }
    return { yFor: y, path: d, baselineY: def.baseline ? y(timeline.hip_baseline_torsos) : null };
    // xFor depends on width/span; recompute when those or the series change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesKey, width, span, timeline, plotH]);

  // Nearest sample to the cursor, for the dot + readout.
  const cursorIdx = useMemo(() => {
    let lo = 0;
    for (let i = 0; i < t.length; i++) if (t[i] <= currentTime) lo = i;
    return lo;
  }, [currentTime, t]);
  const cursorVal = values[cursorIdx];
  const cursorX = xFor(Math.min(currentTime, span));

  const panHandlers = useMemo(() => {
    const seek = (locationX: number) => {
      const time = ((locationX - PAD.left) / plotW) * span;
      onSeek(Math.max(0, Math.min(span, time)));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => seek(e.nativeEvent.locationX),
      onPanResponderMove: (e) => seek(e.nativeEvent.locationX),
    }).panHandlers;
  }, [plotW, span, onSeek]);

  return (
    <View>
      <View style={styles.chips}>
        {SERIES.map((s) => {
          const active = s.key === seriesKey;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSeriesKey(s.key)}
              style={[
                styles.chip,
                { backgroundColor: active ? s.color : theme.backgroundElement },
              ]}>
              <ThemedText
                type="small"
                style={{ color: active ? '#fff' : theme.textSecondary, fontWeight: '600' }}>
                {s.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.readout}>
        <ThemedText themeColor="textSecondary" type="small">
          {formatTime(Math.min(currentTime, span))}
        </ThemedText>
        <ThemedText type="smallBold" style={{ color: def.color }}>
          {cursorVal != null ? `${def.label}: ${def.fmt(cursorVal)}` : `${def.label}: —`}
        </ThemedText>
      </View>

      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: HEIGHT }}
        {...panHandlers}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {baselineY != null && (
              <Line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={baselineY}
                y2={baselineY}
                stroke={theme.textSecondary}
                strokeDasharray="4 4"
                strokeWidth={1}
                opacity={0.5}
              />
            )}
            <Path d={path} stroke={def.color} strokeWidth={2} fill="none" />
            {/* cursor */}
            <Line
              x1={cursorX}
              x2={cursorX}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke={theme.text}
              strokeWidth={1}
              opacity={0.6}
            />
            {cursorVal != null && (
              <Circle cx={cursorX} cy={yFor(cursorVal)} r={4} fill={def.color} />
            )}
            {/* x-axis end labels */}
            <SvgText x={PAD.left} y={HEIGHT - 6} fontSize={11} fill={theme.textSecondary}>
              0:00
            </SvgText>
            <SvgText
              x={width - PAD.right}
              y={HEIGHT - 6}
              fontSize={11}
              fill={theme.textSecondary}
              textAnchor="end">
              {formatTime(span)}
            </SvgText>
          </Svg>
        )}
      </View>
    </View>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  readout: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
});
