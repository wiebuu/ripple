import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth';
import { db } from '../lib/db';
import { ah } from '../lib/http';
import { toContribution, toSummary } from '../lib/serialize';

export const me = Router();
me.use(requireAuth);

me.get(
  '/campaigns',
  ah(async (req, res) => {
    const rows = await db.campaign.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      include: { decisions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    res.json({
      items: rows.map((c) => ({ ...toSummary(c), hasPendingRevision: !!c.pendingContent, latestNote: c.decisions[0]?.note ?? null })),
    });
  }),
);

me.get(
  '/contributions',
  ah(async (req, res) => {
    const { limit, offset } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(15), offset: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    // Pending rows without a card are abandoned checkouts; they never appear in history.
    const where = { userId: req.user!.id, NOT: { status: 'PENDING', cardLast4: null } };
    const [rows, total] = await Promise.all([
      db.contribution.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset, include: { campaign: { select: { title: true, coverImage: true } } } }),
      db.contribution.count({ where }),
    ]);
    res.json({ items: rows.map(toContribution), total, nextOffset: offset + rows.length < total ? offset + rows.length : null });
  }),
);

/** Campaigns the user successfully backed (one row per campaign). */
me.get(
  '/backed',
  ah(async (req, res) => {
    const rows = await db.campaign.findMany({
      where: { contributions: { some: { userId: req.user!.id, status: 'SUCCEEDED' } } },
      include: { contributions: { where: { userId: req.user!.id, status: 'SUCCEEDED' }, select: { amount: true } } },
    });
    res.json({ items: rows.map((c) => ({ ...toSummary(c), myTotal: c.contributions.reduce((a, b) => a + b.amount, 0) })) });
  }),
);

me.get(
  '/saved',
  ah(async (req, res) => {
    const rows = await db.save.findMany({ where: { userId: req.user!.id }, include: { campaign: true }, orderBy: { createdAt: 'desc' } });
    res.json({ items: rows.map((s) => toSummary(s.campaign)) });
  }),
);

me.get(
  '/following',
  ah(async (req, res) => {
    const rows = await db.follow.findMany({ where: { userId: req.user!.id }, include: { campaign: true }, orderBy: { createdAt: 'desc' } });
    res.json({ items: rows.map((s) => toSummary(s.campaign)) });
  }),
);
