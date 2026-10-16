import { router } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { STATUS_META } from '@shared';
import { CampaignRow, RowSkeleton } from '@/components/campaign';
import { Header } from '@/components/Screen';
import { Button, EmptyState, ErrorState, IconButton } from '@/components/ui';
import { pct, timeLeft } from '@/lib/format';
import { useFollowCampaign, useFollowing } from '@/lib/queries';
import { toast } from '@/lib/toast';
import { space, useTheme } from '@/theme';

/** Campaigns the user follows. Their updates appear in Activity → Following. */
export default function Following() {
  const { c } = useTheme();
  const q = useFollowing();
  const follow = useFollowCampaign();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Following" right={<IconButton icon="notifications-outline" label="Updates from followed campaigns" onPress={() => router.navigate('/activity')} />} />
      <FlatList
        data={q.data?.items ?? []}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: space.xl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={c.spinner} colors={[c.spinner]} />}
        renderItem={({ item }) => (
          <CampaignRow
            c={item}
            meta={item.status === 'FUNDING' ? `${pct(item.raised, item.goal)}% funded · ${timeLeft(item.endsAt)}` : STATUS_META[item.status].label}
            right={
              <IconButton
                icon="close-circle-outline"
                label={`Unfollow ${item.title}`}
                size={20}
                onPress={() => {
                  follow.mutate({ id: item.id, on: false });
                  toast('Unfollowed');
                }}
              />
            }
          />
        )}
        ListEmptyComponent={
          q.isPending ? (
            <RowSkeleton />
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
    </View>
  );
}
