import { Redirect, Tabs } from 'expo-router';
import { type ComponentProps } from 'react';

import { TabBar } from '@/components/tab-bar';
import { useAuth } from '@/lib/auth-context';

export default function TabsLayout() {
  const { session, profile } = useAuth();

  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // React Navigation's tabBar props are a superset of what TabBar reads; the
      // event-emitter generic doesn't structurally match, so cast at the boundary.
      tabBar={(props) => <TabBar {...(props as unknown as ComponentProps<typeof TabBar>)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="climbs" />
      <Tabs.Screen name="analyze" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
