import { QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AppNotification,
  BackerActivity,
  Complaint,
  CampaignDetail,
  CampaignStatus,
  CampaignSummary,
  Contribution,
  DraftContent,
  NotificationPrefs,
} from '@shared';
import { api } from './api';
import { toast } from './toast';
import { useSession } from './session';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export type ListParams = {
  q?: string;
  category?: string;
  creatorType?: string;
  status?: 'funding' | 'promoting' | 'completed' | 'all';
  sort?: 'trending' | 'newest' | 'closest' | 'ending';
  minPct?: number;
  featured?: boolean;
  limit?: number;
};

const qs = (p: Record<string, unknown>) =>
  Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== '' && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

export const useCampaigns = (p: ListParams = {}) =>
  useQuery({
    queryKey: ['campaigns', p],
    queryFn: () => api<{ items: CampaignSummary[]; total: number }>(`/campaigns?${qs(p)}`),
  });

export const PAGE_SIZE = 6;

/** Home's two lists, with the same keys Home uses, so it opens with real data after the loading screen. */
export const HOME_FEED: Omit<ListParams, 'limit'> = { status: 'all', sort: 'trending' };
export const HOME_FEATURED: ListParams = { featured: true, status: 'all', sort: 'trending' };
export function prefetchHome() {
  return Promise.all([
    queryClient.prefetchInfiniteQuery({
      queryKey: ['campaigns', 'infinite', HOME_FEED],
      initialPageParam: 0,
      queryFn: ({ pageParam }) => api<{ items: CampaignSummary[]; total: number; nextOffset: number | null }>(`/campaigns?${qs({ ...HOME_FEED, limit: PAGE_SIZE, offset: pageParam as number })}`),
    }),
    queryClient.prefetchQuery({ queryKey: ['campaigns', HOME_FEATURED], queryFn: () => api<{ items: CampaignSummary[]; total: number }>(`/campaigns?${qs(HOME_FEATURED)}`) }),
  ]);
}

