import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CATEGORIES, CREATOR_TYPES, PUBLIC_STATUSES, type CampaignDetail } from '../../../../shared';
import { requireAuth } from '../lib/auth';
import { db } from '../lib/db';
import { ah, forbidden, HttpError, notFound } from '../lib/http';
import { audienceOf, notifyMany } from '../lib/notify';
import { contentOf, toReport, toSummary } from '../lib/serialize';

export const campaigns = Router();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  creatorType: z.enum(CREATOR_TYPES).optional(),
  status: z.enum(['funding', 'promoting', 'completed', 'all']).default('all'),
  sort: z.enum(['trending', 'newest', 'closest', 'ending', 'most_backed']).default('trending'),
  minPct: z.coerce.number().min(0).max(100).optional(),
  featured: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(50).default(30),
});

const STATUS_FILTER: Record<string, string[]> = {
  funding: ['FUNDING'],
  promoting: ['FUNDED', 'FUNDING_ENDED', 'DISTRIBUTION_PREP', 'PROMOTING'],
  completed: ['COMPLETED'],
  all: PUBLIC_STATUSES,
};

campaigns.get(
  '/',
  ah(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where: Prisma.CampaignWhereInput = {
      status: { in: STATUS_FILTER[q.status] },
      ...(q.category && { category: q.category }),
      ...(q.creatorType && { creatorType: q.creatorType }),
      ...(q.featured && { featured: true }),
      ...(q.q && {
        OR: [{ title: { contains: q.q } }, { summary: { contains: q.q } }, { creatorName: { contains: q.q } }, { category: { contains: q.q } }],
      }),
    };
    let rows = await db.campaign.findMany({ where });
    if (q.minPct) rows = rows.filter((c) => c.goal && (c.raised / c.goal) * 100 >= q.minPct!);

    const pct = (c: (typeof rows)[number]) => (c.goal ? c.raised / c.goal : 0);
    const open = (c: (typeof rows)[number]) => (c.status === 'FUNDING' ? 0 : 1);
    const sorters: Record<string, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      // Open campaigns first, then by recent momentum (backers weighted by recency).
      trending: (a, b) => open(a) - open(b) || b.backerCount / ageDays(b) - a.backerCount / ageDays(a),
      newest: (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
      closest: (a, b) => open(a) - open(b) || pct(b) - pct(a),
      ending: (a, b) => open(a) - open(b) || (a.endsAt?.getTime() ?? Infinity) - (b.endsAt?.getTime() ?? Infinity),
      most_backed: (a, b) => b.backerCount - a.backerCount,
    };
    rows.sort(sorters[q.sort]);
    res.json({ items: rows.slice(0, q.limit).map(toSummary), total: rows.length });
  }),
);

function ageDays(c: { publishedAt: Date | null }) {
  return Math.max(1, (Date.now() - (c.publishedAt?.getTime() ?? Date.now())) / 864e5);
}

