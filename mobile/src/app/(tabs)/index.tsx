import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { ThemedText } from '@/components/themed-text';
import { useClimbs } from '@/hooks/use-climbs';
import { useAuth } from '@/lib/auth-context';
import { gradePyramid, sendsPerMonth, totals } from '@/lib/climb-stats';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const { profile } = useAuth();
  const theme = useTheme();
  const { data, isPending, isError, refetch } = useClimbs();

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">Couldn&apos;t load your stats.</ThemedText>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.center}>
        <ThemedText style={styles.greeting}>Welcome, {profile?.username} 🧗</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Log climbs in the Climbs tab and your stats will show up here.
        </ThemedText>
      </View>
    );
  }

  const { sends, attempts } = totals(data);
  const pyramid = gradePyramid(data);
  const monthly = sendsPerMonth(data);
  const axisStyle = { color: theme.textSecondary, fontSize: 12 };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.tiles}>
        <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.tileNumber}>{sends}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tileLabel}>
            sends
          </ThemedText>
        </View>
        <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.tileNumber}>{attempts}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tileLabel}>
            projects
          </ThemedText>
        </View>
      </View>

      {pyramid.length > 0 && (
        <>
          <ThemedText style={styles.sectionTitle}>Grade pyramid</ThemedText>
          <BarChart
            data={pyramid.map((p) => ({ value: p.count, label: p.grade }))}
            frontColor="#208AEF"
            barBorderRadius={4}
            barWidth={26}
            spacing={14}
            xAxisLabelTextStyle={axisStyle}
            yAxisTextStyle={axisStyle}
            yAxisThickness={0}
            xAxisThickness={0}
            noOfSections={3}
            isAnimated
          />
        </>
      )}

      <ThemedText style={styles.sectionTitle}>Sends — last 6 months</ThemedText>
      <BarChart
        data={monthly.map((m) => ({ value: m.count, label: m.label }))}
        frontColor="#30A46C"
        barBorderRadius={4}
        barWidth={26}
        spacing={14}
        xAxisLabelTextStyle={axisStyle}
        yAxisTextStyle={axisStyle}
        yAxisThickness={0}
        xAxisThickness={0}
        noOfSections={3}
        isAnimated
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  container: { padding: 16, paddingBottom: 48, gap: 12 },
  greeting: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  hint: { fontSize: 15, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', gap: 2 },
  tileNumber: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  tileLabel: { fontSize: 13 },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginTop: 12 },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});
