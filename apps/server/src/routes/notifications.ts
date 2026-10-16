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
    const items = await db.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({
      items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, campaignId: n.campaignId, read: n.read, createdAt: n.createdAt.toISOString() })),
      unread: items.filter((n) => !n.read).length,
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
