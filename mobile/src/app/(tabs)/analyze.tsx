import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { pickVideoFromLibrary } from '@/services/video';

export default function AnalyzeScreen() {
  const theme = useTheme();
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    if (importing) return;
    setImporting(true);
    try {
      const source = await pickVideoFromLibrary();
      if (!source) return;
      router.push({
        pathname: '/analyze/trim',
        params: {
          uri: source.uri,
          durationMs: String(source.durationMs),
          width: source.width != null ? String(source.width) : '',
          height: source.height != null ? String(source.height) : '',
          origin: source.origin,
        },
      });
    } catch {
      Alert.alert('Import', "Couldn't open that video. Try another.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Ionicons name="videocam-outline" size={40} color="#208AEF" />
        <ThemedText style={styles.title}>Analyze a climb</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Film your whole body and the wall in frame, then trim to the pull-on and top-out.
          You&apos;ll get a coaching report back.
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={() => router.push('/analyze/record')}>
          <Ionicons name="camera" size={22} color="#fff" />
          <Text style={styles.primaryText}>Record a climb</Text>
        </Pressable>

        <Pressable
          style={[styles.secondary, { borderColor: theme.textSecondary }]}
          onPress={handleImport}
          disabled={importing}>
          {importing ? (
            <ActivityIndicator />
          ) : (
            <>
              <Ionicons name="images-outline" size={20} color={theme.text} />
              <ThemedText style={styles.secondaryText}>Import a video</ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', padding: 24, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 12, marginTop: 48 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  hint: { fontSize: 15, textAlign: 'center', paddingHorizontal: 8 },
  actions: { gap: 12 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
  },
  secondaryText: { fontSize: 16, fontWeight: '600' },
});
