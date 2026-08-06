import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/avatar';
import {
  Card,
  EmptyState,
  ErrorState,
  Screen,
  Segmented,
  Skeleton,
  Sparkline,
  StatTile,
  Txt,
} from '@/components/ui';
import { gradeColor, gradeRank } from '@/constants/design';
import { useClimbs } from '@/hooks/use-climbs';
import { useReportTrends } from '@/hooks/use-report-trends';
import { useTheme } from '@/hooks/use-theme';
import { gradePyramid, sendsPerMonth, totals } from '@/lib/climb-stats';
import { issueLabel } from '@/lib/report-copy';
import { issueSeverityTrends, overallScoreTrend } from '@/lib/report-trends';
import { useAuth } from '@/lib/auth-context';

type Tab = 'overview' | 'progress';

/** ▲N (green) / ▼N (green when good) trend badge. */
function Delta({ value, goodUp = true, suffix }: { value: number; goodUp?: boolean; suffix?: string }) {
  const theme = useTheme();
  if (value === 0) return null;
  const up = value > 0;
  const good = up === goodUp;
  return (
    <Txt weight={700} size={12} color={good ? theme.good : theme.bad}>
      {up ? '▲' : '▼'} {Math.abs(value)}
      {suffix ? ` ${suffix}` : ''}
    </Txt>
  );
}

function sevValueColor(v: number, theme: ReturnType<typeof useTheme>): string {
  if (v >= 3) return theme.bad;
  if (v === 2) return theme.warn;
  if (v === 1) return theme.good;
  return theme.ink3;
}

