import type { NotificationKind } from '../../../../shared';
import { db } from './db';
import { sendPush } from './push';

type Input = { kind: NotificationKind; title: string; body: string; campaignId?: string | null; dedupeKey?: string };

/** Sends an in-app notification unless the user muted that category. Dedupe keys prevent repeats. */
export async function notify(userId: string, n: Input) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { prefs: true } });
  const prefs = (user?.prefs ?? {}) as Partial<Record<NotificationKind, boolean>>;
  if (n.kind !== 'SECURITY' && prefs[n.kind] === false) return;
  try {
    await db.notification.create({
      data: { userId, kind: n.kind, title: n.title, body: n.body, campaignId: n.campaignId ?? null, dedupeKey: n.dedupeKey ?? `once:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` },
    });
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e; // duplicate dedupeKey: already notified
    return;
  }
  // Also to the user's phones, in the background so the request that triggered it isn't slowed down.
  void sendPush(userId, { title: n.title, body: n.body, data: { campaignId: n.campaignId ?? null, kind: n.kind } });
}

/** Owner, followers and successful backers of a campaign. */
export async function audienceOf(campaignId: string, opts: { owner?: boolean } = { owner: true }) {
  const c = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      ownerId: true,
      follows: { select: { userId: true } },
      contributions: { where: { status: 'SUCCEEDED', userId: { not: null } }, select: { userId: true } },
    },
  });
  if (!c) return [];
  const ids = new Set<string>();
  if (opts.owner) ids.add(c.ownerId);
  c.follows.forEach((f) => ids.add(f.userId));
  c.contributions.forEach((k) => k.userId && ids.add(k.userId));
  return [...ids];
}

export async function notifyMany(userIds: string[], n: Input) {
  await Promise.all(userIds.map((id) => notify(id, n)));
}
