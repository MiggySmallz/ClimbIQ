import { useEffect, useState } from 'react';
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** A pulsing placeholder block sized to match the final content geometry. */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  // Lazy state (not a ref) so the Animated.Value is stable without a
  // ref-access-during-render lint violation.
  const [pulse] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.chip, opacity: pulse },
        style,
      ]}
    />
  );
}
