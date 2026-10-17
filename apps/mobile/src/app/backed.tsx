import { router } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { CampaignRow, RowSkeleton } from '@/components/campaign';
import { Header } from '@/components/Screen';
import { Button, EmptyState, ErrorState } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useBacked } from '@/lib/queries';
import { space, useTheme } from '@/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';

export default function Backed() {
  const { c } = useTheme();
  const q = useBacked();
  const pull = usePullRefresh(q.refetch);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Backed campaigns" />
      <FlatList
        data={q.data?.items ?? []}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: space.xl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={c.spinner} colors={[c.spinner]} />}
        renderItem={({ item }) => <CampaignRow c={item} meta={`You contributed ${formatMoney(item.myTotal, true)}`} />}
        ListEmptyComponent={
          q.isPending ? <RowSkeleton /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
            <EmptyState icon="megaphone-outline" title="You haven’t backed a campaign yet" body="Backing pays to show a message to people outside the creator’s network." action={<Button label="Explore campaigns" onPress={() => router.navigate('/explore')} />} />
          )
        }
      />
    </View>
  );
}
