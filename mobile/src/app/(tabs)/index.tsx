import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';

export default function HomeScreen() {
  const { profile } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Welcome, {profile?.username} 🧗</Text>
      <Text style={styles.hint}>Your climbing stats will appear here once you log climbs.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  greeting: { fontSize: 22, fontWeight: '600' },
  hint: { fontSize: 15, color: '#60646C', textAlign: 'center' },
});
