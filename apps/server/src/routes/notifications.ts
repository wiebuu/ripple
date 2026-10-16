import { Router } from 'express';
import { z } from 'zod';
import type { NotificationKind } from '../../../../shared';
import { requireAuth } from '../lib/auth';
import { db } from '../lib/db';
import { ah } from '../lib/http';

export const notifications = Router();
notifications.use(requireAuth);

const KINDS: NotificationKind[] = ['SUBMISSION', 'REVIEW', 'FUNDING', 'MILESTONE', 'DEADLINE', 'CONTRIBUTION', 'PROMOTION', 'REPORT', 'UPDATE', 'SECURITY'];
const DEFAULT_PREFS = { ...Object.fromEntries(KINDS.map((k) => [k, true])), email: false, push: false };

notifications.get(
  '/',
  ah(async (req, res) => {
    const { limit, offset, scope } = z
      .object({ limit: z.coerce.number().int().min(1).max(50).default(15), offset: z.coerce.number().int().min(0).default(0), scope: z.enum(['all', 'following']).default('all') })
      .parse(req.query);
    // "following": only notifications about campaigns the user follows (not their own).
    const followedIds =
      scope === 'following'
        ? (await db.follow.findMany({ where: { userId: req.user!.id, campaign: { ownerId: { not: req.user!.id } } }, select: { campaignId: true } })).map((f) => f.campaignId)
        : null;
    const where = { userId: req.user!.id, ...(followedIds && { campaignId: { in: followedIds } }) };
    const [items, total, unread] = await Promise.all([
      db.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      db.notification.count({ where }),
      db.notification.count({ where: { userId: req.user!.id, read: false } }),
    ]);
    res.json({
      items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, campaignId: n.campaignId, read: n.read, createdAt: n.createdAt.toISOString() })),
      total,
      unread,
      nextOffset: offset + items.length < total ? offset + items.length : null,
    });
  }),
);

notifications.post(
  '/read',
  ah(async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.string()).optional() }).parse(req.body);
    await db.notification.updateMany({ where: { userId: req.user!.id, ...(ids && { id: { in: ids } }) }, data: { read: true } });
    res.json({ ok: true });
  }),
);

notifications.get(
  '/prefs',
  ah(async (req, res) => {
    const u = await db.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json({ ...DEFAULT_PREFS, ...((u.prefs as object) ?? {}) });
  }),
);

notifications.put(
  '/prefs',
  ah(async (req, res) => {
    const schema = z.object(Object.fromEntries([...KINDS, 'email', 'push'].map((k) => [k, z.boolean().optional()])));
    const body = schema.parse(req.body);
    // Security notifications cannot be turned off.
    const prefs = { ...DEFAULT_PREFS, ...body, SECURITY: true };
    await db.user.update({ where: { id: req.user!.id }, data: { prefs } });
    res.json(prefs);
  }),
);
