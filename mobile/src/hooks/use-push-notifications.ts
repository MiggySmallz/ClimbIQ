import type { PushData } from '@climbiq/shared';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';
import { registerPushToken } from '@/lib/push';

function deepLink(data: PushData | undefined): void {
  if (!data) return;
  if (data.type === 'report') {
    router.push({ pathname: '/report/[id]', params: { id: data.reportId } });
  } else if (data.type === 'retry') {
    router.push({ pathname: '/analyze/status', params: { jobId: data.jobId } });
  }
}

function dataOf(response: Notifications.NotificationResponse): PushData | undefined {
  return response.notification.request.content.data as PushData | undefined;
}

export function usePushNotifications(): void {
  const { session } = useAuth();
  const userId = session?.user.id;

  // Register (and re-register on an account switch) whenever a user is signed in.
  useEffect(() => {
    if (!userId) return;
    void registerPushToken();
  }, [userId]);

  // Taps while the app is running (foreground or background).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      deepLink(dataOf(response));
    });
    return () => sub.remove();
  }, []);

  // Cold start: the app was launched by tapping a notification.
  useEffect(() => {
    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!cancelled && response) deepLink(dataOf(response));
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
