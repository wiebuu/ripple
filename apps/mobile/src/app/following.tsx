import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { BACKABLE_STATUSES, type CampaignSummary } from '@shared';
import { CampaignRow, FollowToggle, RowSkeleton } from '@/components/campaign';
import { Header } from '@/components/Screen';
import { Button, EmptyState, ErrorState, IconButton } from '@/components/ui';
import { PullArea, usePullRefresh } from '@/hooks/usePullRefresh';
import { useFollowCampaign, useFollowing } from '@/lib/queries';
import { toast } from '@/lib/toast';
import { space, useTheme } from '@/theme';

/** Campaigns the user follows. Their updates appear in Activity → Following. */
export default function Following() {
  const { c } = useTheme();
  const q = useFollowing();
  const pull = usePullRefresh(q.refetch);
  const follow = useFollowCampaign();

  // Rows stay on screen after an unfollow, showing an outlined bell, so a mistaken tap can be undone.
  // `kept` remembers every campaign shown while the page is open; `toggled` holds the user's latest choice per row.
  const [kept, setKept] = useState<CampaignSummary[]>([]);
  const [seen, setSeen] = useState<typeof q.data>(undefined);
  if (q.data !== seen) {
    setSeen(q.data);
    const ids = new Set(kept.map((x) => x.id));
    setKept([...kept, ...(q.data?.items ?? []).filter((x) => !ids.has(x.id))]);
  }
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const followingIds = new Set((q.data?.items ?? []).map((x) => x.id));
  const isFollowing = (id: string) => toggled[id] ?? followingIds.has(id);

  // Campaigns still open for backing first: those are the ones whose progress is moving.
  const items = [...kept].sort((a, b) => Number(BACKABLE_STATUSES.includes(b.status)) - Number(BACKABLE_STATUSES.includes(a.status)));
  const n = items.filter((x) => isFollowing(x.id)).length;

  const toggle = (item: CampaignSummary) => {
    const on = !isFollowing(item.id);
    setToggled((t) => ({ ...t, [item.id]: on }));
    follow.mutate({ id: item.id, on });
    toast(on ? 'Following again' : 'Unfollowed. Tap the bell to follow again.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header
        title="Following"
        subtitle={q.isSuccess && kept.length ? `${n} campaign${n === 1 ? '' : 's'}` : undefined}
        right={<IconButton icon="notifications-outline" label="Updates from followed campaigns" onPress={() => router.navigate('/activity')} />}
      />
      {pull.indicator()}
      <PullArea pull={pull}>
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.huge }}
          refreshControl={pull.control()}
          onScroll={pull.onScroll}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => <CampaignRow c={item} divider={index > 0} right={<FollowToggle following={isFollowing(item.id)} title={item.title} onPress={() => toggle(item)} />} />}
          ListEmptyComponent={
            q.isPending ? (
              <RowSkeleton rows={4} />
            ) : q.isError ? (
              <ErrorState onRetry={() => q.refetch()} />
            ) : (
              <EmptyState
                icon="eye-outline"
                title="Not following anything yet"
                body="Tap “Follow progress” on a campaign to track its funding and delivery. Campaigns you back are followed automatically."
                action={<Button label="Explore campaigns" onPress={() => router.navigate('/explore')} />}
              />
            )
          }
        />
      </PullArea>
    </View>
  );
}
