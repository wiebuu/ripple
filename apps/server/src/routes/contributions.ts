import { Router } from 'express';
import { z } from 'zod';
import { channelFactor, estimateReach, feeBreakdown, formatMoney, validateContributionAmount } from '../../../../shared';
import { requireAuth } from '../lib/auth';
import { db } from '../lib/db';
import { ah, forbidden, HttpError, notFound } from '../lib/http';
import { transition } from '../lib/lifecycle';
import { audienceOf, notify, notifyMany } from '../lib/notify';
import { contentOf, toContribution, toSummary } from '../lib/serialize';

export const contributions = Router();
// Guests get a lightweight guest identity from /auth/guest, so every contribution has an owner for receipts.
contributions.use(requireAuth);

/**
 * Simulated payment provider. No real card data is stored or sent anywhere;
 * only the last four digits are kept for the receipt.
 */
const TEST_CARDS: Record<string, { outcome: 'SUCCEEDED' | 'FAILED' | 'PENDING'; reason?: string }> = {
  '4242424242424242': { outcome: 'SUCCEEDED' },
  '4000000000000002': { outcome: 'FAILED', reason: 'Your card was declined. No money was taken.' },
  '4000000000009995': { outcome: 'FAILED', reason: 'Insufficient funds. No money was taken.' },
  '4000000000003220': { outcome: 'PENDING', reason: 'Your bank needs to confirm this payment.' },
};

const receiptNo = () => 'RC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

const withCampaign = { campaign: { select: { title: true, coverImage: true } } } as const;

/** Step 1: create a pending contribution. Fees and reach are computed here, never trusted from the client. */
contributions.post(
  '/',
  ah(async (req, res) => {
    const body = z
      .object({
        campaignId: z.string(),
        amount: z.number(),
        showName: z.boolean().default(false),
        displayName: z.string().trim().max(60).optional(),
        receiptEmail: z.email().optional(),
      })
      .parse(req.body);
    const err = validateContributionAmount(body.amount);
    if (err) throw new HttpError(400, err);
    const c = await db.campaign.findUnique({ where: { id: body.campaignId } });
    if (!c) throw notFound('Campaign');
    if (c.status !== 'FUNDING') throw new HttpError(409, 'This campaign is not accepting contributions right now');
    if (c.endsAt && c.endsAt < new Date()) throw new HttpError(409, 'The funding period for this campaign has ended');

    const fees = feeBreakdown(body.amount);
    const k = await db.contribution.create({
      data: {
        campaignId: c.id,
        userId: req.user!.id,
        amount: fees.amount,
        platformFee: fees.platformFee,
        processingFee: fees.processingFee,
        total: fees.total,
        estimatedReach: estimateReach(fees.amount, channelFactor(contentOf(c).reach?.channels)),
        showName: body.showName && !!body.displayName,
        displayName: body.showName ? body.displayName || null : null,
        receiptEmail: body.receiptEmail ?? null,
        receiptNo: receiptNo(),
      },
      include: withCampaign,
    });
    res.status(201).json(toContribution(k));
  }),
);

async function ownContribution(userId: string, id: string) {
  const k = await db.contribution.findUnique({ where: { id }, include: withCampaign });
  if (!k) throw notFound('Contribution');
  if (k.userId !== userId) throw forbidden();
  return k;
}

/** Applies a successful payment exactly once and handles funding milestones. */
async function settle(id: string) {
  const k = await db.contribution.findUnique({ where: { id } });
  if (!k || k.status !== 'PENDING') return;
  const c = await db.$transaction(async (tx) => {
    const done = await tx.contribution.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'SUCCEEDED', failureReason: null } });
    if (!done.count) return null;
    return tx.campaign.update({ where: { id: k.campaignId }, data: { raised: { increment: k.amount }, backerCount: { increment: 1 } } });
  });
  if (!c) return;
  if (k.userId) {
    await db.follow.upsert({ where: { userId_campaignId: { userId: k.userId, campaignId: c.id } }, create: { userId: k.userId, campaignId: c.id }, update: {} });
    await notify(k.userId, {
      kind: 'CONTRIBUTION', title: 'Contribution confirmed', campaignId: c.id, dedupeKey: `k:${k.id}`,
      body: `${formatMoney(k.amount, true)} toward distributing "${c.title}". Receipt ${k.receiptNo}.`,
    });
  }
  const before = ((c.raised - k.amount) / (c.goal ?? 1)) * 100;
  const after = (c.raised / (c.goal ?? 1)) * 100;
  for (const m of [25, 50, 75]) {
    if (before < m && after >= m) {
      await notifyMany(await audienceOf(c.id), {
        kind: 'MILESTONE', title: `${m}% funded`, campaignId: c.id, dedupeKey: `${c.id}:m${m}`,
        body: `"${c.title}" has raised ${formatMoney(c.raised)} of ${formatMoney(c.goal ?? 0)}.`,
      });
    }
  }
  if (c.goal && c.raised >= c.goal && c.status === 'FUNDING') await transition(c.id, 'FUNDED', null, { note: 'Funding goal reached' });
}

