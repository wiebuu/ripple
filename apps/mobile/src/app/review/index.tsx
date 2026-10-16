import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { STATUS_META, type CampaignStatus } from '@shared';
import { CampaignRow, RowSkeleton } from '@/components/campaign';
import { Header } from '@/components/Screen';
import { Button, Chip, EmptyState, ErrorState, Pill } from '@/components/ui';
import { relTime } from '@/lib/format';
import { useReviewQueue, type ReviewItem } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { space, useTheme } from '@/theme';

const GROUPS: { key: string; label: string; match: (x: ReviewItem) => boolean }[] = [
  { key: 'review', label: 'Needs review', match: (x) => x.status === 'SUBMITTED' || x.hasPendingRevision },
  { key: 'reports', label: 'Reports', match: (x) => x.openReports > 0 },
  { key: 'funding', label: 'Funding', match: (x) => x.status === 'FUNDING' || x.status === 'APPROVED' },
  { key: 'prep', label: 'Ready to distribute', match: (x) => (['FUNDED', 'FUNDING_ENDED', 'DISTRIBUTION_PREP'] as CampaignStatus[]).includes(x.status) },
  { key: 'promoting', label: 'Promoting', match: (x) => x.status === 'PROMOTING' },
  { key: 'closed', label: 'Closed', match: (x) => (['COMPLETED', 'REJECTED', 'CANCELLED', 'REFUND_PENDING', 'FAILED', 'CHANGES_REQUESTED'] as CampaignStatus[]).includes(x.status) },
];

/** Internal review queue. Only reviewer accounts can load it (enforced by the API). */
export default function ReviewQueue() {
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const q = useReviewQueue();
  const [tab, setTab] = useState('review');

  if (user?.role !== 'REVIEWER')
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Review" />
        <EmptyState icon="lock-closed-outline" title="Reviewer access only" body="Sign in with a review-team account to use these tools." action={<Button label="Sign in" onPress={() => router.replace('/sign-in')} />} />
      </View>
    );

  const items = q.data?.items ?? [];
  const group = GROUPS.find((g) => g.key === tab)!;
  const rows = items.filter(group.match);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Review queue" subtitle="Internal · review team" />
      <View style={{ height: 56 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm, alignItems: 'center' }}>
          {GROUPS.map((g) => (
            <Chip key={g.key} label={g.label} count={items.filter(g.match).length} selected={tab === g.key} onPress={() => setTab(g.key)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, gap: space.md }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={c.spinner} colors={[c.spinner]} />}
        renderItem={({ item }) => (
          <CampaignRow
            c={item}
            meta={`${STATUS_META[item.status].label}${item.hasPendingRevision ? ' · revision pending' : ''} · ${relTime(item.updatedAt)}`}
            onPress={() => router.push({ pathname: '/review/[id]', params: { id: item.id } })}
            right={item.openReports > 0 ? <Pill label={`${item.openReports} report${item.openReports > 1 ? 's' : ''}`} tone="danger" /> : item.hasPendingRevision ? <Pill label="Edit" tone="warning" /> : undefined}
          />
        )}
        ListEmptyComponent={q.isPending ? <RowSkeleton /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : <EmptyState icon="checkmark-done-outline" title="Nothing here" body="All caught up." />}
      />
    </View>
  );
}
