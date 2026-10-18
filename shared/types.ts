import type { CampaignStatus } from './lifecycle';
import type { ChannelKey, PlatformKey } from './reach';

export const CATEGORIES = [
  'Environment',
  'Health',
  'Science',
  'Education',
  'Public Policy',
  'Economic Policy',
  'Community',
  'Arts & Culture',
  'Business',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CREATOR_TYPES = ['Individual', 'Creator', 'Nonprofit', 'Organization', 'Business', 'Community group'] as const;
export type CreatorType = (typeof CREATOR_TYPES)[number];

export type StoryBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'image'; uri: string; caption?: string; credit?: string }
  | { id: string; type: 'stat'; value: string; label: string; sourceId?: string }
  | { id: string; type: 'quote'; text: string; attribution?: string };

export type Source = { id: string; title: string; url: string; publisher?: string };

export type Story = {
  headline: string;
  intro: string;
  blocks: StoryBlock[];
  sources: Source[];
  actions: string[];
};

export type Visuals = {
  coverImage?: string;
  adImages: string[];
  adVideo?: string;
  adHeadline: string;
  adDescription: string;
  ctaText: string;
};

export type ReachSettings = {
  locations: string[];
  ageRange: [number, number];
  interests: string[];
  channels: Partial<Record<ChannelKey, number>>;
  /** Apps the ads should run on. Older drafts omit it. */
  platforms?: PlatformKey[];
  durationDays: number;
};

export type Basics = {
  title: string;
  category: Category | '';
  creatorName: string;
  creatorType: CreatorType;
  summary: string;
  coverImage?: string;
};

export type DraftContent = {
  basics: Basics;
  story: Story;
  visuals: Visuals;
  reach: ReachSettings;
  goal: number | null;
  /** How long the campaign stays open for backing once approved. Older drafts omit it (30 days). */
  fundingDays?: number;
  acceptedRules: boolean;
};

export type CampaignSummary = {
  id: string;
  slug: string;
  status: CampaignStatus;
  title: string;
  summary: string;
  category: Category;
  creatorName: string;
  creatorType: CreatorType;
  coverImage: string;
  goal: number;
  raised: number;
  backerCount: number;
  reachAtGoal: number;
  reachFactor: number;
  featured: boolean;
  isDemo: boolean;
  /** The campaign has an ad video (shown as a "Video" tag on cards). */
  hasVideo: boolean;
  publishedAt: string | null;
  submittedAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on list responses for signed-in users. */
  isFollowing?: boolean;
};

export type CampaignDetail = CampaignSummary & {
  story: Story;
  visuals: Visuals;
  reach: ReachSettings;
  ownerId: string;
  isOwner: boolean;
  isFollowing: boolean;
  isSaved: boolean;
  /** Only names of backers who opted in to show publicly. */
  publicBackers: { name: string; amount?: number; at: string }[];
  updates: CampaignUpdate[];
  reviewNotes: ReviewDecision[];
  report: CampaignReport | null;
};

export type CampaignUpdate = { id: string; title: string; body: string; createdAt: string };

export type ReviewDecision = {
  id: string;
  action: 'SUBMITTED' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED' | 'TRANSITION' | 'EDIT';
  fromStatus: CampaignStatus | null;
  toStatus: CampaignStatus;
  note: string | null;
  reviewerName: string | null;
  createdAt: string;
};

export type CampaignReport = {
  fundsRaised: number;
  platformFees: number;
  adBudget: number;
  adSpend: number;
  impressions: number | null;
  measuredReach: number | null;
  clicks: number | null;
  estimatedReach: number;
  startedAt: string | null;
  endedAt: string | null;
  final: boolean;
  byChannel: { channel: ChannelKey; spend: number; impressions: number; clicks: number }[];
  /** Delivery per app the ads ran on (simulated partner data in the prototype). */
  byPlatform: { platform: PlatformKey; impressions: number; clicks: number }[];
  /** Impressions per day since ads started (up to the last 14 days). */
  daily: { day: string; impressions: number; clicks: number }[];
};

export type ContributionStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export type Contribution = {
  id: string;
  campaignId: string;
  campaignTitle: string;
  campaignCover: string;
  amount: number;
  platformFee: number;
  processingFee: number;
  total: number;
  estimatedReach: number;
  status: ContributionStatus;
  failureReason: string | null;
  showName: boolean;
  receiptNo: string;
  cardLast4: string | null;
  createdAt: string;
};

export type NotificationKind =
  | 'SUBMISSION'
  | 'REVIEW'
  | 'FUNDING'
  | 'MILESTONE'
  | 'DEADLINE'
  | 'CONTRIBUTION'
  | 'PROMOTION'
  | 'REPORT'
  | 'UPDATE'
  | 'SECURITY';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  campaignId: string | null;
  /** About a campaign the user owns (opens Manage rather than the public page). */
  mine?: boolean;
  read: boolean;
  createdAt: string;
};

export type NotificationPrefs = Record<NotificationKind, boolean> & { email: boolean; push: boolean };

export type User = {
  id: string;
  name: string;
  email: string | null;
  role: 'USER' | 'REVIEWER';
  isGuest: boolean;
};

export const COMPLAINT_REASONS = [
  { key: 'MISLEADING', label: 'Misleading or false claims' },
  { key: 'SOURCES', label: 'Sources don’t support the claims' },
  { key: 'HATE', label: 'Hate, harassment or violence' },
  { key: 'PRIVATE_PERSON', label: 'Targets a private person' },
  { key: 'COPYRIGHT', label: 'Uses images or content without permission' },
  { key: 'SPAM', label: 'Spam or scam' },
  { key: 'OTHER', label: 'Something else' },
] as const;
export type ComplaintReason = (typeof COMPLAINT_REASONS)[number]['key'];

export type Complaint = {
  id: string;
  campaignId: string;
  campaignTitle: string;
  reason: ComplaintReason;
  details: string | null;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  resolution: string | null;
  createdAt: string;
};

export type BackerActivity = {
  recent: { amount: number; name: string; at: string }[];
  daily: { day: string; amount: number; count: number }[];
};

export type Paged<T> = { items: T[]; total: number };

export const emptyDraft = (creatorName = ''): DraftContent => ({
  basics: { title: '', category: '', creatorName, creatorType: 'Individual', summary: '' },
  story: { headline: '', intro: '', blocks: [], sources: [], actions: [] },
  visuals: { adImages: [], adHeadline: '', adDescription: '', ctaText: 'Learn more' },
  reach: { locations: [], ageRange: [18, 65], interests: [], channels: { social_feed: 60, news: 40 }, platforms: ['facebook', 'instagram', 'google_search', 'youtube'], durationDays: 30 },
  goal: null,
  fundingDays: 30,
  acceptedRules: false,
});
