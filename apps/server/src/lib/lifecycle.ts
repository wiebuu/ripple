import type { Campaign, Prisma } from '@prisma/client';
import { canTransition, CHANNELS, DEFAULT_FUNDING_DAYS, feeBreakdown, STATUS_META, type CampaignStatus, type ChannelKey } from '../../../../shared';
import type { AuthUser } from './auth';
import { db } from './db';
import { HttpError } from './http';
import { audienceOf, notify, notifyMany } from './notify';
import { contentOf } from './serialize';

type Actor = Pick<AuthUser, 'id' | 'name'> | null;

/** Preconditions that go beyond the transition graph. */
function guard(c: Campaign, to: CampaignStatus) {
  if (to === 'FUNDED' && c.raised < (c.goal ?? Infinity)) throw new HttpError(409, 'Funding goal has not been reached');
  if (to === 'DISTRIBUTION_PREP' && c.raised <= 0) throw new HttpError(409, 'No funds have been raised for distribution');
  if (to === 'PROMOTING') {
    const missing = [!c.budgetApproved && 'budget approval', !c.adSetupReady && 'ad setup'].filter(Boolean);
    if (missing.length) throw new HttpError(409, `Distribution cannot start: ${missing.join(' and ')} not complete`);
  }
}

/**
 * The single place campaign status changes. Validates the move, writes an
 * audit record, applies side effects and sends notifications.
 */
export async function transition(
  campaignId: string,
  to: CampaignStatus,
  actor: Actor,
  opts: { note?: string; action?: string } = {},
) {
  const c = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!c) throw new HttpError(404, 'Campaign not found');
  const from = c.status as CampaignStatus;
  if (!canTransition(from, to)) {
    throw new HttpError(409, `A campaign that is "${STATUS_META[from].label}" cannot move to "${STATUS_META[to].label}"`);
  }
  guard(c, to);

  const now = new Date();
  const data: Prisma.CampaignUncheckedUpdateInput = { status: to };
  if (to === 'SUBMITTED') data.submittedAt = now;
  if (to === 'FUNDING') {
    data.publishedAt = now;
    data.endsAt = new Date(now.getTime() + (contentOf(c).fundingDays ?? DEFAULT_FUNDING_DAYS) * 864e5);
  }

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.campaign.update({ where: { id: c.id }, data });
    await tx.reviewDecision.create({
      data: {
        campaignId: c.id,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? 'System',
        action: opts.action ?? 'TRANSITION',
        fromStatus: from,
        toStatus: to,
        note: opts.note ?? null,
      },
    });
    if (to === 'PROMOTING') {
      await tx.report.upsert({
        where: { campaignId: c.id },
        create: { campaignId: c.id, startedAt: now, adSpend: 0, impressions: 0, measuredReach: 0, clicks: 0 },
        update: { startedAt: now },
      });
    }
    return u;
  });

  if (to === 'COMPLETED') await simulateDelivery(c.id, 1);
  await announce(updated, from, to, opts.note);
  return updated;
}

