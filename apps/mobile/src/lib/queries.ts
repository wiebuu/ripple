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
import { useSession } from './session';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export type ListParams = {
  q?: string;
  category?: string;
  creatorType?: string;
  status?: 'funding' | 'promoting' | 'completed' | 'all';
  sort?: 'trending' | 'newest' | 'closest' | 'ending' | 'most_backed';
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
    queryFn: () => api<{ campaign: CampaignSummary; report: CampaignDetail['report'] }>(`/campaigns/${id}/report`),
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

/** Follow/unfollow from a list card, updating every cached list that contains the campaign. */
export function useFollowCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api(`/campaigns/${id}/follow`, { body: { on } }),
    onMutate: ({ id, on }) => {
      const patch = (c: CampaignSummary) => (c.id === id ? { ...c, isFollowing: on } : c);
      qc.setQueriesData<any>({ queryKey: ['campaigns'] }, (old: any) => {
        if (!old) return old;
        if (old.pages) return { ...old, pages: old.pages.map((p: any) => ({ ...p, items: p.items.map(patch) })) };
        if (old.items) return { ...old, items: old.items.map(patch) };
        return old;
      });
      qc.setQueryData<Detail>(['campaign', id], (d) => d && { ...d, isFollowing: on });
    },
    onSettled: (_r, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['me', 'following'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['campaign', id] });
    },
  });
}

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

export function useToggle(kind: 'follow' | 'save', id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => api(`/campaigns/${id}/${kind}`, { body: { on } }),
    onMutate: async (on) => {
      qc.setQueryData<Detail>(['campaign', id], (d) => d && { ...d, [kind === 'follow' ? 'isFollowing' : 'isSaved']: on });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
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
export const useReviewQueue = () =>
  useQuery({ queryKey: ['review', 'queue'], queryFn: () => api<{ items: ReviewItem[] }>('/review/queue') });

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
