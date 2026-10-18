import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppNotification } from '@shared';
import { TabHeader } from '@/components/TabHeader';
import { Button, EmptyState, ErrorState, Icon, IconButton, Skeleton, T, haptic } from '@/components/ui';
import { useTabReselect } from '@/hooks/useTabReselect';
import { api } from '@/lib/api';
import { relTime } from '@/lib/format';
import { queryClient, useNotificationFeed } from '@/lib/queries';
import { KIND_META } from '@/lib/kinds';
import { openNotification } from '@/lib/openNotification';
import { radius, space, useTheme } from '@/theme';
import { PullArea, usePullRefresh } from '@/hooks/usePullRefresh';
import { RippleLoader } from '@/components/brand/RippleMark';

type Row = { type: 'header'; label: string } | { type: 'item'; n: AppNotification };

function group(items: AppNotification[]): Row[] {
  const out: Row[] = [];
  const day = 864e5;
  const bucket = (iso: string) => {
    const age = Date.now() - new Date(iso).getTime();
    return age < day ? 'Today' : age < 7 * day ? 'This week' : 'Earlier';
  };
  let last = '';
  for (const n of items) {
    const b = bucket(n.createdAt);
    if (b !== last) out.push({ type: 'header', label: b });
    out.push({ type: 'item', n });
    last = b;
  }
  return out;
}

export default function Activity() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'all' | 'following'>('all');
  const all = useNotificationFeed('all');
  const following = useNotificationFeed('following');
  const feed = tab === 'all' ? all : following;
  const list = useRef<FlatList<Row>>(null);
  const unread = all.data?.pages[0]?.unread ?? 0;

  const pull = usePullRefresh(() => Promise.all([all.refetch(), following.refetch()]));
  const refresh = pull.onRefresh;
  useTabReselect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: true });
    refresh();
  });

  const markAll = async () => {
    haptic.light();
    await api('/notifications/read', { body: {} }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };
  const open = (n: AppNotification) => openNotification(n);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <TabHeader title="Activity">
        {unread > 0 && <IconButton icon="checkmark-done-outline" label="Mark all as read" onPress={markAll} />}
        <IconButton icon="settings-outline" label="Notification settings" onPress={() => router.push('/settings/notifications')} />
      </TabHeader>

      <View style={{ flexDirection: 'row', marginHorizontal: space.xl, marginVertical: space.md, padding: 4, borderRadius: radius.md, backgroundColor: c.surfaceAlt }} accessibilityRole="tablist">
        {(
          [
            ['all', unread ? `All · ${unread} new` : 'All'],
            ['following', 'Following'],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === k }}
            onPress={() => {
              haptic.light();
              setTab(k);
            }}
            style={{ flex: 1, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === k ? c.surface : 'transparent' }}>
            <T variant="smallStrong" color={tab === k ? 'text' : 'textMuted'}>
              {label}
            </T>
          </Pressable>
        ))}
      </View>

      {pull.indicator()}
      <PullArea pull={pull}>
      <FlatList
        ref={list}
        key={tab}
        data={group(feed.items)}
        keyExtractor={(r, i) => (r.type === 'item' ? r.n.id : `h${i}`)}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.huge }}
        refreshControl={pull.control()}
        onScroll={pull.onScroll}
        scrollEventThrottle={16}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          tab === 'following' && feed.items.length > 0 ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/following')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: space.xs }}>
              <T variant="small" color="textMuted" style={{ flex: 1 }}>
                Updates from campaigns you follow
              </T>
              <T variant="smallStrong" color="primary">
                Manage
              </T>
              <Icon name="chevron-forward" size={14} color={c.primary} />
            </Pressable>
          ) : null
        }
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <T variant="overline" color="textMuted" style={{ marginTop: space.lg, marginBottom: space.sm }}>
              {item.label}
            </T>
          ) : (
            <NotificationRow n={item.n} onPress={() => open(item.n)} />
          )
        }
        ListEmptyComponent={
          feed.isPending ? (
            // Shaped like notification rows: icon circle, a title with its time, and a body line or two.
            <View style={{ paddingTop: space.sm }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={{ flexDirection: 'row', gap: space.md, padding: space.md }}>
                  <Skeleton w={40} h={40} r={20} />
                  <View style={{ flex: 1, gap: 8, paddingTop: 2 }}>
                    <View style={{ flexDirection: 'row', gap: space.md }}>
                      <Skeleton w={`${50 + ((i * 17) % 30)}%`} h={13} />
                      <View style={{ flex: 1 }} />
                      <Skeleton w={28} h={10} />
                    </View>
                    <Skeleton h={10} />
                    {i % 2 === 0 && <Skeleton w="60%" h={10} />}
                  </View>
                </View>
              ))}
            </View>
          ) : feed.isError ? (
            <ErrorState message={(feed.error as Error).message} onRetry={() => feed.refetch()} />
          ) : tab === 'following' ? (
            <EmptyState
              icon="eye-outline"
              title="Nothing from followed campaigns yet"
              body="Tap “Follow progress” on any campaign. Its milestones, ad launch, delivery updates and final report will show up here. Campaigns you back are followed automatically."
              action={<Button label="Find campaigns to follow" variant="secondary" onPress={() => router.navigate('/explore')} />}
            />
          ) : (
            <EmptyState icon="notifications-outline" title="No notifications yet" body="Back or follow a campaign, or create one, and updates will appear here." />
          )
        }
        ListFooterComponent={feed.isFetchingNextPage ? <RippleLoader style={{ padding: space.lg }} /> : null}
      />
      </PullArea>
    </View>
  );
}

function NotificationRow({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  const { c } = useTheme();
  const m = KIND_META[n.kind] ?? KIND_META.UPDATE;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}. ${n.body}. ${relTime(n.createdAt)}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, padding: space.md, marginBottom: space.sm, borderRadius: radius.lg, backgroundColor: n.read ? 'transparent' : c.surface, borderWidth: n.read ? 0 : 1, borderColor: c.border, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={m.icon} size={19} color={c[m.tone]} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
            {n.title}
          </T>
          <T variant="small" color="textSubtle">
            {relTime(n.createdAt)}
          </T>
        </View>
        <T variant="small" color="textMuted" numberOfLines={3}>
          {n.body}
        </T>
      </View>
      {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, marginTop: 6 }} />}
    </Pressable>
  );
}