export default function HomeScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState<10 | 20>(10);
  const climbsQ = useClimbs();
  const trendsQ = useReportTrends(range);

  const weekday = new Date().toLocaleDateString('en', { weekday: 'long' }).toUpperCase();

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}>
        <Txt weight={700} size={12} tracking={1.5} color="ink3">
          {weekday} · LET&apos;S TRAIN
        </Txt>
        <Txt weight={700} size={30} tracking={-1.05} style={{ marginTop: 3 }}>
          Hey, {profile?.username ?? 'climber'}
        </Txt>
      </View>
      <Avatar url={profile?.avatar_url ?? null} username={profile?.username} size={42} tint={theme.accent} />
    </View>
  );

  const segmented = (
    <Segmented<Tab>
      options={[
        { label: 'Overview', value: 'overview' },
        { label: 'Progress', value: 'progress' },
      ]}
      value={tab}
      onChange={setTab}
    />
  );

  // ---- Loading ----
  if (climbsQ.isPending) {
    return (
      <Screen scroll padded={20} contentStyle={{ paddingTop: 22, paddingBottom: 40, gap: 18 }}>
        {header}
        {segmented}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton height={96} radius={18} style={{ flex: 1 }} />
          <Skeleton height={96} radius={18} style={{ flex: 1 }} />
        </View>
        <Skeleton height={180} radius={18} />
        <Skeleton height={150} radius={18} />
      </Screen>
    );
  }

  // ---- Error ----
  if (climbsQ.isError) {
    return (
      <Screen padded={20} contentStyle={{ paddingTop: 22, gap: 18 }}>
        {header}
        <ErrorState
          title="Couldn't load your stats"
          body="We couldn't reach the server. Your data is safe."
          onRetry={() => climbsQ.refetch()}
        />
      </Screen>
    );
  }

  const climbs = climbsQ.data;
  const hasClimbs = climbs.length > 0;
  const reports = trendsQ.data ?? [];
  const noReports = reports.length === 0;

  // ---- Empty (nothing at all) ----
  if (!hasClimbs && noReports && !trendsQ.isPending && !trendsQ.isError) {
    return (
      <Screen padded={20} contentStyle={{ paddingTop: 22, gap: 18 }}>
        {header}
        {segmented}
        <View style={{ marginTop: 40 }}>
          <EmptyState
            icon="trending-up-outline"
            title="Nothing logged yet"
            body="Log one boulder and your pyramid starts building. Six months of trend needs six sessions — start today."
            actionLabel="Log your first climb"
            onAction={() => router.push('/climb-form')}
            secondaryLabel="or analyze a video first"
            onSecondary={() => router.push('/(tabs)/analyze')}
          />
        </View>
      </Screen>
    );
  }

  const { sends, attempts } = totals(climbs);
  const pyramid = gradePyramid(climbs);
  const monthly = sendsPerMonth(climbs);
  const thisMonth = monthly[monthly.length - 1]?.count ?? 0;
  const maxBar = Math.max(1, ...pyramid.map((p) => p.count));
  const monthlyVals = monthly.map((m) => m.count);
  const first = monthlyVals.find((v) => v > 0) ?? 0;
  const last = monthlyVals[monthlyVals.length - 1] ?? 0;
  const growth = first > 0 ? Math.round(((last - first) / first) * 100) : null;

  return (
    <Screen scroll padded={20} contentStyle={{ paddingTop: 22, paddingBottom: 40, gap: 18 }}>
      {header}
      {segmented}

      {tab === 'overview' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatTile
              label="SENDS"
              value={sends}
              sub={thisMonth > 0 ? `▲ ${thisMonth} this month` : 'no sends yet this month'}
              subColor={thisMonth > 0 ? theme.good : theme.ink2}
            />
            <StatTile label="PROJECTS" value={attempts} sub={`${climbs.length} logged`} />
          </View>

          {pyramid.length > 0 ? (
            <Card pad={18}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                }}>
                <Txt weight={700} size={16} tracking={-0.2}>
                  Grade pyramid
                </Txt>
                <Txt weight={700} size={11} tracking={1} color="ink3">
                  SENDS PER GRADE
                </Txt>
              </View>
              <View style={{ gap: 7 }}>
                {pyramid
                  .slice()
                  .reverse()
                  .map((p) => (
                    <View key={p.grade} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <Txt font="mono" weight={700} size={12} color="ink2" style={{ width: 30 }}>
                        {p.grade}
                      </Txt>
                      <View
                        style={{
                          height: 16,
                          width: `${(p.count / maxBar) * 82}%`,
                          borderRadius: 5,
                          backgroundColor: gradeColor(p.grade),
                        }}
                      />
                      <Txt font="mono" weight={700} size={12} color="ink3">
                        {p.count}
                      </Txt>
                    </View>
                  ))}
              </View>
            </Card>
          ) : null}

          <Card pad={18}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
              <Txt weight={700} size={16} tracking={-0.2}>
                Sends · last 6 months
              </Txt>
              {growth !== null ? (
                <Txt font="mono" weight={700} size={13} color={growth >= 0 ? theme.good : theme.bad}>
                  {growth >= 0 ? '+' : ''}
                  {growth}%
                </Txt>
              ) : null}
            </View>
            <Sparkline data={monthlyVals} color={theme.accent} height={96} endDot />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              {monthly.map((m, i) => (
                <Txt key={i} font="mono" weight={600} size={11} color="ink3">
                  {m.label.toUpperCase()}
                </Txt>
              ))}
            </View>
          </Card>
        </>
      ) : (
        <ProgressView
          reports={reports}
          range={range}
          setRange={setRange}
          isPending={trendsQ.isPending}
          isError={trendsQ.isError}
          onRetry={() => trendsQ.refetch()}
        />
      )}
    </Screen>
  );
}