/** Public detail. Drafts and in-review campaigns are only visible to their owner and reviewers. */
campaigns.get(
  '/:id',
  ah(async (req, res) => {
    const c = await db.campaign.findFirst({
      where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
      include: {
        updates: { orderBy: { createdAt: 'desc' } },
        decisions: { orderBy: { createdAt: 'asc' } },
        report: true,
        contributions: { where: { status: 'SUCCEEDED', showName: true }, orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!c) throw notFound('Campaign');
    const isOwner = req.user?.id === c.ownerId;
    const isReviewer = req.user?.role === 'REVIEWER';
    if (!PUBLIC_STATUSES.includes(c.status as any) && !isOwner && !isReviewer) throw notFound('Campaign');

    const [follow, save] = req.user
      ? await Promise.all([
          db.follow.findUnique({ where: { userId_campaignId: { userId: req.user.id, campaignId: c.id } } }),
          db.save.findUnique({ where: { userId_campaignId: { userId: req.user.id, campaignId: c.id } } }),
        ])
      : [null, null];

    const content = contentOf(c);
    const detail: CampaignDetail = {
      ...toSummary(c),
      story: content.story,
      visuals: content.visuals,
      reach: content.reach,
      ownerId: c.ownerId,
      isOwner,
      isFollowing: !!follow,
      isSaved: !!save,
      // Only opted-in names; amounts are never exposed publicly.
      publicBackers: c.contributions.map((k) => ({ name: k.displayName ?? 'A backer', at: k.createdAt.toISOString() })),
      updates: c.updates.map((u) => ({ id: u.id, title: u.title, body: u.body, createdAt: u.createdAt.toISOString() })),
      // Moderation notes are private to the owner and reviewers.
      reviewNotes:
        isOwner || isReviewer
          ? c.decisions.map((d) => ({
              id: d.id,
              action: d.action as any,
              fromStatus: d.fromStatus as any,
              toStatus: d.toStatus as any,
              note: d.note,
              reviewerName: isReviewer || d.action !== 'SUBMITTED' ? d.actorName : null,
              createdAt: d.createdAt.toISOString(),
            }))
          : [],
      report: toReport(c, c.report),
    };
    res.json({ ...detail, hasPendingRevision: !!c.pendingContent });
  }),
);

async function toggle(model: 'follow' | 'save', userId: string, campaignId: string, on: boolean) {
  const key = { userId_campaignId: { userId, campaignId } };
  const delegate = db[model] as any;
  if (on) await delegate.upsert({ where: key, create: { userId, campaignId }, update: {} });
  else await delegate.deleteMany({ where: { userId, campaignId } });
}

campaigns.post(
  '/:id/follow',
  requireAuth,
  ah(async (req, res) => {
    const { on } = z.object({ on: z.boolean() }).parse(req.body);
    await toggle('follow', req.user!.id, req.params.id, on);
    res.json({ ok: true, on });
  }),
);

campaigns.post(
  '/:id/save',
  requireAuth,
  ah(async (req, res) => {
    const { on } = z.object({ on: z.boolean() }).parse(req.body);
    await toggle('save', req.user!.id, req.params.id, on);
    res.json({ ok: true, on });
  }),
);

campaigns.post(
  '/:id/feedback',
  ah(async (req, res) => {
    const body = z.object({ question: z.enum(['VISUALS', 'MIND_CHANGED']), answer: z.enum(['NO', 'SOMEWHAT', 'YES']) }).parse(req.body);
    await db.feedback.create({ data: { campaignId: req.params.id, userId: req.user?.id ?? null, ...body } });
    res.json({ ok: true });
  }),
);

/** Creator posts an update to backers. Updates are text-only and do not change ads. */
campaigns.post(
  '/:id/updates',
  requireAuth,
  ah(async (req, res) => {
    const body = z.object({ title: z.string().trim().min(3).max(80), body: z.string().trim().min(10).max(2000) }).parse(req.body);
    const c = await db.campaign.findUnique({ where: { id: req.params.id } });
    if (!c) throw notFound('Campaign');
    if (c.ownerId !== req.user!.id) throw forbidden();
    if (!PUBLIC_STATUSES.includes(c.status as any)) throw new HttpError(409, 'Updates can be posted once the campaign is live');
    const u = await db.campaignUpdate.create({ data: { campaignId: c.id, ...body } });
    const audience = (await audienceOf(c.id, { owner: false })).filter((id) => id !== c.ownerId);
    await notifyMany(audience, { kind: 'UPDATE', title: `Update: ${c.title}`, body: body.title, campaignId: c.id, dedupeKey: `upd:${u.id}` });
    res.status(201).json(u);
  }),
);

campaigns.get(
  '/:id/report',
  ah(async (req, res) => {
    const c = await db.campaign.findUnique({ where: { id: req.params.id }, include: { report: true } });
    if (!c || !PUBLIC_STATUSES.includes(c.status as any)) throw notFound('Report');
    res.json({ campaign: toSummary(c), report: toReport(c, c.report) });
  }),
);
