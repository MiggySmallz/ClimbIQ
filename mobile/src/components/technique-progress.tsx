// Technique-progress section on the Home tab (spec §6 Stats/Progress, M5.4).
// Per-issue severity trend lines + overall-score trend, aggregated from the
// user's stored reports only (§2 retention). Self-contained loading/error/empty
// states so the Home screen can drop it in without extra branching.

import type { UseQueryResult } from '@tanstack/react-query';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { issueLabel } from '@/lib/report-copy';
import {
  issueSeverityTrends,
  overallScoreTrend,
  severityWord,
  type IssueTrend,
  type TrendReport,
} from '@/lib/report-trends';

const CHART_WIDTH = Dimensions.get('window').width - 64;

/** Severity value 0–3 → accent color (matches the report cards). */
function severityColor(value: number): string {
  if (value >= 3) return '#E5484D';
  if (value === 2) return '#F5A623';
  if (value === 1) return '#30A46C';
  return '#8B8D98';
}

export function TechniqueProgress({ query }: { query: UseQueryResult<TrendReport[]> }) {
  const theme = useTheme();

  if (query.isPending) {
    return (
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Technique progress</ThemedText>
        <ActivityIndicator style={styles.pad} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Technique progress</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Couldn&apos;t load your progress.
        </ThemedText>
        <Pressable style={styles.retryButton} onPress={() => query.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const reports = query.data;
  if (reports.length === 0) return null; // no analyses yet → nothing to show

  const overall = overallScoreTrend(reports);
  const issues = issueSeverityTrends(reports);
  const axisStyle = { color: theme.textSecondary, fontSize: 11 };

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Technique progress</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        {reports.length < 2
          ? 'From your first analysis — trends build as you analyze more climbs.'
          : `From your last ${reports.length} analyses.`}
      </ThemedText>

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <ThemedText type="smallBold">Overall score</ThemedText>
          <ThemedText type="smallBold" style={{ color: '#208AEF' }}>
            {overall[overall.length - 1]?.value ?? '—'}
          </ThemedText>
        </View>
        <LineChart
          data={overall}
          width={CHART_WIDTH}
          height={90}
          maxValue={100}
          noOfSections={4}
          spacing={pointSpacing(overall.length)}
          initialSpacing={10}
          endSpacing={10}
          thickness={2}
          color="#208AEF"
          dataPointsColor="#208AEF"
          dataPointsRadius={3}
          hideRules
          curved
          disableScroll
          yAxisThickness={0}
          xAxisThickness={0}
          yAxisTextStyle={axisStyle}
          xAxisLabelTextStyle={axisStyle}
        />
      </View>

      {issues.length === 0 ? (
        <ThemedText themeColor="textSecondary" type="small" style={styles.pad}>
          No recurring technique issues flagged — nice work.
        </ThemedText>
      ) : (
        issues.map((trend) => (
          <IssueTrendBlock key={trend.key} trend={trend} axisStyle={axisStyle} />
        ))
      )}
    </View>
  );
}

function IssueTrendBlock({
  trend,
  axisStyle,
}: {
  trend: IssueTrend;
  axisStyle: { color: string; fontSize: number };
}) {
  const color = severityColor(trend.latest);
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <ThemedText type="smallBold">{issueLabel(trend.key)}</ThemedText>
        <View style={[styles.pill, { backgroundColor: color }]}>
          <Text style={styles.pillText}>Now: {severityWord(trend.latest)}</Text>
        </View>
      </View>
      <LineChart
        data={trend.points.map((p) => ({ ...p, dataPointColor: severityColor(p.value) }))}
        width={CHART_WIDTH}
        height={72}
        maxValue={3}
        noOfSections={3}
        stepValue={1}
        spacing={pointSpacing(trend.points.length)}
        initialSpacing={10}
        endSpacing={10}
        thickness={2}
        color={color}
        dataPointsRadius={3}
        hideRules
        disableScroll
        yAxisThickness={0}
        xAxisThickness={0}
        hideYAxisText
        xAxisLabelTextStyle={axisStyle}
      />
    </View>
  );
}

/** Fit `n` points into CHART_WIDTH (accounting for the 10px end margins). */
function pointSpacing(n: number): number {
  if (n <= 1) return CHART_WIDTH - 20;
  return (CHART_WIDTH - 20) / (n - 1);
}

const styles = StyleSheet.create({
  section: { gap: 8, marginTop: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
  pad: { paddingVertical: 8 },
  block: { gap: 6, marginTop: 8 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  retryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});
