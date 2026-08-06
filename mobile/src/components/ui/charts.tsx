import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

function buildPath(data: number[], w: number, h: number, pad = 4) {
  if (data.length === 0) return { line: '', area: '', last: { x: 0, y: h / 2 } };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const innerH = h - pad * 2;
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const pts = data.map((v, i) => {
    const x = data.length > 1 ? i * step : w / 2;
    const y = pad + innerH - ((v - min) / span) * innerH;
    return { x, y };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return { line, area, last: pts[pts.length - 1] };
}

/** Mini area/line sparkline. */
export function Sparkline({
  data,
  color,
  fill = true,
  width = 300,
  height = 96,
  strokeWidth = 2.5,
  endDot = false,
  style,
}: {
  data: number[];
  color: string;
  fill?: boolean;
  width?: number;
  height?: number;
  strokeWidth?: number;
  endDot?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;
  const { line, area, last } = buildPath(data, width, height);
  return (
    <View style={[{ width: '100%' }, style]}>
      <Svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        {fill ? (
          <>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.38} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill={`url(#${id})`} />
          </>
        ) : null}
        <Path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {endDot ? (
          <Circle cx={last.x} cy={last.y} r={5} fill={color} stroke={theme.card} strokeWidth={2.5} />
        ) : null}
      </Svg>
    </View>
  );
}

/** Horizontal progress track + fill. */
export function ProgressBar({
  value,
  color,
  height = 9,
  track,
  gradientTo,
}: {
  /** 0..1 */
  value: number;
  color: string;
  height?: number;
  track?: string;
  gradientTo?: string;
}) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: track ?? theme.chip,
        overflow: 'hidden',
      }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: gradientTo ?? color }} />
    </View>
  );
}

/** Circular progress ring with centered content. */
export function ProgressRing({
  pct,
  size = 132,
  stroke = 14,
  color,
  track,
  children,
}: {
  /** 0..1 */
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? theme.chip} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? theme.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
        />
      </Svg>
      {children}
    </View>
  );
}
