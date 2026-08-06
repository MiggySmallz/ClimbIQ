import DateTimePicker from '@react-native-community/datetimepicker';
import type { Climb, ClimbInput } from '@climbiq/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  ErrorState,
  Field,
  GradeChip,
  NavBar,
  Screen,
  Txt,
} from '@/components/ui';
import { radius } from '@/constants/design';
import { useClimb, useCreateClimb, useDeleteClimb, useUpdateClimb } from '@/hooks/use-climbs';
import { useTheme } from '@/hooks/use-theme';

const GRADES = ['VB', ...Array.from({ length: 11 }, (_, i) => `V${i}`)];
const STYLE_OPTIONS = ['Slab', 'Vertical', 'Overhang', 'Roof', 'Crimps', 'Slopers', 'Dyno', 'Compression'];

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function prettyDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ClimbFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = typeof id === 'string' && id.length > 0;
  const existing = useClimb(isEdit ? id : undefined);

  if (isEdit && existing.isPending) {
    return (
      <Screen>
        <NavBar title="Edit climb" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }
  if (isEdit && existing.isError) {
    return (
      <Screen padded={20}>
        <NavBar title="Edit climb" onBack={() => router.back()} />
        <ErrorState
          title="Couldn't load this climb"
          body="We couldn't reach the server. Retry to edit it."
          onRetry={() => existing.refetch()}
        />
      </Screen>
    );
  }
  return <ClimbForm id={isEdit ? id : undefined} initial={existing.data ?? null} />;
}

function ClimbForm({ id, initial }: { id: string | undefined; initial: Climb | null }) {
  const theme = useTheme();
  const isEdit = id !== undefined;
  const create = useCreateClimb();
  const update = useUpdateClimb();
  const remove = useDeleteClimb();

  const [name, setName] = useState(initial?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [location, setLocation] = useState(initial?.location ?? '');
  const [grade, setGrade] = useState<string | null>(initial?.grade ?? null);
  const [styles, setStyles] = useState<string[]>(
    initial?.style ? initial.style.split(',').map((s) => s.trim()).filter(Boolean) : [],
  );
  const [sent, setSent] = useState(initial?.sent ?? false);
  const [attemptedAt, setAttemptedAt] = useState(initial?.attempted_at ?? toDateString(new Date()));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const busy = create.isPending || update.isPending || remove.isPending;

  function toggleStyle(s: string) {
    setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError('A name is required — "Blue slab, left" is fine.');
      return;
    }
    setNameError(null);
    setSaveError(false);
    const input: ClimbInput = {
      name: name.trim(),
      location: location.trim() || null,
      grade,
      style: styles.length > 0 ? styles.join(', ') : null,
      sent,
      attempted_at: attemptedAt,
      notes: notes.trim() || null,
    };
    try {
      if (id !== undefined) await update.mutateAsync({ id, input });
      else await create.mutateAsync(input);
      router.back();
    } catch {
      setSaveError(true);
    }
  }

  async function runDelete() {
    if (id === undefined) return;
    try {
      await remove.mutateAsync(id);
      setConfirmDelete(false);
      router.back();
    } catch {
      setConfirmDelete(false);
      setSaveError(true);
    }
  }

  return (
    <Screen edges={['top']}>
      <NavBar
        title={isEdit ? 'Edit climb' : 'New climb'}
        left={{ label: 'Cancel', onPress: () => router.back(), disabled: busy }}
        right={{ label: 'Save', onPress: handleSave, disabled: busy }}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 18 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Field
          label="NAME"
          labelTag="REQUIRED"
          placeholder="e.g. Blue Crimp Ladder"
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (nameError) setNameError(null);
          }}
          error={nameError ?? undefined}
          editable={!busy}
        />

        <Field
          label="GYM / LOCATION"
          placeholder="e.g. Beta Boulders"
          value={location}
          onChangeText={setLocation}
          editable={!busy}
        />

        <View style={{ gap: 9 }}>
          <Txt weight={700} size={11} tracking={1.4} color="ink3">
            GRADE
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {GRADES.map((g) => (
              <GradeChip key={g} grade={g} selected={grade === g} onPress={() => setGrade(grade === g ? null : g)} />
            ))}
          </View>
        </View>

        <View style={{ gap: 9 }}>
          <Txt weight={700} size={11} tracking={1.4} color="ink3">
            STYLE · MULTI
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {STYLE_OPTIONS.map((s) => (
              <Chip key={s} label={s} selected={styles.includes(s)} onPress={() => toggleStyle(s)} />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card pad={0} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
            <Txt weight={700} size={15}>
              Sent it?
            </Txt>
            <Switch
              value={sent}
              onValueChange={setSent}
              trackColor={{ true: theme.good, false: theme.chip }}
              thumbColor="#fff"
              ios_backgroundColor={theme.chip}
            />
          </Card>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{ flex: 1 }}>
            <Card pad={0} style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 3 }}>
              <Txt weight={700} size={10} tracking={1.2} color="ink3">
                DATE
              </Txt>
              <Txt font="mono" weight={700} size={15}>
                {prettyDate(attemptedAt)}
              </Txt>
            </Card>
          </Pressable>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={new Date(attemptedAt + 'T00:00:00')}
            mode="date"
            maximumDate={new Date()}
            onChange={(_event, date) => {
              setShowDatePicker(false);
              if (date) setAttemptedAt(toDateString(date));
            }}
          />
        )}

        <Field
          label="NOTES"
          placeholder="Beta, conditions, how it felt…"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={{ minHeight: 74, textAlignVertical: 'top' }}
          editable={!busy}
        />

        {saveError ? (
          <Txt weight={700} size={13} color="bad">
            Could not save. Check your connection and try again.
          </Txt>
        ) : null}

        <Button
          label={isEdit ? 'Save changes' : 'Save climb'}
          onPress={handleSave}
          busy={busy && !remove.isPending}
          busyLabel="Saving…"
        />

        {isEdit ? (
          <Pressable
            onPress={() => setConfirmDelete(true)}
            disabled={busy}
            style={{
              padding: 16,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: 'rgba(224,50,42,0.4)',
              alignItems: 'center',
            }}>
            <Txt weight={700} size={15} color="bad">
              Delete this climb
            </Txt>
          </Pressable>
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={confirmDelete}
        title={`Delete “${initial?.name ?? 'this climb'}”?`}
        message="This removes the log entry. Any linked report stays, but loses its journal link."
        confirmLabel="Delete climb"
        confirmBusyLabel="Deleting…"
        cancelLabel="Keep it"
        busy={remove.isPending}
        onConfirm={runDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}