/** Step 2: simulated checkout. */
contributions.post(
  '/:id/pay',
  ah(async (req, res) => {
    const { cardNumber, expiry, cvc, name } = z
      .object({
        cardNumber: z.string().transform((s) => s.replace(/\s+/g, '')),
        expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Use MM/YY'),
        cvc: z.string().regex(/^\d{3,4}$/, 'CVC is 3 or 4 digits'),
        name: z.string().trim().min(1).max(80),
      })
      .parse(req.body);
    const k = await ownContribution(req.user!.id, req.params.id);
    if (k.status !== 'PENDING' || k.cardLast4) throw new HttpError(409, 'This payment has already been processed');

    const [mm, yy] = expiry.split('/').map(Number);
    if (new Date(2000 + yy, mm) < new Date()) throw new HttpError(400, 'This card has expired');
    const card = TEST_CARDS[cardNumber];
    if (!card) throw new HttpError(400, 'Use one of the test card numbers shown. This is a simulated checkout.');
    void name;

    await new Promise((r) => setTimeout(r, 900)); // provider round-trip
    const last4 = cardNumber.slice(-4);
    if (card.outcome === 'SUCCEEDED') {
      await db.contribution.update({ where: { id: k.id }, data: { cardLast4: last4 } });
      await settle(k.id);
    } else if (card.outcome === 'FAILED') {
      await db.contribution.update({ where: { id: k.id }, data: { cardLast4: last4, status: 'FAILED', failureReason: card.reason } });
      await notify(req.user!.id, {
        kind: 'CONTRIBUTION', title: 'Payment unsuccessful', campaignId: k.campaignId, dedupeKey: `kf:${k.id}`,
        body: `${card.reason} You can try again with another card.`,
      });
    } else {
      await db.contribution.update({ where: { id: k.id }, data: { cardLast4: last4, failureReason: card.reason } });
    }
    res.json(await result(k.id));
  }),
);

/** Simulates the bank's confirmation for a pending (3-D Secure style) payment. */
contributions.post(
  '/:id/confirm',
  ah(async (req, res) => {
    const { approve } = z.object({ approve: z.boolean() }).parse(req.body);
    const k = await ownContribution(req.user!.id, req.params.id);
    if (k.status !== 'PENDING' || !k.cardLast4) throw new HttpError(409, 'Nothing to confirm');
    if (approve) await settle(k.id);
    else await db.contribution.update({ where: { id: k.id }, data: { status: 'FAILED', failureReason: 'Your bank did not approve this payment.' } });
    res.json(await result(k.id));
  }),
);

contributions.post(
  '/:id/cancel',
  ah(async (req, res) => {
    const k = await ownContribution(req.user!.id, req.params.id);
    if (k.status !== 'PENDING') throw new HttpError(409, 'Only pending payments can be cancelled');
    await db.contribution.update({ where: { id: k.id }, data: { status: 'CANCELLED', failureReason: 'You cancelled this payment.' } });
    res.json(await result(k.id));
  }),
);

contributions.get(
  '/:id',
  ah(async (req, res) => {
    const k = await ownContribution(req.user!.id, req.params.id);
    res.json(await result(k.id));
  }),
);

async function result(id: string) {
  const k = await db.contribution.findUniqueOrThrow({ where: { id }, include: withCampaign });
  const c = await db.campaign.findUniqueOrThrow({ where: { id: k.campaignId } });
  return { contribution: toContribution(k), campaign: toSummary(c) };
}
