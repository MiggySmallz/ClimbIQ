// Owner-only admin card on the Profile tab (spec §8.3, M6.3). Shows the live
// Nosana Credits balance with a low-balance alert, plus the spend/job summary
// from GET /admin/usage. Renders nothing unless that call succeeds — the endpoint
// 404s for non-owners, so this simply never appears for regular users and no
// owner id is shipped to the client.

import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAdminUsage } from '@/hooks/use-admin-usage';
import { useTheme } from '@/hooks/use-theme';

const usd = (n: number) => `$${n.toFixed(2)}`;

function durationLabel(s: number | null): string {
  if (s == null) return '—';
  if (s < 90) return `${Math.round(s)}s`;
  return `${(s / 60).toFixed(1)} min`;
}

export function AdminCard() {
  const theme = useTheme();
  const { data } = useAdminUsage();

  // Hidden for non-owners (endpoint 404s) and until the first successful load.
  if (!data) return null;

  const { credits } = data;
  const low = credits != null && credits.available_usd < data.credits_alert_usd;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.title}>Admin · Nosana</ThemedText>

      {credits ? (
        <>
          <View style={styles.balanceRow}>
            <ThemedText themeColor="textSecondary" type="small">
              Credits available
            </ThemedText>
            <Text style={[styles.balance, { color: low ? '#E5484D' : '#30A46C' }]}>
              {usd(credits.available_usd)}
            </Text>
          </View>
          {low && (
            <View style={styles.alert}>
              <Text style={styles.alertText}>Credits low — top up to keep analyses running.</Text>
            </View>
          )}
          <ThemedText themeColor="textSecondary" type="small">
            {usd(credits.reserved_usd)} reserved in running/queued jobs
          </ThemedText>
        </>
      ) : (
        <ThemedText themeColor="textSecondary" type="small">
          Credits balance unavailable.
        </ThemedText>
      )}

      <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

      <StatRow label="Spent all-time" value={usd(data.cost_usd_total)} />
      <StatRow label="Spent last 30 days" value={usd(data.cost_usd_30d)} />
      <StatRow
        label="Jobs (done / failed / total)"
        value={`${data.jobs_done} / ${data.jobs_failed} / ${data.jobs_total}`}
      />
      <StatRow label="Avg job duration" value={durationLabel(data.avg_duration_s)} />
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', marginTop: 24, borderRadius: 12, padding: 16, gap: 8 },
  title: { fontSize: 17, fontWeight: '600' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balance: { fontSize: 24, fontWeight: '700' },
  alert: { backgroundColor: '#E5484D', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  alertText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
