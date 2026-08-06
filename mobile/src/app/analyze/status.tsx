import Ionicons from '@expo/vector-icons/Ionicons';
import type { JobStatus } from '@climbiq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Button, Card, ConfirmSheet, NavBar, ProgressRing, Screen, Txt } from '@/components/ui';
import { radius } from '@/constants/design';
import { useTheme } from '@/hooks/use-theme';
import { useJobStatus } from '@/hooks/use-job-status';
import { deleteAnalysis, retryAnalysis } from '@/services/uploads';

const STEPS: { key: string; label: string; hint: string }[] = [
  { key: 'queued', label: 'Queued', hint: 'Finding a GPU node for your climb.' },
  { key: 'posted', label: 'On a GPU', hint: 'Machine is warming up and decoding your clip.' },
  { key: 'running', label: 'Analyzing', hint: 'Detecting your movement and writing your report.' },
  { key: 'done', label: 'Report ready', hint: '' },
];

function activeIndex(status: JobStatus | undefined): number {
  switch (status) {
    case 'posted':
      return 1;
    case 'running':
      return 2;
    case 'done':
      return 3;
    default:
      return 0;
  }
}

function pctFor(status: JobStatus | undefined): number {
  switch (status) {
    case 'posted':
      return 0.3;
    case 'running':
      return 0.65;
    case 'done':
      return 1;
    default:
      return 0.08;
  }
}

