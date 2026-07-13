import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';

export default function HomeScreen() {
  const { profile } = useAuth();

  return (
    <View style={styles.container}>
      <ThemedText style={styles.greeting}>Welcome, {profile?.username} 🧗</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        Your climbing stats will appear here once you log climbs.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  greeting: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  hint: { fontSize: 15, textAlign: 'center' },
});