async function announce(c: Campaign, _from: CampaignStatus, to: CampaignStatus, note?: string) {
  const t = c.title || 'Your campaign';
  const owner = (kind: Parameters<typeof notify>[1]['kind'], title: string, body: string) =>
    notify(c.ownerId, { kind, title, body, campaignId: c.id, dedupeKey: `${c.id}:${to}:${c.updatedAt.getTime()}` });

  switch (to) {
    case 'SUBMITTED':
      return owner('SUBMISSION', 'Submission received', `"${t}" is in the review queue. We usually respond within 1–2 business days.`);
    case 'CHANGES_REQUESTED':
      return owner('REVIEW', 'Changes requested', note ? `A reviewer asked: ${note}` : `A reviewer asked for edits to "${t}".`);
    case 'REJECTED':
      return owner('REVIEW', 'Campaign not approved', note ? `Reason: ${note}` : `"${t}" is not eligible for distribution.`);
    case 'APPROVED':
      return owner('REVIEW', 'Campaign approved', `"${t}" passed review.`);
    case 'FUNDING':
      return owner('FUNDING', 'Your campaign is live', `"${t}" is open for backing. Share it to find your first backers.`);
    case 'FUNDED':
      return notifyMany(await audienceOf(c.id), {
        kind: 'MILESTONE', title: 'Funding goal reached', campaignId: c.id, dedupeKey: `${c.id}:FUNDED`,
        body: `"${t}" reached its goal. Next, the team prepares distribution. Ads have not launched yet.`,
      });
    case 'DISTRIBUTION_PREP':
      return notifyMany(await audienceOf(c.id), {
        kind: 'PROMOTION', title: 'Preparing distribution', campaignId: c.id, dedupeKey: `${c.id}:PREP`,
        body: `Targeting and budget for "${t}" are being finalised.`,
      });
    case 'PROMOTING':
      return notifyMany(await audienceOf(c.id), {
        kind: 'PROMOTION', title: 'Promotion has started', campaignId: c.id, dedupeKey: `${c.id}:PROMOTING`,
        body: `"${t}" is now being shown to new audiences. Delivery stats will appear in the report.`,
      });
    case 'COMPLETED':
      return notifyMany(await audienceOf(c.id), {
        kind: 'REPORT', title: 'Final report available', campaignId: c.id, dedupeKey: `${c.id}:REPORT`,
        body: `"${t}" finished distribution. See where the money went and who it reached.`,
      });
    case 'FUNDING_ENDED':
      return notifyMany(await audienceOf(c.id), {
        kind: 'FUNDING', title: 'Funding period ended', campaignId: c.id, dedupeKey: `${c.id}:ENDED`,
        body: `"${t}" did not reach its goal. The team will decide whether to distribute the funds raised or refund backers.`,
      });
    case 'REFUND_PENDING':
      return notifyMany(await audienceOf(c.id), {
        kind: 'CONTRIBUTION', title: 'Refund in progress', campaignId: c.id, dedupeKey: `${c.id}:REFUND`,
        body: `Unspent contributions to "${t}" are being returned to the original payment method.`,
      });
    default:
      return;
  }
}

/**
 * Demo ad delivery. Advances spend toward the ad budget and derives measured
 * metrics from it. These are labelled "measured (simulated)" in the app and
 * never mixed with the up-front estimate.
 */
export async function simulateDelivery(campaignId: string, progress = 0.25) {
  const c = await db.campaign.findUnique({ where: { id: campaignId }, include: { report: true } });
  if (!c?.report) throw new HttpError(409, 'Campaign is not promoting');
  const budget = feeBreakdown(c.raised).adBudget;
  const spend = Math.min(budget * 0.995, (c.report.adSpend ?? 0) + budget * progress);
  const split = contentOf(c).reach?.channels ?? { social_feed: 100 };
  const total = Object.values(split).reduce((a, b) => a + (b ?? 0), 0) || 1;
  const byChannel = CHANNELS.filter((ch) => split[ch.key]).map((ch) => {
    const s = (spend * (split[ch.key] ?? 0)) / total;
    const cpm = 1000 / ch.factor; // ₹ per 1,000 impressions; cheaper placements => more impressions
    const impressions = Math.round((s / cpm) * 1000);
    return { channel: ch.key as ChannelKey, spend: Math.round(s * 100) / 100, impressions, clicks: Math.round(impressions * 0.012) };
  });
  const impressions = byChannel.reduce((a, b) => a + b.impressions, 0);
  const final = progress >= 1;
  await db.report.update({
    where: { campaignId },
    data: {
      adSpend: Math.round(spend * 100) / 100,
      impressions,
      measuredReach: Math.round(impressions / 2.4),
      clicks: byChannel.reduce((a, b) => a + b.clicks, 0),
      byChannel,
      final,
      endedAt: final ? new Date() : null,
    },
  });
  if (!final) {
    await notifyMany(await audienceOf(campaignId), {
      kind: 'PROMOTION',
      title: 'Distribution update',
      body: `"${c.title}" has now been shown about ${impressions.toLocaleString('en-US')} times.`,
      campaignId,
      dedupeKey: `${campaignId}:delivery:${Math.round((spend / budget) * 4)}`,
    });
  }
}
