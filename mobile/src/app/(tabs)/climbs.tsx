import Ionicons from '@expo/vector-icons/Ionicons';
import type { Climb } from '@climbiq/shared';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useClimbs } from '@/hooks/use-climbs';

function ClimbRow({ climb }: { climb: Climb }) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push({ pathname: '/climb-form', params: { id: climb.id } })}>
      <View style={styles.rowMain}>
        <ThemedText style={styles.rowName} numberOfLines={1}>
          {climb.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.rowMeta} numberOfLines={1}>
          {[climb.location, climb.style, climb.attempted_at].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>
      {climb.grade ? (
        <View style={[styles.gradeBadge, climb.sent ? styles.gradeSent : styles.gradeAttempt]}>
          <Text style={styles.gradeText}>{climb.grade}</Text>
        </View>
      ) : null}
      <Ionicons
        name={climb.sent ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={climb.sent ? '#30A46C' : '#8B8D98'}
      />
    </Pressable>
  );
}

export default function ClimbsScreen() {
  const { data, isPending, isError, refetch, isRefetching } = useClimbs();

  return (
    <View style={styles.container}>
        {isPending ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">Couldn&apos;t load your climbs.</ThemedText>
            <Pressable style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.center}>
            <ThemedText style={styles.emptyTitle}>No climbs yet</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
              Log your first boulder with the + button.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => <ClimbRow climb={item} />}
            contentContainerStyle={styles.list}
            refreshing={isRefetching}
            onRefresh={() => refetch()}
          />
        )}

      <Pressable style={styles.fab} onPress={() => router.push('/climb-form')}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  list: { padding: 12, paddingBottom: 96 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '600' },
  rowMeta: { fontSize: 13 },
  gradeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  gradeSent: { backgroundColor: '#30A46C' },
  gradeAttempt: { backgroundColor: '#8B8D98' },
  gradeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyHint: { fontSize: 14, textAlign: 'center' },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
