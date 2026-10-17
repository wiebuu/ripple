import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CATEGORIES, COMPLAINT_REASONS, CREATOR_TYPES, PUBLIC_STATUSES, STATUS_META, type BackerActivity, type CampaignDetail } from '../../../../shared';
import { requireAuth } from '../lib/auth';
import { db } from '../lib/db';
import { ah, forbidden, HttpError, notFound } from '../lib/http';
import { audienceOf, notify, notifyMany } from '../lib/notify';
import { contentOf, toReport, toSummary } from '../lib/serialize';

export const campaigns = Router();

const isObjectId = (s: string) => /^[a-f0-9]{24}$/i.test(s);

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  creatorType: z.enum(CREATOR_TYPES).optional(),
  status: z.enum(['funding', 'promoting', 'completed', 'all']).default('all'),
  sort: z.enum(['trending', 'newest', 'closest', 'ending', 'most_backed']).default('trending'),
  minPct: z.coerce.number().min(0).max(100).optional(),
  featured: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
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
        OR: (['title', 'summary', 'creatorName', 'category'] as const).map((f) => ({ [f]: { contains: q.q, mode: 'insensitive' as const } })),
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
    // Offset pagination: the app requests one page at a time as the user scrolls.
    const page = rows.slice(q.offset, q.offset + q.limit);
    const nextOffset = q.offset + page.length < rows.length ? q.offset + page.length : null;
    const followed = req.user
      ? new Set((await db.follow.findMany({ where: { userId: req.user.id, campaignId: { in: page.map((c) => c.id) } }, select: { campaignId: true } })).map((f) => f.campaignId))
      : null;
    res.json({ items: page.map((c) => ({ ...toSummary(c), ...(followed && { isFollowing: followed.has(c.id) }) })), total: rows.length, nextOffset });
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
      // Links may use the id or the human-readable slug.
      where: isObjectId(req.params.id) ? { OR: [{ id: req.params.id }, { slug: req.params.id }] } : { slug: req.params.id },
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
    res.json({ ...detail, hasPendingRevision: !!c.pendingContent, ...(isOwner && { backerActivity: await backerActivity(c.id) }) });
  }),
);

/** Creator analytics: recent contributions (names only if the backer opted in) and 14-day totals. */
async function backerActivity(campaignId: string): Promise<BackerActivity> {
  const since = new Date(Date.now() - 14 * 864e5);
  const rows = await db.contribution.findMany({ where: { campaignId, status: 'SUCCEEDED' }, orderBy: { createdAt: 'desc' }, take: 200 });
  const daily = new Map<string, { amount: number; count: number }>();
  for (let i = 13; i >= 0; i--) daily.set(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), { amount: 0, count: 0 });
  for (const k of rows) {
    if (k.createdAt < since) continue;
    const d = daily.get(k.createdAt.toISOString().slice(0, 10));
    if (d) {
      d.amount += k.amount;
      d.count += 1;
    }
  }
  return {
    recent: rows.slice(0, 8).map((k) => ({ amount: k.amount, name: k.showName && k.displayName ? k.displayName : 'Private backer', at: k.createdAt.toISOString() })),
    daily: [...daily.entries()].map(([day, v]) => ({ day, ...v })),
  };
}

/** Anyone (including guests) can report a campaign; reviewers handle it. */
campaigns.post(
  '/:id/complaints',
  ah(async (req, res) => {
    const reasons = COMPLAINT_REASONS.map((r) => r.key) as [string, ...string[]];
    const body = z.object({ reason: z.enum(reasons), details: z.string().trim().max(1000).optional() }).parse(req.body);
    const c = await db.campaign.findUnique({ where: { id: req.params.id } });
    if (!c || !PUBLIC_STATUSES.includes(c.status as any)) throw notFound('Campaign');
    if (req.user) {
      const dup = await db.complaint.findFirst({ where: { campaignId: c.id, userId: req.user.id, status: 'OPEN' } });
      if (dup) throw new HttpError(409, 'You already reported this campaign. Our review team is looking at it.');
    }
    const k = await db.complaint.create({ data: { campaignId: c.id, userId: req.user?.id ?? null, reason: body.reason, details: body.details || null } });
    const reviewers = await db.user.findMany({ where: { role: 'REVIEWER' }, select: { id: true } });
    await notifyMany(reviewers.map((r) => r.id), { kind: 'REVIEW', title: 'New report', body: `“${c.title}” was reported: ${COMPLAINT_REASONS.find((r) => r.key === body.reason)?.label}.`, campaignId: c.id, dedupeKey: `complaint:${k.id}` });
    res.status(201).json({ ok: true });
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
    if (on) {
      const c = await db.campaign.findUnique({ where: { id: req.params.id } });
      if (c && c.ownerId !== req.user!.id) {
        const pct = c.goal ? Math.round((c.raised / c.goal) * 100) : 0;
        await notify(req.user!.id, {
          kind: 'FUNDING',
          title: `Following “${c.title}”`,
          body: `${STATUS_META[c.status as keyof typeof STATUS_META]?.label ?? 'Live'} · ${pct}% funded. You’ll hear about milestones, when ads launch, delivery updates and the final report.`,
          campaignId: c.id,
          dedupeKey: `follow:${c.id}`,
        });
      }
    }
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
    // Owners see the full money breakdown; backers and visitors get the delivery picture.
    res.json({ campaign: toSummary(c), report: toReport(c, c.report), isOwner: req.user?.id === c.ownerId });
  }),
);
