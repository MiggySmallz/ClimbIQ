import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Txt } from '@/components/ui/txt';

/** The "C" logo badge + ClimbIQ wordmark. */
export function BrandMark({ size = 32, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Txt weight={700} size={size * 0.5} color="#fff">
          C
        </Txt>
      </View>
      {wordmark ? (
        <Txt weight={700} size={size * 0.7} tracking={-0.7}>
          ClimbIQ
        </Txt>
      ) : null}
    </View>
  );
}
