// Push notifications on terminal job transitions. The poller calls these when a
// job reaches done or a user-visible failure; each sends an Expo push to every
// device the recipient has registered and prunes tokens Expo reports as dead.

import type { PushData } from '@climbiq/shared';
import type { FastifyInstance } from 'fastify';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface NotifiableJob {
  id: string;
  report_id: string | null;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/** Send one message to all of a user's registered devices. Failures never throw
 *  — a push is best-effort and must not wedge the poller. */
async function pushToUser(
  app: FastifyInstance,
  userId: string,
  message: { title: string; body: string; data: PushData },
): Promise<void> {
  const { data, error } = await app.supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);
  if (error) {
    app.log.error(error, 'push_tokens select failed');
    return;
  }
  const tokens = (data ?? []).map((r) => (r as { token: string }).token);
  if (tokens.length === 0) return;

  const messages = tokens.map((to) => ({ to, sound: 'default', ...message }));

  let tickets: ExpoTicket[] = [];
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      app.log.error({ status: res.status }, 'expo push send non-2xx');
      return;
    }
    const json = (await res.json()) as { data?: ExpoTicket[] };
    tickets = json.data ?? [];
  } catch (err) {
    app.log.error(err, 'expo push send failed');
    return;
  }

  // Prune tokens Expo says are dead so we stop pushing to uninstalled devices.
  const dead = tokens.filter(
    (_t, i) => tickets[i]?.status === 'error' && tickets[i]?.details?.error === 'DeviceNotRegistered',
  );
  if (dead.length > 0) {
    await app.supabase.from('push_tokens').delete().eq('user_id', userId).in('token', dead);
  }
}

/** Analysis finished successfully — a report row now exists. */
export async function notifyJobDone(
  app: FastifyInstance,
  job: NotifiableJob,
  recipientUserId: string,
): Promise<void> {
  app.log.info({ jobId: job.id, reportId: job.report_id }, 'analysis done → push');
  if (!job.report_id) return;
  await pushToUser(app, recipientUserId, {
    title: 'Your climb analysis is ready 🧗',
    body: 'Tap to see your coaching report.',
    data: { type: 'report', reportId: job.report_id },
  });
}

/** Analysis failed/timed out after retries — user-visible failure. */
export async function notifyJobFailed(
  app: FastifyInstance,
  job: NotifiableJob,
  recipientUserId: string,
): Promise<void> {
  app.log.info({ jobId: job.id }, 'analysis failed → push');
  await pushToUser(app, recipientUserId, {
    title: "Your climb analysis didn't finish",
    body: 'Something went wrong. Tap to try again.',
    data: { type: 'retry', jobId: job.id },
  });
}
