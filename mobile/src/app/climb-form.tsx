import DateTimePicker from '@react-native-community/datetimepicker';
import type { Climb, ClimbInput } from '@climbiq/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useClimb, useCreateClimb, useDeleteClimb, useUpdateClimb } from '@/hooks/use-climbs';

const GRADES = ['VB', ...Array.from({ length: 16 }, (_, i) => `V${i}`)];
const STYLES = ['Slab', 'Vertical', 'Overhang', 'Roof', 'Crimps', 'Slopers', 'Dyno', 'Compression'];

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function ClimbFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = typeof id === 'string' && id.length > 0;
  const existing = useClimb(isEdit ? id : undefined);

  // Edit mode: wait for the climb before mounting the form, so its state can
  // initialize directly from the loaded values (no prefill effect).
  if (isEdit && existing.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  // Don't fall through to a blank form on a load error — a blank form still
  // carries the edit `id`, so "Save changes" would wipe the climb (M6.5).
  if (isEdit && existing.isError) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">Couldn&apos;t load this climb.</ThemedText>
        <Pressable style={styles.retryButton} onPress={() => existing.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  return <ClimbForm id={isEdit ? id : undefined} initial={existing.data ?? null} />;
}

function ClimbForm({ id, initial }: { id: string | undefined; initial: Climb | null }) {
  const isEdit = id !== undefined;
  const create = useCreateClimb();
  const update = useUpdateClimb();
  const remove = useDeleteClimb();

  const [name, setName] = useState(initial?.name ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [grade, setGrade] = useState<string | null>(initial?.grade ?? null);
  const [style, setStyle] = useState<string | null>(initial?.style ?? null);
  const [sent, setSent] = useState(initial?.sent ?? false);
  const [attemptedAt, setAttemptedAt] = useState(initial?.attempted_at ?? toDateString(new Date()));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const busy = create.isPending || update.isPending || remove.isPending;

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Climb', 'Give the climb a name.');
      return;
    }
    const input: ClimbInput = {
      name: name.trim(),
      location: location.trim() || null,
      grade,
      style,
      sent,
      attempted_at: attemptedAt,
      notes: notes.trim() || null,
    };
    try {
      if (id !== undefined) await update.mutateAsync({ id, input });
      else await create.mutateAsync(input);
      router.back();
    } catch {
      Alert.alert('Save failed', 'Could not save the climb. Try again.');
    }
  }

  function handleDelete() {
    if (id === undefined) return;
    Alert.alert('Delete climb', 'This removes the climb from your journal permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(id);
            router.back();
          } catch {
            Alert.alert('Delete failed', 'Could not delete the climb. Try again.');
          }
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: isEdit ? 'Edit climb' : 'Log climb', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.label}>Name *</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="e.g. Orange cave problem"
          value={name}
          onChangeText={setName}
        />

        <ThemedText style={styles.label}>Gym / location</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="e.g. Boulder Barn"
          value={location}
          onChangeText={setLocation}
        />

        <ThemedText style={styles.label}>Grade</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {GRADES.map((g) => (
            <Pressable
              key={g}
              style={[styles.chip, grade === g && styles.chipSelected]}
              onPress={() => setGrade(grade === g ? null : g)}>
              <Text style={[styles.chipText, grade === g && styles.chipTextSelected]}>{g}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ThemedText style={styles.label}>Style</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {STYLES.map((st) => (
            <Pressable
              key={st}
              style={[styles.chip, style === st && styles.chipSelected]}
              onPress={() => setStyle(style === st ? null : st)}>
              <Text style={[styles.chipText, style === st && styles.chipTextSelected]}>{st}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.rowBetween}>
          <ThemedText style={styles.label}>Sent it?</ThemedText>
          <Switch value={sent} onValueChange={setSent} />
        </View>

        <ThemedText style={styles.label}>Date</ThemedText>
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <ThemedText>{attemptedAt}</ThemedText>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={new Date(attemptedAt)}
            mode="date"
            maximumDate={new Date()}
            onChange={(_event, date) => {
              setShowDatePicker(false);
              if (date) setAttemptedAt(toDateString(date));
            }}
          />
        )}

        <ThemedText style={styles.label}>Notes</ThemedText>
        <TextInput
          style={[styles.input, styles.notes]}
          placeholder="Beta, conditions, how it felt…"
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>{isEdit ? 'Save changes' : 'Log climb'}</Text>
          )}
        </Pressable>

        {isEdit && (
          <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={busy}>
            <Text style={styles.deleteText}>Delete climb</Text>
          </Pressable>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  retryButton: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  container: { padding: 16, paddingBottom: 48, gap: 6 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#D0D4DA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#1B1F24',
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#D0D4DA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#208AEF', borderColor: '#208AEF' },
  chipText: { fontSize: 14, color: '#1B1F24' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5484D',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteText: { color: '#E5484D', fontSize: 15, fontWeight: '600' },
});
