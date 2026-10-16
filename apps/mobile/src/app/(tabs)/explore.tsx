import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, CREATOR_TYPES } from '@shared';
import { CampaignCard, CardSkeleton } from '@/components/campaign';
import { Sheet } from '@/components/Sheet';
import { Button, Chip, EmptyState, ErrorState, Icon, IconButton, T, haptic } from '@/components/ui';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { useInfiniteCampaigns, type ListParams } from '@/lib/queries';
import { fonts, radius, space, useTheme } from '@/theme';

const SORTS: { key: NonNullable<ListParams['sort']>; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'newest', label: 'Newest' },
  { key: 'closest', label: 'Closest to goal' },
  { key: 'ending', label: 'Ending soon' },
  { key: 'most_backed', label: 'Most backed' },
];
const STATUS: { key: NonNullable<ListParams['status']>; label: string }[] = [
  { key: 'all', label: 'All public' },
  { key: 'funding', label: 'Open for backing' },
  { key: 'promoting', label: 'Funded & promoting' },
  { key: 'completed', label: 'Completed' },
];

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export default function Explore() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | undefined>(params.category);
  const [sort, setSort] = useState<NonNullable<ListParams['sort']>>('trending');
  const [status, setStatus] = useState<NonNullable<ListParams['status']>>('all');
  const [creatorType, setCreatorType] = useState<string | undefined>();
  const [minPct, setMinPct] = useState<number | undefined>();
  const [sheet, setSheet] = useState(false);
  const dq = useDebounced(q.trim());

  // Follow category links from other screens (e.g. /explore?category=Health).
  const [lastParam, setLastParam] = useState(params.category);
  if (params.category !== lastParam) {
    setLastParam(params.category);
    if (params.category) setCategory(params.category);
  }

  const query = useInfiniteCampaigns({ q: dq || undefined, category, sort, status, creatorType, minPct });
  const header = useCollapsingHeader();
  const filterCount = [status !== 'all', !!creatorType, !!minPct].filter(Boolean).length;
  const anyFilter = !!dq || !!category || filterCount > 0;
  const clear = () => {
    setQ('');
    setCategory(undefined);
    setStatus('all');
    setCreatorType(undefined);
    setMinPct(undefined);
  };
  const sortLabel = useMemo(() => SORTS.find((s) => s.key === sort)!.label, [sort]);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    haptic.light();
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: c.bg, zIndex: 20 }} />
      <Animated.View onLayout={header.onLayout} style={[header.headerStyle, { top: insets.top, backgroundColor: c.bg }]}>
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md }}>
          <T variant="title" accessibilityRole="header">
            Explore
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <Icon name="search" size={18} color={c.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search campaigns, creators, topics"
              placeholderTextColor={c.textSubtle}
              returnKeyType="search"
              accessibilityLabel="Search campaigns"
              style={{ flex: 1, fontFamily: fonts.sans, fontSize: 16, color: c.text }}
            />
            {!!q && <IconButton icon="close-circle" label="Clear search" size={18} onPress={() => setQ('')} />}
          </View>
        </View>
        <View style={{ height: 60 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, alignItems: 'center', gap: space.sm }}>
            <Chip label="All" selected={!category} onPress={() => setCategory(undefined)} />
            {CATEGORIES.map((cat) => (
              <Chip key={cat} label={cat} selected={category === cat} onPress={() => setCategory(category === cat ? undefined : cat)} />
            ))}
          </ScrollView>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingBottom: space.sm, gap: space.sm }}>
          <T variant="small" color="textMuted" style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {query.isPending ? 'Searching…' : query.isSuccess ? `${query.total} campaign${query.total === 1 ? '' : 's'} · ${sortLabel}` : ''}
          </T>
          <Button label={filterCount ? `Sort & filter · ${filterCount}` : 'Sort & filter'} icon="options-outline" size="sm" variant="secondary" onPress={() => setSheet(true)} />
        </View>
      </Animated.View>

      <Animated.FlatList
        data={query.items}
        keyExtractor={(i) => i.id}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + header.height + space.sm, gap: space.lg, paddingBottom: space.huge }}
        keyboardDismissMode="on-drag"
        onEndReached={query.loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} progressViewOffset={insets.top + header.height} />}
        renderItem={({ item }) => <CampaignCard c={item} />}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={c.primary} style={{ paddingVertical: space.lg }} accessibilityLabel="Loading more campaigns" />
          ) : query.isFetchNextPageError ? (
            <Button label="Couldn’t load more. Try again" variant="secondary" icon="refresh" onPress={() => query.fetchNextPage()} />
          ) : !query.hasNextPage && query.items.length > 3 ? (
            <T variant="small" color="textSubtle" center>
              That’s everything for this search.
            </T>
          ) : null
        }
        ListEmptyComponent={
          query.isPending ? (
            <View style={{ gap: space.lg }}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : query.isError ? (
            <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
          ) : anyFilter ? (
            <EmptyState
              icon="search-outline"
              title="No campaigns match"
              body={dq ? `Nothing found for “${dq}”${category ? ` in ${category}` : ''}. Try a different word or remove a filter.` : 'Try removing a filter.'}
              action={<Button label="Clear search and filters" variant="secondary" onPress={clear} />}
            />
          ) : (
            <EmptyState title="No campaigns yet" body="Be the first to start one." />
          )
        }
      />

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Sort & filter" footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Reset" variant="secondary" style={{ flex: 1 }} onPress={() => { setSort('trending'); setStatus('all'); setCreatorType(undefined); setMinPct(undefined); }} />
          <Button label={query.isSuccess ? `Show ${query.total} results` : 'Show results'} style={{ flex: 2 }} onPress={() => setSheet(false)} />
        </View>
      }>
        <Group title="Sort by">
          {SORTS.map((s) => <Chip key={s.key} label={s.label} selected={sort === s.key} onPress={() => setSort(s.key)} />)}
        </Group>
        <Group title="Campaign stage">
          {STATUS.map((s) => <Chip key={s.key} label={s.label} selected={status === s.key} onPress={() => setStatus(s.key)} />)}
        </Group>
        <Group title="Creator type">
          <Chip label="Any" selected={!creatorType} onPress={() => setCreatorType(undefined)} />
          {CREATOR_TYPES.map((t) => <Chip key={t} label={t} selected={creatorType === t} onPress={() => setCreatorType(t)} />)}
        </Group>
        <Group title="Funding progress">
          {[undefined, 25, 50, 75].map((p) => <Chip key={String(p)} label={p ? `${p}%+ funded` : 'Any'} selected={minPct === p} onPress={() => setMinPct(p)} />)}
        </Group>
      </Sheet>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <T variant="smallStrong">{title}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>
    </View>
  );
}
