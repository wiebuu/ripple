import { db } from './db';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
type Push = { title: string; body: string; data?: Record<string, unknown> };

/**
 * Sends a push notification to every device a user has signed in on, through
 * Expo's push service (which delivers via FCM on Android and APNs on iOS).
 * Tokens Expo reports as no longer registered (app uninstalled, permission
 * revoked) are removed. Never throws: a failed push must not fail the request
 * that caused it, and the in-app notification is already saved.
 */
export async function sendPush(userId: string, push: Push) {
  try {
    const tokens = await db.pushToken.findMany({ where: { userId }, select: { token: true } });
    if (!tokens.length) return;
    const messages = tokens.map((t) => ({ to: t.token, sound: 'default', channelId: 'default', ...push }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) return console.warn('[push] Expo push service returned', res.status);
    const { data } = (await res.json()) as { data?: { status: 'ok' | 'error'; details?: { error?: string } }[] };
    const gone = (data ?? []).flatMap((ticket, i) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? [tokens[i].token] : []));
    if (gone.length) await db.pushToken.deleteMany({ where: { token: { in: gone } } });
  } catch (e) {
    console.warn('[push]', (e as Error).message);
  }
}
