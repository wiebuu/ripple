/**
 * Demo estimate model. Every number derived from here must be labelled as an
 * estimate in the UI. Actual reach depends on ad inventory, prices, targeting,
 * delivery and performance.
 */
export const REACH_CONFIG = {
  /** Share of each contribution kept by the platform for review, setup and reporting. */
  platformFeeRate: 0.08,
  /** Simulated card processing fee paid on top by the backer. */
  processingRate: 0.029,
  processingFixed: 0.3,
  /** Assumed people reached per advertising dollar (blended CPM across channels). */
  peoplePerAdDollar: 29.3,
  /** Contributions below this are rejected by the server. */
  minContribution: 1,
  maxContribution: 10000,
  presets: [5, 10, 25, 50, 100],
} as const;

export const CHANNELS = [
  { key: 'social_feed', label: 'Social feeds', factor: 1.1, note: 'Image and short video placements in social feeds' },
  { key: 'stories', label: 'Stories & reels', factor: 1.0, note: 'Full-screen vertical placements' },
  { key: 'search', label: 'Search', factor: 0.6, note: 'Text ads on relevant searches; fewer, more intentional views' },
  { key: 'news', label: 'News & publisher sites', factor: 0.9, note: 'Display ads on partner publishers' },
  { key: 'video', label: 'Online video', factor: 0.7, note: 'Pre-roll on video platforms' },
] as const;

export type ChannelKey = (typeof CHANNELS)[number]['key'];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Blended multiplier from a budget split, e.g. { social_feed: 60, search: 40 }. */
export function channelFactor(split?: Partial<Record<ChannelKey, number>>) {
  if (!split) return 1;
  const total = Object.values(split).reduce((a, b) => a + (b ?? 0), 0);
  if (!total) return 1;
  return CHANNELS.reduce((acc, c) => acc + ((split[c.key] ?? 0) / total) * c.factor, 0);
}

export function feeBreakdown(amount: number) {
  const platformFee = round2(amount * REACH_CONFIG.platformFeeRate);
  const adBudget = round2(amount - platformFee);
  const processingFee = amount > 0 ? round2(amount * REACH_CONFIG.processingRate + REACH_CONFIG.processingFixed) : 0;
  const total = round2(amount + processingFee);
  return { amount: round2(amount), platformFee, adBudget, processingFee, total };
}

/** Estimated people reached for a gross contribution or goal. */
export function estimateReach(amount: number, factor = 1) {
  const { adBudget } = feeBreakdown(amount);
  return Math.round(adBudget * REACH_CONFIG.peoplePerAdDollar * factor);
}

export function peoplePerDollar(factor = 1) {
  return estimateReach(1, factor);
}

export function formatReach(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

export function formatMoney(n: number, cents = false) {
  return (
    '$' +
    n.toLocaleString('en-US', {
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    })
  );
}
