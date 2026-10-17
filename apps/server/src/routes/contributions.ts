import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { BACKABLE_STATUSES, PAYMENT_CONFIG, channelFactor, type CampaignStatus, estimateReach, feeBreakdown, formatMoney, toPaise, validateContributionAmount } from '../../../../shared';
import { env } from '../lib/env';
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
 * Test-card gateway for the automated API tests only (ALLOW_SIMULATED_PAYMENTS=1).
 * The app pays exclusively through Razorpay test mode.
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
    const c = await db.campaign.findUnique({ where: { id: body.campaignId } });
    if (!c) throw notFound('Campaign');
    if (!BACKABLE_STATUSES.includes(c.status as CampaignStatus)) throw new HttpError(409, 'This campaign is not accepting contributions right now');
    if (c.endsAt && c.endsAt < new Date()) throw new HttpError(409, 'The funding period for this campaign has ended');
    // Going past the goal is allowed: extra funds buy more reach.
    const err = validateContributionAmount(body.amount);
    if (err) throw new HttpError(400, err);

    const fees = feeBreakdown(body.amount);
    if (fees.total > PAYMENT_CONFIG.maxPayment) throw new HttpError(400, `A single payment can't exceed ${formatMoney(PAYMENT_CONFIG.maxPayment)} including processing.`);
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

/** Test-suite checkout. Disabled unless ALLOW_SIMULATED_PAYMENTS=1. */
contributions.post(
  '/:id/pay',
  ah(async (req, res) => {
    if (!env.allowSimulatedPayments) throw new HttpError(410, 'Payments are processed through Razorpay test mode.');
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
    if (!env.allowSimulatedPayments) throw new HttpError(410, 'Payments are processed through Razorpay test mode.');
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

/* ---------------- Razorpay (TEST MODE ONLY) ----------------
 * Flow: create an order on the server → the app opens Razorpay Checkout →
 * the server verifies the HMAC signature before marking the payment paid.
 * env.razorpay is null unless the key is an rzp_test_ key.
 */
function razorpay() {
  if (!env.razorpay) throw new HttpError(503, 'Payments are unavailable: Razorpay test mode is not configured on the server.');
  return env.razorpay;
}

async function razorpayApi<T>(path: string, init: { method?: string; body?: unknown } = {}) {
  const { keyId, keySecret } = razorpay();
  const r = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64') },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await r.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!r.ok) throw new HttpError(502, `Payment provider error: ${json.error?.description ?? r.status}`);
  return json;
}

contributions.post(
  '/:id/razorpay/order',
  ah(async (req, res) => {
    const { keyId } = razorpay();
    const k = await ownContribution(req.user!.id, req.params.id);
    if (k.status !== 'PENDING') throw new HttpError(409, 'This payment has already been processed');
    const amount = toPaise(k.total);
    const order = await razorpayApi<{ id: string; amount: number; currency: string }>('/orders', {
      method: 'POST',
      body: { amount, currency: PAYMENT_CONFIG.currency, receipt: k.receiptNo, notes: { contributionId: k.id, purpose: 'Campaign message distribution (not a donation)' } },
    });
    await db.contribution.update({ where: { id: k.id }, data: { provider: 'RAZORPAY_TEST', providerOrderId: order.id } });
    res.json({ keyId, orderId: order.id, amount: order.amount, currency: order.currency, campaignTitle: k.campaign.title, receiptEmail: k.receiptEmail });
  }),
);

contributions.post(
  '/:id/razorpay/verify',
  ah(async (req, res) => {
    const { keySecret } = razorpay();
    const body = z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }).parse(req.body);
    const k = await ownContribution(req.user!.id, req.params.id);
    if (!k.providerOrderId || k.providerOrderId !== body.razorpay_order_id) throw new HttpError(400, 'Order does not match this payment');
    // Signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). Never trust the client's word for success.
    const expected = crypto.createHmac('sha256', keySecret).update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(body.razorpay_signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(400, 'Payment signature could not be verified');
    const payment = await razorpayApi<{ status: string; card?: { last4?: string } }>(`/payments/${body.razorpay_payment_id}`);
    if (!['captured', 'authorized'].includes(payment.status)) throw new HttpError(409, `Payment is ${payment.status}`);
    await db.contribution.update({ where: { id: k.id }, data: { providerPaymentId: body.razorpay_payment_id, cardLast4: payment.card?.last4 ?? 'RZPY' } });
    await settle(k.id);
    res.json(await result(k.id));
  }),
);

contributions.post(
  '/:id/razorpay/failed',
  ah(async (req, res) => {
    const { reason } = z.object({ reason: z.string().max(300).optional() }).parse(req.body);
    const k = await ownContribution(req.user!.id, req.params.id);
    if (k.status === 'PENDING') {
      await db.contribution.update({ where: { id: k.id }, data: { status: 'FAILED', cardLast4: k.cardLast4 ?? 'RZPY', failureReason: `${reason ?? 'The payment was declined'}. No money was taken.` } });
      await notify(req.user!.id, { kind: 'CONTRIBUTION', title: 'Payment unsuccessful', campaignId: k.campaignId, dedupeKey: `kf:${k.id}`, body: 'Your Razorpay test payment did not go through. You can try again.' });
    }
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
