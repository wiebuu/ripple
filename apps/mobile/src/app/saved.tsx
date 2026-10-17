import { router } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { CampaignRow, RowSkeleton } from '@/components/campaign';
import { Header } from '@/components/Screen';
import { Button, EmptyState, ErrorState } from '@/components/ui';
import { useSaved } from '@/lib/queries';
import { space, useTheme } from '@/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';

export default function Saved() {
  const { c } = useTheme();
  const q = useSaved();
  const pull = usePullRefresh(q.refetch);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Saved campaigns" />
      <FlatList
        data={q.data?.items ?? []}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: space.xl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={c.spinner} colors={[c.spinner]} />}
        renderItem={({ item }) => <CampaignRow c={item} />}
        ListEmptyComponent={
          q.isPending ? <RowSkeleton /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
            <EmptyState icon="bookmark-outline" title="Nothing saved yet" body="Tap the bookmark on any campaign to read it later." action={<Button label="Explore campaigns" onPress={() => router.navigate('/explore')} />} />
          )
        }
      />
    </View>
  );
}
