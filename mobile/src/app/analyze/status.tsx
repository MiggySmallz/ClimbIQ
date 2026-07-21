import Ionicons from '@expo/vector-icons/Ionicons';
import type { JobStatus } from '@climbiq/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useJobStatus } from '@/hooks/use-job-status';

// The three "in progress" steps the user sees (spec §6). done/error are terminal.
const STEPS: { key: JobStatus; label: string; hint: string }[] = [
  { key: 'queued', label: 'Queued', hint: 'Finding a GPU node for your climb.' },
  { key: 'posted', label: 'On a GPU', hint: 'Your clip is on a GPU node.' },
  { key: 'running', label: 'Analyzing', hint: 'Detecting your movement and writing your report.' },
];

function stepIndex(status: JobStatus | undefined): number {
  switch (status) {
    case 'posted':
      return 1;
    case 'running':
      return 2;
    default:
      return 0; // queued (and the pre-fetch state)
  }
}

export default function JobStatusScreen() {
  const theme = useTheme();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { job, error } = useJobStatus(jobId);
  const status = job?.status;

  // On completion, hand off to the report screen (spec §6).
  useEffect(() => {
    if (status === 'done' && job?.report_id) {
      router.replace({ pathname: '/report/[id]', params: { id: job.report_id } });
    }
  }, [status, job?.report_id]);

  if (error) {
    return (
      <Terminal
        icon="alert-circle-outline"
        color="#8B8D98"
        title="Couldn't load status"
        hint="We couldn't reach your analysis. It's still running — check back from your profile."
      />
    );
  }

  if (status === 'error' || status === 'timeout') {
    return (
      <Terminal
        icon="close-circle"
        color="#E5484D"
        title="Analysis failed"
        hint="Something went wrong analyzing this climb. You can try analyzing it again from the Analyze tab."
      />
    );
  }

  if (status === 'done') {
    // The effect above is navigating away; show a brief hand-off.
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <ThemedText themeColor="textSecondary" type="small">
          Opening your report…
        </ThemedText>
      </View>
    );
  }

  const active = stepIndex(status);
  const showColdNote = !status || status === 'queued' || status === 'posted';

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <ThemedText style={styles.title}>Analyzing your climb</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          You can leave this screen — we&apos;ll notify you when your report is ready.
        </ThemedText>

        <View style={styles.steps}>
          {STEPS.map((step, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <View key={step.key} style={styles.step}>
                <View style={styles.stepIcon}>
                  {done ? (
                    <Ionicons name="checkmark-circle" size={24} color="#30A46C" />
                  ) : current ? (
                    <ActivityIndicator size="small" color="#208AEF" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color="#8B8D98" />
                  )}
                </View>
                <View style={styles.stepText}>
                  <ThemedText
                    type="smallBold"
                    themeColor={current || done ? 'text' : 'textSecondary'}>
                    {step.label}
                  </ThemedText>
                  {current && (
                    <ThemedText themeColor="textSecondary" type="small">
                      {step.hint}
                    </ThemedText>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {showColdNote && (
          <ThemedText themeColor="textSecondary" type="small" style={styles.coldNote}>
            First analyses can take a few minutes while a GPU node warms up.
          </ThemedText>
        )}
      </View>

      <Pressable
        style={[styles.primary, { backgroundColor: theme.backgroundSelected }]}
        onPress={() => router.replace('/(tabs)/analyze')}>
        <Text style={[styles.primaryText, { color: theme.text }]}>Leave for now</Text>
      </Pressable>
    </View>
  );
}

function Terminal({
  icon,
  color,
  title,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  hint: string;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={44} color={color} />
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={[styles.hint, { textAlign: 'center' }]}>
        {hint}
      </ThemedText>
      <Pressable style={styles.primary} onPress={() => router.replace('/(tabs)/analyze')}>
        <Text style={styles.primaryText}>Back to Analyze</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  body: { gap: 12 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  hint: { fontSize: 15 },
  steps: { gap: 20, marginTop: 20 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepIcon: { width: 26, alignItems: 'center' },
  stepText: { flex: 1, gap: 2 },
  coldNote: { marginTop: 24 },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
