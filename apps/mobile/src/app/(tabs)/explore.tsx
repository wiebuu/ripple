import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Pressable, RefreshControl, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, CREATOR_TYPES } from '@shared';
import { PostCard, PostDivider, PostSkeleton, SpotlightCard } from '@/components/campaign';
import { Sheet } from '@/components/Sheet';
import { TabHeader } from '@/components/TabHeader';
import { Button, Chip, EmptyState, ErrorState, Icon, IconButton, T, haptic } from '@/components/ui';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { useTabReselect } from '@/hooks/useTabReselect';
import { useCampaigns, useInfiniteCampaigns, type ListParams } from '@/lib/queries';
import { fonts, radius, space, useTheme } from '@/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';

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
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const searchRef = useRef<TextInput>(null);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(!!params.focus);
  const closeSearch = () => {
    setQ('');
    setSearchOpen(false);
  };
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
  // "Search" links from other screens open the search bar.
  const [lastFocus, setLastFocus] = useState(params.focus);
  if (params.focus !== lastFocus) {
    setLastFocus(params.focus);
    if (params.focus) setSearchOpen(true);
  }

  const query = useInfiniteCampaigns({ q: dq || undefined, category, sort, status, creatorType, minPct });
  const featured = useCampaigns({ featured: true, status: 'all', sort: 'trending' });
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - 72, 320);
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
  const { refreshing, onRefresh: refresh } = usePullRefresh(() => Promise.all([query.refetch(), featured.refetch()]));
  const list = useRef<FlatList>(null);
  const header = useCollapsingHeader();
  const padTop = insets.top + header.height;
  useTabReselect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: true });
    refresh();
  });
  // "Search" elsewhere opens Explore with the search field focused (each tap sends a fresh `focus` value).
  useEffect(() => {
    if (!params.focus) return;
    list.current?.scrollToOffset({ offset: 0, animated: false });
    const t = setTimeout(() => searchRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [params.focus]);

  const results = query.isPending
    ? 'Searching…'
    : query.isSuccess
      ? query.items.length < query.total
        ? `Showing ${query.items.length} of ${query.total}`
        : `${query.total} campaign${query.total === 1 ? '' : 's'}`
      : '';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: c.bg, zIndex: 20 }} />
      <Animated.View onLayout={header.onLayout} style={[header.headerStyle, { top: insets.top, backgroundColor: c.bg }]}>
        <TabHeader title="Explore">
          <IconButton icon={searchOpen ? 'close' : 'search'} label={searchOpen ? 'Close search' : 'Search'} onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))} />
          <View>
            <IconButton icon="options-outline" label={filterCount ? `Filters, ${filterCount} on` : 'Filters'} onPress={() => setSheet(true)} />
            {filterCount > 0 && (
              <View pointerEvents="none" style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                <T variant="small" style={{ fontSize: 10, lineHeight: 12, color: c.onPrimary, fontWeight: '700' }}>
                  {filterCount}
                </T>
              </View>
            )}
          </View>
        </TabHeader>
        {searchOpen && (
          <View style={{ paddingHorizontal: space.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: c.surfaceAlt }}>
              <Icon name="search" size={17} color={c.textMuted} />
              <TextInput
                ref={searchRef}
                value={q}
                onChangeText={setQ}
                placeholder="Search causes, creators, places"
                placeholderTextColor={c.textSubtle}
                autoFocus
                returnKeyType="search"
                accessibilityLabel="Search campaigns"
                style={{ flex: 1, fontFamily: fonts.sans, fontSize: 15, color: c.text }}
              />
              {!!q && <IconButton icon="close-circle" label="Clear search" size={17} onPress={() => setQ('')} style={{ marginRight: -space.sm }} />}
            </View>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm, gap: 6 }}>
          <CategoryPill label="All" selected={!category} onPress={() => setCategory(undefined)} />
          {CATEGORIES.map((cat) => (
            <CategoryPill key={cat} label={cat} selected={category === cat} onPress={() => setCategory(category === cat ? undefined : cat)} />
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.FlatList
        ref={list}
        data={query.items}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={PostDivider}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: padTop + space.xs, paddingBottom: space.huge }}
        keyboardDismissMode="on-drag"
        onEndReached={query.loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.spinner} colors={[c.spinner]} progressViewOffset={padTop} />}
        renderItem={({ item }) => <PostCard c={item} />}
        ListHeaderComponent={
          <View style={{ gap: space.lg }}>
            {!anyFilter && (featured.data?.items.length ?? 0) > 0 && (
              <View style={{ gap: space.md }}>
                <T variant="heading" style={{ paddingHorizontal: space.xl }}>
                  Gaining momentum
                </T>
                <FlatList
                  horizontal
                  data={featured.data!.items}
                  keyExtractor={(x) => `f-${x.id}`}
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={cardW + space.md}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}
                  renderItem={({ item }) => <SpotlightCard c={item} width={cardW} />}
                />
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl }}>
              <View style={{ flex: 1 }}>
                <T variant="heading">{anyFilter ? (category && !dq ? category : 'Results') : 'All campaigns'}</T>
                <T variant="small" color="textMuted" accessibilityLiveRegion="polite">
                  {results}
                </T>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sorted by ${sortLabel}. Change sort and filters`}
                onPress={() => setSheet(true)}
                hitSlop={6}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1 })}>
                <T variant="smallStrong">{sortLabel}</T>
                <Icon name="chevron-down" size={13} color={c.textMuted} />
              </Pressable>
            </View>
          </View>
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.xl }} accessibilityLiveRegion="polite">
              <ActivityIndicator color={c.spinner} />
              <T variant="small" color="textMuted">
                Loading more campaigns…
              </T>
            </View>
          ) : query.isFetchNextPageError ? (
            <View style={{ paddingTop: space.lg, paddingHorizontal: space.xl }}>
              <Button label="Couldn’t load more. Try again" variant="secondary" icon="refresh" onPress={() => query.fetchNextPage()} />
            </View>
          ) : !query.hasNextPage && query.items.length > 3 ? (
            <T variant="small" color="textSubtle" center style={{ paddingTop: space.xl }}>
              That’s everything for this search.
            </T>
          ) : null
        }
        ListEmptyComponent={
          query.isPending ? (
            <View>
              <PostSkeleton />
              <PostSkeleton />
            </View>
          ) : query.isError ? (
            <View style={{ paddingHorizontal: space.xl }}>
              <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
            </View>
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

/** Compact category filter: green when selected, quiet outline otherwise. */
function CategoryPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => ({ height: 32, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: selected ? c.primary : 'transparent', borderWidth: 1, borderColor: selected ? c.primary : c.border, opacity: pressed ? 0.75 : 1 })}>
      <T variant="smallStrong" style={{ color: selected ? c.onPrimary : c.textMuted }}>
        {label}
      </T>
    </Pressable>
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
