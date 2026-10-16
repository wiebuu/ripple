/**
 * Campaign lifecycle. The server is the only place transitions are applied;
 * the app reads these to render status pills, timelines and dashboard tabs.
 */
export const CAMPAIGN_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'CHANGES_REQUESTED',
  'APPROVED',
  'FUNDING',
  'FUNDED',
  'FUNDING_ENDED',
  'DISTRIBUTION_PREP',
  'PROMOTING',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'REFUND_PENDING',
  'FAILED',
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'],
  CHANGES_REQUESTED: ['SUBMITTED', 'CANCELLED'],
  APPROVED: ['FUNDING', 'CANCELLED'],
  FUNDING: ['FUNDED', 'FUNDING_ENDED', 'CANCELLED'],
  FUNDED: ['DISTRIBUTION_PREP', 'REFUND_PENDING'],
  // Funding period ended below goal: platform may still distribute what was raised, or refund.
  FUNDING_ENDED: ['DISTRIBUTION_PREP', 'REFUND_PENDING'],
  DISTRIBUTION_PREP: ['PROMOTING', 'FAILED', 'REFUND_PENDING'],
  PROMOTING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: ['REFUND_PENDING'],
  REFUND_PENDING: ['CANCELLED'],
  FAILED: ['REFUND_PENDING'],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses visible to the public (Explore, Home, detail pages). */
export const PUBLIC_STATUSES: CampaignStatus[] = [
  'FUNDING',
  'FUNDED',
  'FUNDING_ENDED',
  'DISTRIBUTION_PREP',
  'PROMOTING',
  'COMPLETED',
];

export const BACKABLE_STATUSES: CampaignStatus[] = ['FUNDING'];

export const STATUS_META: Record<
  CampaignStatus,
  { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; description: string }
> = {
  DRAFT: { label: 'Draft', tone: 'neutral', description: 'Only you can see this campaign.' },
  SUBMITTED: { label: 'Under review', tone: 'info', description: 'Our review team is checking content, sources and targeting.' },
  CHANGES_REQUESTED: { label: 'Changes requested', tone: 'warning', description: 'A reviewer asked for edits before approval.' },
  APPROVED: { label: 'Approved', tone: 'success', description: 'Approved and about to open for backing.' },
  FUNDING: { label: 'Open for backing', tone: 'info', description: 'Backers can contribute toward distribution.' },
  FUNDED: { label: 'Goal reached', tone: 'success', description: 'Goal reached. Advertising has not launched yet.' },
  FUNDING_ENDED: { label: 'Funding ended', tone: 'neutral', description: 'The funding period ended before the goal.' },
  DISTRIBUTION_PREP: { label: 'Preparing distribution', tone: 'info', description: 'Ads are being set up and checked before launch.' },
  PROMOTING: { label: 'Promoting', tone: 'success', description: 'The message is being shown to new audiences.' },
  COMPLETED: { label: 'Completed', tone: 'neutral', description: 'Distribution finished. Final report available.' },
  REJECTED: { label: 'Not approved', tone: 'danger', description: 'This campaign is not eligible for distribution.' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', description: 'This campaign was cancelled.' },
  REFUND_PENDING: { label: 'Refund pending', tone: 'warning', description: 'Unspent contributions are being returned.' },
  FAILED: { label: 'Distribution failed', tone: 'danger', description: 'Distribution could not run. Funds will be refunded.' },
};

/** The happy-path timeline shown after submission and on the dashboard. */
export const TIMELINE: { status: CampaignStatus; title: string; body: string }[] = [
  { status: 'SUBMITTED', title: 'Submitted for review', body: 'We check claims against your sources, your visuals and your targeting. Usually 1–2 business days.' },
  { status: 'APPROVED', title: 'Approved', body: 'Or we ask for changes. You will get a notification either way.' },
  { status: 'FUNDING', title: 'Open for backing', body: 'Your campaign appears in Explore. Share it to get the first backers.' },
  { status: 'FUNDED', title: 'Funding goal reached', body: 'Or the funding period ends. Reaching the goal does not launch ads by itself.' },
  { status: 'DISTRIBUTION_PREP', title: 'Distribution preparation', body: 'We finalise targeting and budget and set up the ads.' },
  { status: 'PROMOTING', title: 'Promoting', body: 'Your message is shown to people outside your network.' },
  { status: 'COMPLETED', title: 'Completed', body: 'You and every backer receive the final distribution report.' },
];

export function timelineIndex(status: CampaignStatus) {
  const order: CampaignStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'FUNDING', 'FUNDED', 'DISTRIBUTION_PREP', 'PROMOTING', 'COMPLETED'];
  const map: Partial<Record<CampaignStatus, CampaignStatus>> = {
    CHANGES_REQUESTED: 'SUBMITTED',
    FUNDING_ENDED: 'FUNDED',
  };
  return order.indexOf(map[status] ?? status) - 1;
}

/** Creator dashboard tabs. */
export const DASHBOARD_TABS: { key: string; label: string; statuses: CampaignStatus[] }[] = [
  { key: 'drafts', label: 'Drafts', statuses: ['DRAFT'] },
  { key: 'review', label: 'Under review', statuses: ['SUBMITTED'] },
  { key: 'action', label: 'Requires action', statuses: ['CHANGES_REQUESTED', 'REJECTED'] },
  { key: 'funding', label: 'Funding', statuses: ['APPROVED', 'FUNDING', 'FUNDED', 'FUNDING_ENDED'] },
  { key: 'promoting', label: 'Promoting', statuses: ['DISTRIBUTION_PREP', 'PROMOTING'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'FAILED'] },
];
