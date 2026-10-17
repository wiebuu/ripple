/**
 * Demo estimate model. Every number derived from here must be labelled as an
 * estimate in the UI. Actual reach depends on ad inventory, prices, targeting,
 * delivery and performance.
 */
/**
 * Most a single Razorpay payment may charge. Razorpay rejected ₹5,00,000 on this account
 * ("Amount exceeds maximum amount allowed"), and UPI caps payments at ₹1,00,000, so we use that.
 * Raise it to match Dashboard → Account & Settings → Transaction limits if the account allows more.
 * The backer is charged contribution + processing, so that total must fit.
 */
const RAZORPAY_MAX_PAYMENT = 100000;
const PROCESSING_RATE = 0.02;

export const REACH_CONFIG = {
  /** Share of each contribution kept by the platform for review, setup and reporting. */
  platformFeeRate: 0.08,
  /** Payment processing fee (Razorpay standard rate), paid on top by the backer. */
  processingRate: PROCESSING_RATE,
  processingFixed: 0,
  /** Assumed people reached per advertising rupee (blended CPM across channels). */
  peoplePerAdRupee: 0.35,
  /** Contribution limits in rupees. */
  minContribution: 50,
  /** Largest contribution whose total charge (with processing) stays within Razorpay's per-payment cap. */
  maxContribution: Math.floor(RAZORPAY_MAX_PAYMENT / (1 + PROCESSING_RATE)),
  presets: [100, 250, 500, 1000, 2500],
} as const;

/** All money in Ripple is in Indian rupees; payments are processed by Razorpay (test mode). */
export const PAYMENT_CONFIG = {
  currency: 'INR',
  /** Most Razorpay accepts in a single payment (default account limit). */
  maxPayment: RAZORPAY_MAX_PAYMENT,
  /** Typical per-payment UPI limit. Larger payments should use a card. */
  upiLimit: 100000,
} as const;

/** Razorpay expects amounts in paise. */
export function toPaise(inr: number) {
  return Math.round(inr * 100);
}

export const CHANNELS = [
  { key: 'social_feed', label: 'Social feeds', factor: 1.1, note: 'Image and short video placements in social feeds' },
  { key: 'stories', label: 'Stories & reels', factor: 1.0, note: 'Full-screen vertical placements' },
  { key: 'search', label: 'Search', factor: 0.6, note: 'Text ads on relevant searches; fewer, more intentional views' },
  { key: 'news', label: 'News & publisher sites', factor: 0.9, note: 'Display ads on partner publishers' },
  { key: 'video', label: 'Online video', factor: 0.7, note: 'Pre-roll on video platforms' },
] as const;

/** Apps and ad networks a creator can ask to run on, grouped by who sells the inventory. */
export const PLATFORMS = [
  { key: 'facebook', label: 'Facebook', network: 'Meta' },
  { key: 'instagram', label: 'Instagram', network: 'Meta' },
  { key: 'google_search', label: 'Google Search', network: 'Google' },
  { key: 'youtube', label: 'YouTube', network: 'Google' },
  { key: 'google_display', label: 'Display Network', network: 'Google' },
  { key: 'tiktok', label: 'TikTok', network: 'More' },
  { key: 'snapchat', label: 'Snapchat', network: 'More' },
  { key: 'x', label: 'X', network: 'More' },
  { key: 'linkedin', label: 'LinkedIn', network: 'More' },
  { key: 'reddit', label: 'Reddit', network: 'More' },
  { key: 'pinterest', label: 'Pinterest', network: 'More' },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]['key'];

/** Choices for how long a campaign stays open for backing. */
export const FUNDING_DAY_OPTIONS = [7, 14, 21, 30, 45, 60] as const;
export const DEFAULT_FUNDING_DAYS = 30;

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
  return Math.round(adBudget * REACH_CONFIG.peoplePerAdRupee * factor);
}

/** People reached per ₹100 contributed (estimate). */
export function peoplePerHundred(factor = 1) {
  return estimateReach(100, factor);
}

export function formatReach(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

export function formatMoney(n: number, paise = false) {
  return (
    '₹' +
    n.toLocaleString('en-IN', {
      minimumFractionDigits: paise ? 2 : 0,
      maximumFractionDigits: paise ? 2 : 0,
    })
  );
}
