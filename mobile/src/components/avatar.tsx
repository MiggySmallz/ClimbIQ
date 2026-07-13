import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface AvatarProps {
  /** Public URL or local file URI; falls back to the username initial. */
  url: string | null;
  username: string | undefined;
  size?: number;
}

export function Avatar({ url, username, size = 96 }: AvatarProps) {
  const theme = useTheme();
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (url) {
    return <Image source={{ uri: url }} style={round} contentFit="cover" />;
  }
  return (
    <View style={[styles.placeholder, round, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText themeColor="textSecondary" style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }}>
        {username?.[0]?.toUpperCase() ?? '?'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