/** Paginated campaign list: loads one page at a time as the user scrolls. */
export function useInfiniteCampaigns(p: Omit<ListParams, 'limit'> = {}) {
  const q = useInfiniteQuery({
    queryKey: ['campaigns', 'infinite', p],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<{ items: CampaignSummary[]; total: number; nextOffset: number | null }>(`/campaigns?${qs({ ...p, limit: PAGE_SIZE, offset: pageParam })}`),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
  return {
    ...q,
    items: q.data?.pages.flatMap((pg) => pg.items) ?? [],
    total: q.data?.pages[0]?.total ?? 0,
    loadMore: () => {
      if (q.hasNextPage && !q.isFetchingNextPage && !q.isError) q.fetchNextPage();
    },
  };
}

export type Detail = CampaignDetail & { hasPendingRevision?: boolean; backerActivity?: BackerActivity };
export const useCampaign = (id?: string) =>
  useQuery({ queryKey: ['campaign', id], queryFn: () => api<Detail>(`/campaigns/${id}`), enabled: !!id });

export const useReport = (id?: string) =>
  useQuery({
    queryKey: ['report', id],
    queryFn: () => api<{ campaign: CampaignSummary; report: CampaignDetail['report']; isOwner: boolean }>(`/campaigns/${id}/report`),
    enabled: !!id,
  });

export type MyCampaign = CampaignSummary & { hasPendingRevision: boolean; latestNote: string | null };
export const useMyCampaigns = () =>
  useQuery({ queryKey: ['me', 'campaigns'], queryFn: () => api<{ items: MyCampaign[] }>('/me/campaigns') });

/** Generic offset-paginated list for user-specific endpoints. */
function useInfiniteList<T>(key: unknown[], path: string, enabled = true) {
  const q = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    enabled,
    queryFn: ({ pageParam }) => api<{ items: T[]; total: number; nextOffset: number | null; unread?: number }>(`${path}${path.includes('?') ? '&' : '?'}limit=15&offset=${pageParam}`),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
  return {
    ...q,
    items: q.data?.pages.flatMap((p) => p.items) ?? [],
    loadMore: () => {
      if (q.hasNextPage && !q.isFetchingNextPage && !q.isError) q.fetchNextPage();
    },
  };
}

export const useMyContributions = () => useInfiniteList<Contribution>(['me', 'contributions'], '/me/contributions');

export const useNotificationFeed = (scope: 'all' | 'following' = 'all') => {
  const token = useSession((s) => s.token);
  return useInfiniteList<AppNotification>(['notifications', 'feed', scope, token], `/notifications?scope=${scope}`, !!token);
};

type CampaignPatch = Partial<Pick<Detail, 'isFollowing' | 'isSaved' | 'raised' | 'backerCount'>>;

/**
 * Optimistic update: applies `patch` to every cached copy of a campaign (its
 * page, every list and every "me" list) right away, and returns a function that
 * puts all of them back exactly as they were if the server says no.
 */
export function patchCampaignEverywhere(id: string, patch: CampaignPatch) {
  const qc = queryClient;
  const snapshots: [readonly unknown[], unknown][] = [];
  const keep = (key: readonly unknown[], old: unknown) => snapshots.push([key, old]);
  const fix = (c: CampaignSummary) => (c.id === id ? { ...c, ...patch } : c);
  const patchList = (old: any) => {
    if (!old) return old;
    if (old.pages) return { ...old, pages: old.pages.map((p: any) => ({ ...p, items: p.items?.map(fix) ?? p.items })) };
    if (Array.isArray(old.items)) return { ...old, items: old.items.map(fix) };
    return old;
  };
  for (const [key, old] of qc.getQueriesData({ queryKey: ['campaigns'] })) {
    keep(key, old);
    qc.setQueryData(key, patchList(old));
  }
  for (const [key, old] of qc.getQueriesData({ queryKey: ['me'] })) {
    keep(key, old);
    qc.setQueryData(key, patchList(old));
  }
  const detail = qc.getQueryData<Detail>(['campaign', id]);
  if (detail) {
    keep(['campaign', id], detail);
    qc.setQueryData<Detail>(['campaign', id], { ...detail, ...patch });
  }
  return () => snapshots.forEach(([key, old]) => qc.setQueryData(key, old));
}

/** Follow/unfollow or save/unsave: shows the change at once, undoes it quietly if the request fails. */
function useOptimisticToggle(kind: 'follow' | 'save') {
  const qc = useQueryClient();
  const field = kind === 'follow' ? 'isFollowing' : 'isSaved';
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api(`/campaigns/${id}/${kind}`, { body: { on } }),
    onMutate: async ({ id, on }) => {
      // Stop in-flight fetches from overwriting the optimistic value with older data.
      await qc.cancelQueries({ queryKey: ['campaign', id] });
      return { undo: patchCampaignEverywhere(id, { [field]: on }) };
    },
    onError: (_e, { on }, ctx) => {
      ctx?.undo();
      toast(`Couldn’t ${on ? kind : kind === 'follow' ? 'unfollow' : 'unsave'}. Check your connection and try again.`, 'error');
    },
    onSettled: (_r, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      qc.invalidateQueries({ queryKey: ['me'] });
      if (kind === 'follow') qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/** Follow/unfollow from a list card, updating every cached list that contains the campaign. */
export const useFollowCampaign = () => useOptimisticToggle('follow');

export const useBacked = () =>
  useQuery({ queryKey: ['me', 'backed'], queryFn: () => api<{ items: (CampaignSummary & { myTotal: number })[] }>('/me/backed') });

export const useSaved = () => useQuery({ queryKey: ['me', 'saved'], queryFn: () => api<{ items: CampaignSummary[] }>('/me/saved') });
export const useFollowing = () =>
  useQuery({ queryKey: ['me', 'following'], queryFn: () => api<{ items: CampaignSummary[] }>('/me/following') });

export const useNotifications = () => {
  const token = useSession((s) => s.token);
  return useQuery({
    queryKey: ['notifications', token],
    queryFn: () => api<{ items: AppNotification[]; unread: number }>('/notifications?limit=1'),
    enabled: !!token,
    refetchInterval: 30_000,
  });
};

export const usePrefs = () => useQuery({ queryKey: ['prefs'], queryFn: () => api<NotificationPrefs>('/notifications/prefs') });

export const useConfig = () =>
  useQuery({ queryKey: ['config'], queryFn: () => api<{ aiEnabled: boolean; googleSignIn: boolean; payments: { provider: 'razorpay-test' | 'none'; keyId?: string } }>('/config', { auth: false }), staleTime: 60_000 });

export type DraftResponse = CampaignSummary & { content: DraftContent; latestReviewNote: string | null };
export const useDraft = (id?: string) =>
  useQuery({ queryKey: ['draft', id], queryFn: () => api<DraftResponse>(`/drafts/${id}`), enabled: !!id && id !== 'new' });

/** Follow or save toggle bound to one campaign (its page). */
export function useToggle(kind: 'follow' | 'save', id: string) {
  const m = useOptimisticToggle(kind);
  return { ...m, mutate: (on: boolean) => m.mutate({ id, on }) };
}

/** Everything that depends on campaign money or status. */
export function invalidateCampaign(id: string) {
  queryClient.invalidateQueries({ queryKey: ['campaign', id] });
  queryClient.invalidateQueries({ queryKey: ['campaigns'] });
  queryClient.invalidateQueries({ queryKey: ['me'] });
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  queryClient.invalidateQueries({ queryKey: ['review'] });
}

export type ReviewItem = CampaignSummary & { hasPendingRevision: boolean; openReports: number; budgetApproved: boolean; adSetupReady: boolean };
export const useReviewQueue = (enabled = true) =>
  useQuery({ queryKey: ['review', 'queue'], queryFn: () => api<{ items: ReviewItem[] }>('/review/queue'), enabled });

export type ReviewDetail = CampaignSummary & {
  content: DraftContent;
  pendingContent: DraftContent | null;
  validationErrors: Record<string, string>;
  budgetApproved: boolean;
  adSetupReady: boolean;
  audit: { id: string; action: string; fromStatus: CampaignStatus | null; toStatus: CampaignStatus; note: string | null; actorName: string | null; createdAt: string }[];
  report: CampaignDetail['report'];
  feedback: { visuals: { answer: string; count: number }[]; mindChanged: { answer: string; count: number }[] };
  complaints: Complaint[];
};
export const useReviewDetail = (id?: string) =>
  useQuery({ queryKey: ['review', id], queryFn: () => api<ReviewDetail>(`/review/campaigns/${id}`), enabled: !!id });
