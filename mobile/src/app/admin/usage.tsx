import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, View } from 'react-native';

import type { AdminActiveJob } from '@climbiq/shared';

import { Card, ErrorState, NavBar, Screen, Skeleton, StatTile, StatusPill, Txt } from '@/components/ui';
import { radius } from '@/constants/design';
import { useAdminUsage } from '@/hooks/use-admin-usage';
import { useTheme } from '@/hooks/use-theme';

const NOSANA_EXPLORER = 'https://explore.nosana.com/jobs';

function AdminTag() {
  const theme = useTheme();
  return (
    <View style={{ backgroundColor: theme.ink, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 }}>
      <Txt weight={700} size={9} tracking={1} color={theme.bg}>
        ADMIN
      </Txt>
    </View>
  );
}

function durationLabel(s: number | null): string {
  if (s == null) return '—';
  if (s < 90) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function agoLabel(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

/** A running/posted Nosana job row — tapping opens the run on the Nosana explorer. */
function JobRow({ job, last }: { job: AdminActiveJob; last?: boolean }) {
  const theme = useTheme();
  const running = job.status === 'running';
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(`${NOSANA_EXPLORER}/${job.nosana_job_id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 15,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.line,
        opacity: pressed ? 0.6 : 1,
      })}>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt font="mono" weight={700} size={13} numberOfLines={1}>
          {job.nosana_job_id}
        </Txt>
        <Txt weight={600} size={11} color="ink3">
          {agoLabel(job.posted_at)}
        </Txt>
      </View>
      <StatusPill label={running ? 'RUNNING' : 'POSTED'} color={running ? theme.good : theme.accent} />
      <Ionicons name="open-outline" size={16} color={theme.ink3} />
    </Pressable>
  );
}

function BreakdownRow({ color, label, value, last }: { color: string; label: string; value: number; last?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 15,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.line,
      }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Txt weight={700} size={13} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt font="mono" weight={700} size={13}>
        {value.toLocaleString()}
      </Txt>
    </View>
  );
}

export default function UsageScreen() {
  const theme = useTheme();
  const { data, isPending, isError, isFetching, refetch } = useAdminUsage();

  return (
    <Screen edges={['top']}>
      <NavBar title="Usage & cost" onBack={() => router.back()} right={<AdminTag />} />
      <View style={{ paddingHorizontal: 20, gap: 13 }}>
        {isPending ? (
          <>
            <View style={{ flexDirection: 'row', gap: 11 }}>
              <Skeleton height={84} radius={16} style={{ flex: 1 }} />
              <Skeleton height={84} radius={16} style={{ flex: 1 }} />
            </View>
            <Skeleton height={140} radius={18} />
          </>
        ) : isError ? (
          <ErrorState
            title="Usage data unavailable"
            body="The billing API is unreachable right now. Try again in a moment."
            onRetry={() => refetch()}
          />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
              <StatTile
                label="JOBS TOTAL"
                value={data.jobs_total.toLocaleString()}
                sub={`${data.jobs_done.toLocaleString()} completed`}
                mono
                valueSize={28}
                style={{ minWidth: '46%' }}
              />
              <StatTile
                label="TOTAL SPEND"
                value={`$${Math.round(data.cost_usd_total).toLocaleString()}`}
                sub={data.jobs_total > 0 ? `$${(data.cost_usd_total / data.jobs_total).toFixed(2)} / job` : undefined}
                mono
                valueSize={28}
                style={{ minWidth: '46%' }}
              />
              <StatTile
                label="LAST 30 DAYS"
                value={`$${Math.round(data.cost_usd_30d).toLocaleString()}`}
                mono
                valueSize={28}
                style={{ minWidth: '46%' }}
              />
              <StatTile
                label="AVG DURATION"
                value={durationLabel(data.avg_duration_s)}
                sub="completed jobs"
                mono
                valueSize={28}
                style={{ minWidth: '46%' }}
              />
            </View>

            <Card pad={0} rounded={radius.card} style={{ overflow: 'hidden' }}>
              <BreakdownRow color={theme.good} label="Completed" value={data.jobs_done} />
              <BreakdownRow color={theme.bad} label="Failed / timed out" value={data.jobs_failed} />
              <BreakdownRow
                color={theme.ink3}
                label="In flight / other"
                value={Math.max(0, data.jobs_total - data.jobs_done - data.jobs_failed)}
                last
              />
            </Card>

            <View style={{ gap: 9, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3 }}>
                <Txt weight={700} size={11} tracking={1} color="ink3" style={{ flex: 1 }}>
                  IN FLIGHT ON NOSANA
                </Txt>
                <Pressable
                  onPress={() => refetch()}
                  disabled={isFetching}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    opacity: pressed || isFetching ? 0.5 : 1,
                  })}>
                  {isFetching ? (
                    <ActivityIndicator size="small" color={theme.ink3} />
                  ) : (
                    <Ionicons name="refresh" size={14} color={theme.accent} />
                  )}
                  <Txt weight={700} size={11} tracking={0.6} color={isFetching ? 'ink3' : 'accent'}>
                    {isFetching ? 'REFRESHING' : 'REFRESH'}
                  </Txt>
                </Pressable>
              </View>
              <Card pad={0} rounded={radius.card} style={{ overflow: 'hidden' }}>
                {data.active_jobs.length > 0 ? (
                  data.active_jobs.map((job, i) => (
                    <JobRow key={job.id} job={job} last={i === data.active_jobs.length - 1} />
                  ))
                ) : (
                  <View style={{ paddingHorizontal: 15, paddingVertical: 18, alignItems: 'center' }}>
                    <Txt weight={600} size={13} color="ink3">
                      No jobs in flight
                    </Txt>
                  </View>
                )}
              </Card>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
