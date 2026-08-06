import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { Button, Card, ErrorState, NavBar, ProgressBar, Screen, Skeleton, StatTile, Txt } from '@/components/ui';
import { useAdminUsage } from '@/hooks/use-admin-usage';
import { useTheme } from '@/hooks/use-theme';

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

function money(n: number): { dollars: string; cents: string } {
  const dollars = Math.floor(n);
  const cents = Math.round((n - dollars) * 100);
  return { dollars: `$${dollars.toLocaleString()}`, cents: `.${String(cents).padStart(2, '0')}` };
}

export default function CreditsScreen() {
  const theme = useTheme();
  const { data, isPending, isError, refetch } = useAdminUsage();

  return (
    <Screen edges={['top']}>
      <NavBar title="GPU credits" onBack={() => router.back()} right={<AdminTag />} />
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {isPending ? (
          <>
            <Skeleton height={170} radius={20} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Skeleton height={72} radius={16} style={{ flex: 1 }} />
              <Skeleton height={72} radius={16} style={{ flex: 1 }} />
            </View>
          </>
        ) : isError ? (
          <ErrorState
            title="Admin data unavailable"
            body="The billing API is unreachable right now. Try again in a moment."
            onRetry={() => refetch()}
          />
        ) : (
          <CreditsBody data={data} theme={theme} />
        )}
      </View>
    </Screen>
  );
}

function CreditsBody({ data, theme }: { data: NonNullable<ReturnType<typeof useAdminUsage>['data']>; theme: ReturnType<typeof useTheme> }) {
  const { credits } = data;
  if (!credits) {
    return (
      <Card pad={22} style={{ gap: 8 }}>
        <Txt weight={700} size={17}>
          Credits balance unavailable
        </Txt>
        <Txt weight={500} size={13} lh={20} color="ink2">
          Nosana is unconfigured or the balance couldn&apos;t be read right now.
        </Txt>
      </Card>
    );
  }

  const available = credits.available_usd;
  const low = available < data.credits_alert_usd;
  const avgCost = data.jobs_total > 0 && data.cost_usd_total > 0 ? data.cost_usd_total / data.jobs_total : 0.5;
  const analysesLeft = avgCost > 0 ? Math.floor(available / avgCost) : null;
  const burnDay = data.cost_usd_30d / 30;
  const runwayDays = burnDay > 0 ? Math.floor(available / burnDay) : null;
  const total = available + credits.reserved_usd;
  const pctLeft = total > 0 ? available / total : 1;
  const m = money(available);

  function topUp() {
    Alert.alert('Top up credits', 'Add Nosana Credits from the Nosana dashboard, then pull to refresh.');
  }

  return (
    <>
      {low ? (
        <Card pad={22} style={{ borderColor: 'rgba(224,50,42,0.35)', gap: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: theme.bad, alignItems: 'center', justifyContent: 'center' }}>
              <Txt weight={700} size={17} color="#fff">
                !
              </Txt>
            </View>
            <Txt weight={700} size={17} tracking={-0.3}>
              Credits running out
            </Txt>
          </View>
          <Txt weight={500} size={13} lh={20} color="ink2">
            {burnDay > 0 && runwayDays != null
              ? `At $${burnDay.toFixed(2)}/day this empties in about ${runwayDays} day${runwayDays === 1 ? '' : 's'}. New analyses are rejected at zero.`
              : 'New analyses will be rejected once the balance hits zero.'}
          </Txt>
          <Button label="Top up now" variant="danger" onPress={topUp} />
        </Card>
      ) : null}

      <Card pad={22} style={{ gap: 8 }}>
        <Txt weight={700} size={11} tracking={1.3} color="ink3">
          PREPAID BALANCE
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
          <Txt font="mono" weight={700} size={56} lh={56} tracking={-2.8} color={low ? theme.bad : theme.ink}>
            {m.dollars}
          </Txt>
          <Txt font="mono" weight={700} size={20} color={low ? theme.bad : theme.ink3}>
            {m.cents}
          </Txt>
        </View>
        {analysesLeft != null ? (
          <Txt weight={700} size={13} color="ink2">
            ≈ {analysesLeft.toLocaleString()} analyses at current rates
          </Txt>
        ) : null}
        <View style={{ marginTop: 6 }}>
          <ProgressBar value={pctLeft} color={low ? theme.bad : theme.good} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt font="mono" weight={600} size={11} color="ink3">
            ${credits.reserved_usd.toFixed(2)} RESERVED
          </Txt>
          <Txt font="mono" weight={600} size={11} color="ink3">
            {Math.round(pctLeft * 100)}% AVAILABLE
          </Txt>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile label="BURN / DAY" value={`$${burnDay.toFixed(2)}`} mono valueSize={24} />
        <StatTile label="RUNWAY" value={runwayDays != null ? `${runwayDays}d` : '—'} mono valueSize={24} />
      </View>

      <Button label="Top up credits" variant="ink" onPress={topUp} />
    </>
  );
}
