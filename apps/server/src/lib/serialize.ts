import type { Campaign, Contribution, Report } from '@prisma/client';
import {
  channelFactor,
  estimateReach,
  feeBreakdown,
  type CampaignReport,
  type CampaignSummary,
  type Contribution as ContributionDTO,
  type DraftContent,
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
  };
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
