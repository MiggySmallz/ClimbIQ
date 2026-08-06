import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/txt';
import { useTheme } from '@/hooks/use-theme';

interface AvatarProps {
  /** Public URL or local file URI; falls back to the username initial. */
  url: string | null;
  username: string | undefined;
  size?: number;
  /** Optional gradient-style fill color for the initial placeholder. */
  tint?: string;
}

export function Avatar({ url, username, size = 96, tint }: AvatarProps) {
  const theme = useTheme();
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (url) {
    return <Image source={{ uri: url }} style={round} contentFit="cover" />;
  }
  return (
    <View
      style={[
        styles.placeholder,
        round,
        { backgroundColor: tint ?? theme.chip },
      ]}>
      <Txt weight={700} size={size * 0.4} color={tint ? '#fff' : theme.ink2}>
        {username?.[0]?.toUpperCase() ?? '?'}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
