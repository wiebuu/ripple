import { Router } from 'express';
import { z } from 'zod';
import { CATEGORIES, CHANNELS, CREATOR_TYPES, validateAll, firstInvalidStep, STEPS, type DraftContent } from '../../../../shared';
import { requireAuth } from '../lib/auth';
import { db } from '../lib/db';
import { ah, forbidden, HttpError, notFound } from '../lib/http';
import { transition } from '../lib/lifecycle';
import { columnsFromContent, contentOf, toSummary } from '../lib/serialize';

export const drafts = Router();
drafts.use(requireAuth);

const str = (max: number) => z.string().max(max);
const id = z.string().min(1).max(64);

/** Shape + size limits. Business rules (required fields etc.) come from shared/validation on submit. */
const DraftSchema = z.object({
  basics: z.object({
    title: str(120),
    category: z.union([z.enum(CATEGORIES), z.literal('')]),
    creatorName: str(80),
    creatorType: z.enum(CREATOR_TYPES),
    summary: str(400),
    coverImage: str(1000).optional(),
  }),
  story: z.object({
    headline: str(160),
    intro: str(2000),
    blocks: z
      .array(
        z.discriminatedUnion('type', [
          z.object({ id, type: z.literal('heading'), text: str(160) }),
          z.object({ id, type: z.literal('paragraph'), text: str(5000) }),
          z.object({ id, type: z.literal('image'), uri: str(1000), caption: str(300).optional(), credit: str(120).optional() }),
          z.object({ id, type: z.literal('stat'), value: str(30), label: str(160), sourceId: str(64).optional() }),
          z.object({ id, type: z.literal('quote'), text: str(600), attribution: str(120).optional() }),
        ]),
      )
      .max(40),
    sources: z.array(z.object({ id, title: str(200), url: str(1000), publisher: str(120).optional() })).max(20),
    actions: z.array(str(160)).max(6),
  }),
  visuals: z.object({
    coverImage: str(1000).optional(),
    adImages: z.array(str(1000)).max(6),
    adVideo: str(1000).optional(),
    adHeadline: str(80),
    adDescription: str(250),
    ctaText: str(40),
  }),
  reach: z.object({
    locations: z.array(str(80)).max(20),
    ageRange: z.tuple([z.number().int().min(13).max(100), z.number().int().min(13).max(100)]),
    interests: z.array(str(60)).max(20),
    channels: z.partialRecord(z.enum(CHANNELS.map((c) => c.key) as [string, ...string[]]), z.number().min(0).max(100)),
    durationDays: z.number().int().min(1).max(365),
  }),
  goal: z.number().min(0).max(1_000_000).nullable(),
  acceptedRules: z.boolean(),
});

const EDITABLE = ['DRAFT', 'CHANGES_REQUESTED'];
const LIVE = ['FUNDING', 'FUNDED', 'FUNDING_ENDED', 'DISTRIBUTION_PREP', 'PROMOTING'];

let slugSeq = 0;
const slugify = (s: string) =>
  (s || 'campaign')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) + `-${Date.now().toString(36)}${(slugSeq++ % 36).toString(36)}`;

async function ownCampaign(userId: string, id: string) {
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) throw notFound('Draft');
  if (c.ownerId !== userId) throw forbidden();
  return c;
}

drafts.post(
  '/',
  ah(async (req, res) => {
    const content = DraftSchema.parse(req.body.content) as DraftContent;
    const c = await db.campaign.create({
      data: { ownerId: req.user!.id, slug: slugify(content.basics.title), content: content as any, goal: content.goal, ...columnsFromContent(content) },
    });
    res.status(201).json({ id: c.id, status: c.status, updatedAt: c.updatedAt });
  }),
);

drafts.get(
  '/:id',
  ah(async (req, res) => {
    const c = await ownCampaign(req.user!.id, req.params.id);
    const notes = await db.reviewDecision.findMany({ where: { campaignId: c.id }, orderBy: { createdAt: 'desc' } });
    res.json({
      ...toSummary(c),
      content: (c.pendingContent as unknown as DraftContent) ?? contentOf(c),
      latestReviewNote: notes.find((n) => n.action === 'CHANGES_REQUESTED' || n.action === 'REJECTED')?.note ?? null,
    });
  }),
);

