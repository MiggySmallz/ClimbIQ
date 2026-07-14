import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export default function FeedScreen() {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>Nothing here yet</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        Reports your friends share will show up here.
      </ThemedText>
      <Pressable style={styles.cta} onPress={() => router.push('/friends')}>
        <Text style={styles.ctaText}>Find friends</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  hint: { fontSize: 15, textAlign: 'center' },
  cta: {
    marginTop: 8,
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
