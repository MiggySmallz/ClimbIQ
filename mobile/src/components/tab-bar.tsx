import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { usePendingRequestCount } from '@/hooks/use-pending-requests';
import { Txt } from '@/components/ui/txt';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Minimal shape of the props expo-router's `Tabs` passes to a custom `tabBar`.
 *  `emit` is loosely typed so React Navigation's generic emitter is assignable. */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (...args: unknown[]) => { defaultPrevented?: boolean };
    navigate: (name: string) => void;
  };
};

const ICONS: Record<string, { on: IconName; off: IconName; label: string }> = {
  index: { on: 'home', off: 'home-outline', label: 'HOME' },
  climbs: { on: 'book', off: 'book-outline', label: 'CLIMBS' },
  analyze: { on: 'play', off: 'play', label: 'ANALYZE' },
  feed: { on: 'people', off: 'people-outline', label: 'FEED' },
  profile: { on: 'person-circle', off: 'person-circle-outline', label: 'PROFILE' },
};

/** Custom bottom nav with an elevated center Analyze button (per design). */
export function TabBar({ state, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pending = usePendingRequestCount();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.card,
        borderTopWidth: 1,
        borderTopColor: theme.line,
        paddingTop: 12,
        paddingHorizontal: 14,
        paddingBottom: Math.max(insets.bottom, 12),
      }}>
      {state.routes.map((route, index) => {
        const meta = ICONS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const isCenter = route.name === 'analyze';
        const badge = route.name === 'profile' && pending > 0 ? pending : 0;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center', gap: 5 }}>
            {isCenter ? (
              <View
                style={{
                  width: 44,
                  height: 44,
                  marginTop: -16,
                  borderRadius: 14,
                  backgroundColor: focused ? theme.accent : theme.ink,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: focused ? theme.accent : theme.ink,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 6,
                }}>
                <Ionicons name="play" size={20} color={focused ? '#fff' : theme.bg} />
              </View>
            ) : (
              <View>
                <Ionicons
                  name={focused ? meta.on : meta.off}
                  size={22}
                  color={focused ? theme.accent : theme.ink3}
                />
                {badge > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -5,
                      right: -8,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      borderRadius: 8,
                      backgroundColor: theme.bad,
                      borderWidth: 2,
                      borderColor: theme.card,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Txt font="mono" weight={700} size={9} color="#fff">
                      {badge > 9 ? '9+' : String(badge)}
                    </Txt>
                  </View>
                ) : null}
              </View>
            )}
            <Txt
              weight={700}
              size={10}
              tracking={0.6}
              color={focused ? theme.accent : theme.ink3}>
              {meta.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