function ProgressView({
  reports,
  range,
  setRange,
  isPending,
  isError,
  onRetry,
}: {
  reports: import('@/lib/report-trends').TrendReport[];
  range: 10 | 20;
  setRange: (r: 10 | 20) => void;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const theme = useTheme();

  const rangeSelector = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Txt weight={700} size={11} tracking={1.4} color="ink3">
        RANGE
      </Txt>
      {([10, 20] as const).map((n) => (
        <Txt
          key={n}
          font="mono"
          weight={700}
          size={12}
          color={range === n ? theme.bg : theme.ink2}
          onPress={() => setRange(n)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 9,
            overflow: 'hidden',
            backgroundColor: range === n ? theme.ink : theme.chip,
          }}>
          {n}
        </Txt>
      ))}
      <Txt weight={600} size={11} color="ink3">
        last reports
      </Txt>
    </View>
  );

  if (isPending) {
    return (
      <>
        {rangeSelector}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton height={110} radius={16} style={{ flex: 1 }} />
          <Skeleton height={110} radius={16} style={{ flex: 1 }} />
        </View>
        <Skeleton height={120} radius={16} />
      </>
    );
  }

  if (isError) {
    return (
      <>
        {rangeSelector}
        <ErrorState title="Couldn't load progress" onRetry={onRetry} />
      </>
    );
  }

  if (reports.length === 0) {
    return (
      <>
        {rangeSelector}
        <Card pad={26} style={{ alignItems: 'center', gap: 10, marginTop: 8 }}>
          <Txt weight={700} size={18} tracking={-0.3} style={{ textAlign: 'center' }}>
            No analyses yet
          </Txt>
          <Txt weight={500} size={14} lh={21} color="ink2" style={{ textAlign: 'center' }}>
            Analyze a climb and your technique score, estimated grade and recurring
            issues start trending here.
          </Txt>
        </Card>
      </>
    );
  }

  const overall = overallScoreTrend(reports).map((p) => p.value);
  const techScore = overall[overall.length - 1] ?? 0;
  const techDelta = overall.length > 1 ? techScore - overall[overall.length - 2] : 0;

  const withGrade = reports.filter((r) => gradeRank(r.grade_estimate) !== null);
  const estGrade = withGrade[withGrade.length - 1]?.grade_estimate ?? '—';
  const gradeDelta =
    withGrade.length > 1
      ? (gradeRank(withGrade[withGrade.length - 1].grade_estimate) ?? 0) -
        (gradeRank(withGrade[withGrade.length - 2].grade_estimate) ?? 0)
      : 0;

  const issues = issueSeverityTrends(reports);

  return (
    <>
      {rangeSelector}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card pad={15} style={{ flex: 1 }}>
          <Txt weight={700} size={10} tracking={1.2} color="ink3">
            TECHNIQUE SCORE
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginVertical: 6 }}>
            <Txt font="display" weight={700} size={34} lh={34} tracking={-1.4}>
              {techScore}
            </Txt>
            <Delta value={techDelta} goodUp />
          </View>
          <Sparkline data={overall} color={theme.accent} height={40} />
        </Card>
        <Card pad={15} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Txt weight={700} size={10} tracking={1.2} color="ink3">
              EST. GRADE
            </Txt>
            <Txt weight={700} size={10} tracking={1.2} color="accent">
              BETA
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginVertical: 6 }}>
            <Txt font="mono" weight={700} size={34} lh={34} tracking={-1.4} color={gradeColor(estGrade)}>
              {estGrade}
            </Txt>
            <Delta value={gradeDelta} goodUp />
          </View>
          <Sparkline
            data={withGrade.map((r) => gradeRank(r.grade_estimate) ?? 0)}
            color={theme.accent}
            height={40}
            fill={false}
          />
        </Card>
      </View>

      {issues.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Txt weight={700} size={17} tracking={-0.3}>
              Recurring issues
            </Txt>
            <Txt weight={700} size={11} tracking={1} color="ink3">
              PER CLIMB · LAST {reports.length}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {issues.map((t) => {
              const values = t.points.map((p) => p.value);
              const appearances = values.filter((v) => v > 0).length;
              const half = Math.ceil(values.length / 2);
              const early = values.slice(0, half).reduce((a, b) => a + b, 0);
              const late = values.slice(half).reduce((a, b) => a + b, 0);
              const word = t.latest === 0 ? 'solved' : late < early ? 'improving' : late > early ? 'worse' : 'steady';
              const wordColor = word === 'worse' ? theme.bad : word === 'steady' ? theme.ink2 : theme.good;
              const dot = sevValueColor(t.latest, theme);
              return (
                <Card key={t.key} pad={14} style={{ width: '47%', flexGrow: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Txt weight={700} size={13} numberOfLines={1} style={{ flex: 1 }}>
                      {issueLabel(t.key)}
                    </Txt>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginVertical: 4 }}>
                    <Txt font="mono" weight={700} size={22}>
                      {appearances}
                    </Txt>
                    <Txt weight={600} size={10} color="ink3">
                      OF {reports.length}
                    </Txt>
                  </View>
                  <Sparkline data={values} color={dot} height={34} fill={false} strokeWidth={2.5} />
                  <Txt weight={700} size={10} color={wordColor} style={{ marginTop: 4 }}>
                    {word === 'worse' ? '▲ worse' : word === 'steady' ? '— steady' : `▼ ${word}`}
                  </Txt>
                </Card>
              );
            })}
          </View>
        </>
      ) : (
        <Card inset pad={18}>
          <Txt weight={600} size={14} lh={21} color="ink2">
            No recurring technique issues flagged across your last {reports.length} analyses — nice work.
          </Txt>
        </Card>
      )}
    </>
  );
}
