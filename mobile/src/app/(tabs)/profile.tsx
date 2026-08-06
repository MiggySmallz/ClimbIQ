import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Screen, Txt } from '@/components/ui';
import { gradeColor, gradeRank, radius } from '@/constants/design';
import { useClimbs } from '@/hooks/use-climbs';
import { usePendingRequestCount } from '@/hooks/use-pending-requests';
import { useReportTrends } from '@/hooks/use-report-trends';
import { useTheme } from '@/hooks/use-theme';
import { totals } from '@/lib/climb-stats';
import { useAuth } from '@/lib/auth-context';
import { pickAvatarImage } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import { removeAvatarByUrl, updateProfile, uploadAvatar } from '@/services/profiles';

function Row({
  icon,
  label,
  onPress,
  badge,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  badge?: number;
  value?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        padding: 16,
        borderRadius: radius.lg,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.line,
        opacity: pressed ? 0.9 : 1,
      })}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: theme.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={theme.ink} />
      </View>
      <Txt weight={700} size={16} style={{ flex: 1 }}>
        {label}
      </Txt>
      {badge && badge > 0 ? (
        <View style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Txt font="mono" weight={700} size={13} color="#fff">
            {badge > 9 ? '9+' : String(badge)}
          </Txt>
        </View>
      ) : value ? (
        <Txt font="mono" weight={700} size={13} color="ink3">
          {value}
        </Txt>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={theme.ink3} />
    </Pressable>
  );
}

function StatCell({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Txt font="mono" weight={700} size={22} tracking={-0.7} color={color}>
        {value}
      </Txt>
      <Txt weight={700} size={10} tracking={1} color="ink3">
        {label}
      </Txt>
    </View>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { session, profile, isAdmin, refreshProfile } = useAuth();
  const pending = usePendingRequestCount();
  const climbsQ = useClimbs();
  const trendsQ = useReportTrends();
  const [signingOut, setSigningOut] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const climbs = climbsQ.data ?? [];
  const { sends } = totals(climbs);
  const reportsCount = trendsQ.data?.length ?? 0;
  const best = climbs
    .filter((c) => c.sent && c.grade)
    .reduce<string | null>((acc, c) => {
      if (!acc) return c.grade;
      return (gradeRank(c.grade) ?? -1) > (gradeRank(acc) ?? -1) ? c.grade : acc;
    }, null);

  async function handleChangeAvatar() {
    if (!session || avatarBusy) return;
    try {
      const uri = await pickAvatarImage();
      if (!uri) return;
      setAvatarBusy(true);
      const oldUrl = profile?.avatar_url ?? null;
      const url = await uploadAvatar(session.user.id, uri);
      await updateProfile(session.user.id, { avatar_url: url });
      if (oldUrl) await removeAvatarByUrl(oldUrl);
      await refreshProfile();
    } catch {
      Alert.alert('Avatar', 'Could not update your photo. Try again.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) Alert.alert('Sign out failed', error.message);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 18, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 6 }}>
          <Pressable onPress={handleChangeAvatar} style={{ width: 96, height: 96 }}>
            {avatarBusy ? (
              <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : (
              <Avatar url={profile?.avatar_url ?? null} username={profile?.username} size={96} tint={theme.accent} />
            )}
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: theme.ink, borderWidth: 3, borderColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="pencil" size={13} color={theme.bg} />
            </View>
          </Pressable>
          <View style={{ alignItems: 'center', gap: 3 }}>
            <Txt weight={700} size={26} tracking={-0.8}>
              @{profile?.username}
            </Txt>
            <Txt font="mono" weight={600} size={13} color="ink2">
              {session?.user.email}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 22, paddingVertical: 14, paddingHorizontal: 22, borderRadius: radius.lg, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }}>
            <StatCell value={sends} label="SENDS" />
            <View style={{ width: 1, backgroundColor: theme.line }} />
            <StatCell value={reportsCount} label="REPORTS" />
            <View style={{ width: 1, backgroundColor: theme.line }} />
            <StatCell value={best ?? '—'} label="BEST" color={best ? gradeColor(best) : undefined} />
          </View>
        </View>

        {/* Rows */}
        <View style={{ gap: 10 }}>
          <Row icon="people-outline" label="Friends" onPress={() => router.push('/friends')} badge={pending} />
          <Row icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
          {isAdmin ? (
            <>
              <Row icon="server-outline" label="GPU credits" onPress={() => router.push('/admin/credits')} value="ADMIN" />
              <Row icon="stats-chart-outline" label="Usage & cost" onPress={() => router.push('/admin/usage')} value="ADMIN" />
            </>
          ) : null}
          {__DEV__ ? (
            <Row icon="flask-outline" label="View sample report" onPress={() => router.push({ pathname: '/report/[id]', params: { id: 'sample' } })} />
          ) : null}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={{ padding: 17, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, alignItems: 'center' }}>
          {signingOut ? (
            <ActivityIndicator color={theme.bad} />
          ) : (
            <Txt weight={700} size={15} color="bad">
              Sign out
            </Txt>
          )}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
