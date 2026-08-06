// Expo push registration. Acquires this device's Expo push token and registers
// it with the orchestrator so the poller can notify on job done/failure.
// Best-effort throughout — a denied permission or missing token is never an
// error the user needs to see.

import type { PushPlatform } from '@climbiq/shared';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiVoid } from '@/lib/api';

// Foreground notifications should still surface a banner + sound. Set once at
// module load so it's active before any notification arrives.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function pushPlatform(): PushPlatform | null {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
}

/** Acquire and register this device's Expo push token. Safe to call repeatedly
 *  (the server upsert is idempotent) — e.g. on every sign-in. */
export async function registerPushToken(): Promise<void> {
  const platform = pushPlatform();
  if (!platform) return; // web/unknown — no push
  if (!Device.isDevice) return; // simulators/emulators can't get a push token

  try {
    let { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && canAskAgain) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    // Android requires a channel for notifications to display at all.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Analysis updates',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiVoid('/push/register', { method: 'POST', body: { token, platform } });
  } catch (err) {
    console.warn('[push] registration failed:', err);
  }
}
