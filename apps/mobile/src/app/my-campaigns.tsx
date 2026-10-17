import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { DASHBOARD_TABS } from '@shared';
import { CampaignRow, RowSkeleton } from '@/components/campaign';
import { Header } from '@/components/Screen';
import { Button, Chip, EmptyState, ErrorState, IconButton } from '@/components/ui';
import { formatReach, relTime, timeLeft } from '@/lib/format';
import { useMyCampaigns, type MyCampaign } from '@/lib/queries';
import { space, useTheme } from '@/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';

/** Creator dashboard: every campaign by lifecycle stage. */
export default function MyCampaigns() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(params.tab ?? 'drafts');
  const q = useMyCampaigns();
  const pull = usePullRefresh(q.refetch);
  const items = q.data?.items ?? [];
  const current = DASHBOARD_TABS.find((t) => t.key === tab) ?? DASHBOARD_TABS[0];
  const rows = items.filter((x) => current.statuses.includes(x.status));

  const meta = (x: MyCampaign) => {
    if (x.status === 'DRAFT') return `Draft · edited ${relTime(x.updatedAt)}`;
    if (x.status === 'FUNDING') return `${Math.round((x.raised / x.goal) * 100)}% funded · ${timeLeft(x.endsAt)} · ≈ ${formatReach(x.reachAtGoal)} reach at goal`;
    if (x.status === 'CHANGES_REQUESTED' && x.latestNote) return `Reviewer: ${x.latestNote.slice(0, 80)}${x.latestNote.length > 80 ? '…' : ''}`;
    return `Updated ${relTime(x.updatedAt)}${x.hasPendingRevision ? ' · edits in review' : ''}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="My campaigns" right={<IconButton icon="add" label="New campaign" onPress={() => router.navigate('/create')} />} />
      <View style={{ height: 56 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm, alignItems: 'center' }}>
          {DASHBOARD_TABS.map((t) => (
            <Chip key={t.key} label={t.label} count={items.filter((x) => t.statuses.includes(x.status)).length} selected={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, gap: space.md }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={c.spinner} colors={[c.spinner]} />}
        renderItem={({ item }) => <CampaignRow c={item} meta={meta(item)} onPress={() => router.push({ pathname: '/manage/[id]', params: { id: item.id } })} />}
        ListEmptyComponent={
          q.isPending ? (
            <RowSkeleton />
          ) : q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : (
            <EmptyState icon="folder-open-outline" title={`Nothing in ${current.label.toLowerCase()}`} body="Campaigns move between these tabs as they’re reviewed, funded and promoted." action={<Button label="Start a campaign" variant="secondary" onPress={() => router.navigate('/create')} />} />
          )
        }
      />
    </View>
  );
}
