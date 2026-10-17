import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import type { Contribution } from '@shared';
import { Header } from '@/components/Screen';
import { EmptyState, ErrorState, Icon, Pill, Skeleton, T } from '@/components/ui';
import { formatMoney, shortDate } from '@/lib/format';
import { useMyContributions } from '@/lib/queries';
import { radius, space, useTheme } from '@/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';

const TONE = { SUCCEEDED: 'success', PENDING: 'warning', FAILED: 'danger', CANCELLED: 'neutral', REFUNDED: 'info' } as const;
const LABEL = { SUCCEEDED: 'Paid', PENDING: 'Pending', FAILED: 'Failed', CANCELLED: 'Cancelled', REFUNDED: 'Refunded' } as const;

export default function Payments() {
  const { c } = useTheme();
  const q = useMyContributions();
  const pull = usePullRefresh(q.refetch);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Payment history" />
      <FlatList
        data={q.items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: space.xl, gap: space.sm }}
        onEndReached={q.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={c.spinner} colors={[c.spinner]} />}
        renderItem={({ item }) => <PaymentRow k={item} />}
        ListHeaderComponent={
          q.items.length ? (
            <T variant="small" color="textMuted" style={{ marginBottom: space.sm }}>
              Payments fund campaign distribution. They are not charitable donations. All payments in this prototype run in Razorpay test mode.
            </T>
          ) : null
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={c.spinner} style={{ padding: space.lg }} /> : null}
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ gap: space.sm }}>
              {[0, 1, 2].map((i) => <Skeleton key={i} h={72} r={12} />)}
            </View>
          ) : q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : (
            <EmptyState icon="receipt-outline" title="No payments yet" body="Receipts for campaigns you back will appear here." />
          )
        }
      />
    </View>
  );
}

function PaymentRow({ k }: { k: Contribution }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${LABEL[k.status]} ${formatMoney(k.total, true)} for ${k.campaignTitle}`}
      onPress={() => router.push({ pathname: '/receipt/[kid]', params: { kid: k.id } })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ flex: 1, gap: 4 }}>
        <T variant="bodyStrong" numberOfLines={1}>
          {k.campaignTitle}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Pill label={LABEL[k.status]} tone={TONE[k.status]} />
          <T variant="small" color="textMuted">
            {shortDate(k.createdAt)}
          </T>
        </View>
      </View>
      <T variant="bodyStrong" style={k.status !== 'SUCCEEDED' && { color: c.textSubtle, textDecorationLine: k.status === 'FAILED' || k.status === 'CANCELLED' ? 'line-through' : 'none' }}>
        {formatMoney(k.total, true)}
      </T>
      <Icon name="chevron-forward" size={16} color={c.textSubtle} />
    </Pressable>
  );
}
