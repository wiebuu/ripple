import type { Campaign, Contribution, Report } from '@prisma/client';
import {
  channelFactor,
  estimateReach,
  feeBreakdown,
  type CampaignReport,
  type CampaignSummary,
  type Contribution as ContributionDTO,
  type DraftContent,
  type PlatformKey,
} from '../../../../shared';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function contentOf(c: Pick<Campaign, 'content'>) {
  return c.content as unknown as DraftContent;
}

export function toSummary(c: Campaign): CampaignSummary {
  const content = contentOf(c);
  const factor = channelFactor(content.reach?.channels);
  return {
    id: c.id,
    slug: c.slug,
    status: c.status as CampaignSummary['status'],
    title: c.title,
    summary: c.summary,
    category: c.category as CampaignSummary['category'],
    creatorName: c.creatorName,
    creatorType: c.creatorType as CampaignSummary['creatorType'],
    coverImage: c.coverImage,
    goal: c.goal ?? 0,
    raised: c.raised,
    backerCount: c.backerCount,
    hasVideo: !!content.visuals?.adVideo,
    reachAtGoal: estimateReach(c.goal ?? 0, factor),
    reachFactor: Math.round(factor * 100) / 100,
    featured: c.featured,
    isDemo: c.isDemo,
    publishedAt: iso(c.publishedAt),
    submittedAt: iso(c.submittedAt),
    endsAt: iso(c.endsAt),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toReport(c: Campaign, r: Report | null): CampaignReport | null {
  if (!r) return null;
  const fees = feeBreakdown(c.raised);
  return {
    fundsRaised: c.raised,
    platformFees: fees.platformFee,
    adBudget: fees.adBudget,
    adSpend: r.adSpend,
    impressions: r.impressions,
    measuredReach: r.measuredReach,
    clicks: r.clicks,
    estimatedReach: estimateReach(c.raised, channelFactor(contentOf(c).reach?.channels)),
    startedAt: iso(r.startedAt),
    endedAt: iso(r.endedAt),
    final: r.final,
    byChannel: (r.byChannel as CampaignReport['byChannel']) ?? [],
    byPlatform: platformSplit(c, r),
    daily: dailySeries(c, r),
  };
}

/** Small deterministic hash so simulated breakdowns stay the same on every load. */
function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h >>>= 0) % 1000) / 1000;
  };
}

/** Relative audience size per app, so bigger feeds get a larger share of impressions. */
const APP_WEIGHT: Partial<Record<PlatformKey, number>> = { instagram: 1.4, facebook: 1.25, youtube: 1.1, google_search: 0.7, google_display: 0.8, tiktok: 1.2, snapchat: 0.6, x: 0.55, linkedin: 0.5, reddit: 0.45, pinterest: 0.4 };

/** Splits measured delivery across the apps the creator picked (the prototype's partners report totals only). */
function platformSplit(c: Campaign, r: Report): CampaignReport['byPlatform'] {
  if (!r.impressions) return [];
  const chosen: PlatformKey[] = contentOf(c).reach?.platforms?.length ? contentOf(c).reach.platforms! : ['facebook', 'instagram', 'google_search'];
  const rand = seeded(c.id + ':apps');
  const w = chosen.map((p) => (APP_WEIGHT[p] ?? 0.5) * (0.8 + rand() * 0.4));
  const total = w.reduce((a, b) => a + b, 0);
  const rows = chosen.map((platform, i) => {
    const impressions = Math.round((r.impressions! * w[i]) / total);
    return { platform, impressions, clicks: Math.round(((r.clicks ?? 0) * w[i]) / total) };
  });
  return rows.sort((a, b) => b.impressions - a.impressions);
}

/** Spreads total impressions over the days ads have run: a ramp-up, then a steady pace with daily variation. */
function dailySeries(c: Campaign, r: Report): CampaignReport['daily'] {
  if (!r.impressions || !r.startedAt) return [];
  const end = r.endedAt ?? new Date();
  const days = Math.max(2, Math.min(14, Math.ceil((end.getTime() - r.startedAt.getTime()) / 864e5)));
  const rand = seeded(c.id + ':days');
  const w = Array.from({ length: days }, (_, i) => Math.min(1, (i + 1) / 3) * (0.75 + rand() * 0.5));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x, i) => ({
    day: new Date(end.getTime() - (days - 1 - i) * 864e5).toISOString().slice(0, 10),
    impressions: Math.round((r.impressions! * x) / total),
    clicks: Math.round(((r.clicks ?? 0) * x) / total),
  }));
}

export function toContribution(k: Contribution & { campaign: Pick<Campaign, 'title' | 'coverImage'> }): ContributionDTO {
  return {
    id: k.id,
    campaignId: k.campaignId,
    campaignTitle: k.campaign.title,
    campaignCover: k.campaign.coverImage,
    amount: k.amount,
    platformFee: k.platformFee,
    processingFee: k.processingFee,
    total: k.total,
    estimatedReach: k.estimatedReach,
    status: k.status as ContributionDTO['status'],
    failureReason: k.failureReason,
    showName: k.showName,
    receiptNo: k.receiptNo,
    cardLast4: k.cardLast4,
    createdAt: k.createdAt.toISOString(),
  };
}

/** Copy denormalised listing columns out of draft content. */
export function columnsFromContent(content: DraftContent) {
  return {
    title: content.basics.title.trim(),
    summary: content.basics.summary.trim(),
    category: content.basics.category,
    creatorName: content.basics.creatorName.trim(),
    creatorType: content.basics.creatorType,
    coverImage: content.visuals.coverImage || content.basics.coverImage || '',
  };
}