/** Autosave. Accepts partial-but-well-formed drafts. Never touches status. */
drafts.patch(
  '/:id',
  ah(async (req, res) => {
    const c = await ownCampaign(req.user!.id, req.params.id);
    const content = DraftSchema.parse(req.body.content) as DraftContent;
    if (EDITABLE.includes(c.status)) {
      const u = await db.campaign.update({
        where: { id: c.id },
        data: { content: content as any, goal: content.goal, ...columnsFromContent(content) },
      });
      return res.json({ id: u.id, status: u.status, updatedAt: u.updatedAt });
    }
    if (LIVE.includes(c.status)) {
      // Material edits to a live campaign wait for re-review before the public page or ads change.
      const u = await db.campaign.update({ where: { id: c.id }, data: { pendingContent: content as any } });
      return res.json({ id: u.id, status: u.status, updatedAt: u.updatedAt, pendingRevision: true });
    }
    throw new HttpError(409, 'This campaign can no longer be edited');
  }),
);

drafts.delete(
  '/:id',
  ah(async (req, res) => {
    const c = await ownCampaign(req.user!.id, req.params.id);
    if (c.status !== 'DRAFT') throw new HttpError(409, 'Only drafts can be deleted');
    await db.campaign.delete({ where: { id: c.id } });
    res.json({ ok: true });
  }),
);

drafts.post(
  '/:id/submit',
  ah(async (req, res) => {
    const c = await ownCampaign(req.user!.id, req.params.id);
    const content = contentOf(c);
    const errors = validateAll(content);
    if (Object.keys(errors).length) {
      const step = firstInvalidStep(content);
      throw new HttpError(422, `Some required details are missing in ${STEPS[step]}`, { errors, step });
    }
    const u = await transition(c.id, 'SUBMITTED', req.user!, { action: 'SUBMITTED' });
    res.json(toSummary(u));
  }),
);

/**
 * Creator cancels a campaign (or withdraws it from review). If anything was
 * raised, every successful contribution is refunded before it closes.
 */
drafts.post(
  '/:id/cancel',
  ah(async (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().max(500).optional() }).parse(req.body ?? {});
    const c = await ownCampaign(req.user!.id, req.params.id);
    if (!['DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'FUNDING'].includes(c.status)) {
      throw new HttpError(409, 'Campaigns can’t be cancelled once funding has closed. Contact support.');
    }
    await transition(c.id, 'CANCELLED', req.user!, { action: 'TRANSITION', note: reason ? `Cancelled by creator: ${reason}` : 'Cancelled by creator' });
    if (c.raised > 0) {
      await transition(c.id, 'REFUND_PENDING', null, { note: 'Refunding backers' });
      await db.contribution.updateMany({ where: { campaignId: c.id, status: 'SUCCEEDED' }, data: { status: 'REFUNDED' } });
      await transition(c.id, 'CANCELLED', null, { note: 'All contributions refunded (simulated)' });
    }
    res.json({ ok: true });
  }),
);

/** Submit a pending revision of a live campaign for re-review. */
drafts.post(
  '/:id/submit-revision',
  ah(async (req, res) => {
    const c = await ownCampaign(req.user!.id, req.params.id);
    if (!c.pendingContent) throw new HttpError(409, 'There are no pending edits');
    const errors = validateAll(c.pendingContent as unknown as DraftContent);
    if (Object.keys(errors).length) throw new HttpError(422, 'The revised campaign is missing required details', { errors });
    await db.reviewDecision.create({
      data: { campaignId: c.id, actorId: req.user!.id, actorName: req.user!.name, action: 'EDIT', fromStatus: c.status, toStatus: c.status, note: 'Revision submitted for re-review' },
    });
    res.json({ ok: true });
  }),
);