export default function JobStatusScreen() {
  const theme = useTheme();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { job, error } = useJobStatus(jobId);
  const status = job?.status;
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qc = useQueryClient();

  async function onRetry() {
    if (!jobId || retrying) return;
    setRetrying(true);
    try {
      await retryAnalysis(jobId);
    } catch {
      Alert.alert('Could not retry', "We couldn't start the analysis again. Please try later.");
    } finally {
      setRetrying(false);
    }
  }

  async function runDelete() {
    if (!jobId || deleting) return;
    setDeleting(true);
    try {
      await deleteAnalysis(jobId);
      void qc.invalidateQueries({ queryKey: ['analyses'] });
      setConfirmDelete(false);
      router.replace('/(tabs)/analyze');
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
      Alert.alert('Delete failed', "Couldn't delete this analysis. Try again.");
    }
  }

  useEffect(() => {
    if (status === 'done' && job?.report_id) {
      router.replace({ pathname: '/report/[id]', params: { id: job.report_id } });
    }
  }, [status, job?.report_id]);

  // --- Load error ---
  if (error) {
    return (
      <Screen edges={['top']}>
        <NavBar title="Analysis" left={{ label: 'Close', onPress: () => router.replace('/(tabs)/analyze') }} />
        <View style={{ padding: 20 }}>
          <Card pad={24} style={{ gap: 12 }}>
            <Txt weight={700} size={18} tracking={-0.3}>
              Couldn&apos;t load status
            </Txt>
            <Txt weight={500} size={13} lh={20} color="ink2">
              We couldn&apos;t reach your analysis. It&apos;s still running — check back from the
              Analyze tab.
            </Txt>
            <Button label="Back to Analyze" variant="ink" size="md" onPress={() => router.replace('/(tabs)/analyze')} />
          </Card>
        </View>
      </Screen>
    );
  }

  // --- Terminal failed / timeout ---
  if (status === 'error' || status === 'timeout') {
    const timedOut = status === 'timeout';
    return (
      <Screen edges={['top']}>
        <NavBar title="Analysis" left={{ label: 'Close', onPress: () => router.replace('/(tabs)/analyze') }} />
        <View style={{ padding: 20 }}>
          <Card pad={24} style={{ gap: 13 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: timedOut ? theme.chip : 'rgba(224,50,42,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={timedOut ? 'time-outline' : 'close'} size={24} color={timedOut ? theme.ink2 : theme.bad} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Txt weight={700} size={18} tracking={-0.3}>
                  {timedOut ? 'Timed out' : 'Analysis failed'}
                </Txt>
                <Txt font="mono" weight={600} size={12} color="ink3">
                  {job?.id ? `job ${job.id.slice(0, 6)} · no charge` : 'no charge'}
                </Txt>
              </View>
            </View>
            <Txt weight={500} size={13} lh={20} color="ink2">
              {timedOut
                ? 'The GPU never freed up. Nothing wrong with your clip — resubmit it. Your credit was not spent.'
                : 'Something went wrong analyzing this climb. Your clip is still uploaded, so trying again won’t re-upload it. Your credit was not spent.'}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                label={timedOut ? 'Resubmit clip' : 'Try again'}
                variant={timedOut ? 'ink' : 'primary'}
                size="md"
                onPress={onRetry}
                busy={retrying}
                busyLabel="Restarting…"
              />
              {!timedOut ? (
                <Button
                  label="Re-trim clip"
                  variant="secondary"
                  size="md"
                  onPress={() => router.replace('/(tabs)/analyze')}
                />
              ) : null}
            </View>
          </Card>

          {/* Delete is deliberately separated from the retry card so it can't be
              hit by accident when reaching for "Try again". */}
          <Pressable
            onPress={() => setConfirmDelete(true)}
            disabled={deleting}
            style={{
              marginTop: 28,
              padding: 16,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: 'rgba(224,50,42,0.4)',
              alignItems: 'center',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Ionicons name="trash-outline" size={16} color={theme.bad} />
              <Txt weight={700} size={15} color="bad">
                Delete this analysis
              </Txt>
            </View>
          </Pressable>
        </View>

        <ConfirmSheet
          visible={confirmDelete}
          title="Delete this analysis?"
          message="This removes the failed run and its uploaded clip. This cannot be undone."
          confirmLabel="Delete analysis"
          confirmBusyLabel="Deleting…"
          cancelLabel="Keep it"
          busy={deleting}
          onConfirm={runDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      </Screen>
    );
  }

  // --- Done: hand-off ---
  if (status === 'done') {
    return (
      <Screen edges={['top']}>
        <NavBar title="Analysis" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Txt weight={600} size={13} color="ink2">
            Opening your report…
          </Txt>
        </View>
      </Screen>
    );
  }

  // --- In progress ---
  const active = activeIndex(status);
  const pct = pctFor(status);

  return (
    <Screen edges={['top']}>
      <NavBar title="Analysis" left={{ label: 'Close', onPress: () => router.replace('/(tabs)/analyze') }} />
      <View style={{ flex: 1, paddingHorizontal: 20, gap: 20 }}>
        <Card pad={24} style={{ alignItems: 'center', gap: 16 }}>
          <ProgressRing pct={pct} size={132} stroke={14} color={theme.accent}>
            <View style={{ alignItems: 'center' }}>
              <Txt font="mono" weight={700} size={34} lh={34} tracking={-1}>
                {Math.round(pct * 100)}
                <Txt font="mono" weight={700} size={16}>
                  %
                </Txt>
              </Txt>
              <Txt weight={700} size={10} tracking={1.2} color="ink3">
                {(status ?? 'queued').toUpperCase()}
              </Txt>
            </View>
          </ProgressRing>
          <View style={{ alignItems: 'center', gap: 5 }}>
            <Txt weight={700} size={20} tracking={-0.5}>
              Reading your movement
            </Txt>
            <Txt weight={500} size={13} lh={19} color="ink2" style={{ textAlign: 'center' }}>
              {STEPS[active].hint}
            </Txt>
          </View>
        </Card>

        <View>
          {STEPS.map((step, i) => {
            const done = i < active;
            const current = i === active;
            const isLast = i === STEPS.length - 1;
            return (
              <View key={step.key} style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: done ? theme.good : 'transparent',
                      borderWidth: done ? 0 : 3,
                      borderColor: current ? theme.accent : theme.line,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {done ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                  </View>
                  {!isLast ? (
                    <View style={{ flex: 1, width: 2, marginVertical: 3, backgroundColor: done ? theme.good : theme.line }} />
                  ) : null}
                </View>
                <View style={{ paddingBottom: 20 }}>
                  <Txt weight={700} size={15} color={current ? theme.accent : done ? theme.ink : theme.ink3}>
                    {step.label}
                  </Txt>
                  {current ? (
                    <Txt font="mono" weight={600} size={12} color="ink3">
                      running…
                    </Txt>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ padding: 20, gap: 10 }}>
        <Button
          label="Leave — notify me when it's done"
          variant="ink"
          left={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent }} />}
          onPress={() => router.replace('/(tabs)/analyze')}
        />
        <Txt weight={600} size={12} color="ink3" style={{ textAlign: 'center' }}>
          Work continues on our servers, not your phone.
        </Txt>
        {/* Escape hatch for a stuck run — cancels the Nosana job and deletes it. */}
        <Pressable
          onPress={() => setConfirmDelete(true)}
          disabled={deleting}
          hitSlop={8}
          style={{ alignSelf: 'center', paddingVertical: 6, opacity: deleting ? 0.6 : 1 }}>
          <Txt weight={700} size={13} color="bad">
            Cancel &amp; delete this analysis
          </Txt>
        </Pressable>
      </View>

      <ConfirmSheet
        visible={confirmDelete}
        title="Cancel this analysis?"
        message="This stops the analysis on the node and deletes its uploaded clip. This cannot be undone."
        confirmLabel="Cancel & delete"
        confirmBusyLabel="Cancelling…"
        cancelLabel="Keep analyzing"
        busy={deleting}
        onConfirm={runDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}
