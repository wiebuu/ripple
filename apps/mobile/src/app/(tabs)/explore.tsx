import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, CREATOR_TYPES } from '@shared';
import { PostCard, PostDivider, PostSkeleton, SpotlightCard } from '@/components/campaign';
import { Sheet } from '@/components/Sheet';
import { TabHeader } from '@/components/TabHeader';
import { PatternScroll, PatternWindow, usePatternScroll } from '@/components/brand/PatternWindow';
import { Button, EmptyState, ErrorState, Icon, IconButton, T, haptic, type IconName } from '@/components/ui';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { useTabReselect } from '@/hooks/useTabReselect';
import { useCampaigns, useInfiniteCampaigns, type ListParams } from '@/lib/queries';
import { fonts, radius, space, useTheme } from '@/theme';
import { PullArea, usePullRefresh } from '@/hooks/usePullRefresh';
import { RippleLoader } from '@/components/brand/RippleMark';

const SORTS: { key: NonNullable<ListParams['sort']>; label: string; icon: IconName }[] = [
  { key: 'trending', label: 'Trending', icon: 'stats-chart-outline' },
  { key: 'newest', label: 'Newest', icon: 'sparkles-outline' },
  { key: 'closest', label: 'Closest to goal', icon: 'flag-outline' },
  { key: 'ending', label: 'Ending soon', icon: 'time-outline' },
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
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const searchRef = useRef<TextInput>(null);
  const [q, setQ] = useState('');
  const chips = usePatternScroll('x');
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
  const list = useRef<FlatList>(null);
  const header = useCollapsingHeader();
  const pull = usePullRefresh(() => Promise.all([query.refetch(), featured.refetch()]), header.scrollY);
  const refresh = pull.onRefresh;
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
        <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} onScroll={chips.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm, gap: 6 }}>
          <PatternScroll axis="x" value={chips.value}>
          <CategoryPill label="All" selected={!category} onPress={() => setCategory(undefined)} />
          {CATEGORIES.map((cat) => (
            <CategoryPill key={cat} label={cat} selected={category === cat} onPress={() => setCategory(category === cat ? undefined : cat)} />
          ))}
          </PatternScroll>
        </Animated.ScrollView>
      </Animated.View>

      {pull.indicator(padTop)}
      <PullArea pull={pull}>
      <PatternScroll axis="y" value={header.scrollY}>
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
        refreshControl={pull.control(padTop)}
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
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, overflow: 'hidden', borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1 })}>
                <PatternWindow opacity={dark ? 0.07 : 0.1} />
                <T variant="smallStrong">{sortLabel}</T>
                <Icon name="chevron-down" size={13} color={c.textMuted} />
              </Pressable>
            </View>
          </View>
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.xl }} accessibilityLiveRegion="polite">
              <RippleLoader />
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
      </PatternScroll>
      </PullArea>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Sort & filter"
        footer={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            {(sort !== 'trending' || filterCount > 0) && (
              <Button label="Reset" variant="ghost" size="sm" onPress={() => { setSort('trending'); setStatus('all'); setCreatorType(undefined); setMinPct(undefined); }} />
            )}
            <Button label={query.isSuccess ? `Show ${query.total} result${query.total === 1 ? '' : 's'}` : 'Show results'} style={{ flex: 1 }} onPress={() => setSheet(false)} />
          </View>
        }>
        <Group title="Sort by">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {SORTS.map((s, i) => (
              <SortTile key={s.key} label={s.label} icon={s.icon} selected={sort === s.key} wide={i === SORTS.length - 1 && SORTS.length % 2 === 1} onPress={() => setSort(s.key)} />
            ))}
          </View>
        </Group>
        <Group title="Campaign stage">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {STATUS.map((s) => <SoftChip key={s.key} label={s.label} selected={status === s.key} onPress={() => setStatus(s.key)} />)}
          </View>
        </Group>
        <Group title="Creator type">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <SoftChip label="Any" selected={!creatorType} onPress={() => setCreatorType(undefined)} />
            {CREATOR_TYPES.map((t) => <SoftChip key={t} label={t} selected={creatorType === t} onPress={() => setCreatorType(t)} />)}
          </View>
        </Group>
        <Group title="Funding progress">
          <Segmented options={[{ key: undefined, label: 'Any' }, { key: 25, label: '25%+' }, { key: 50, label: '50%+' }, { key: 75, label: '75%+' }]} value={minPct} onChange={setMinPct} />
        </Group>
      </Sheet>
    </View>
  );
}

/** Compact category filter: green when selected, quiet outline otherwise. */
function CategoryPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { c, dark } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => ({ height: 32, paddingHorizontal: 14, borderRadius: radius.pill, overflow: 'hidden', justifyContent: 'center', backgroundColor: selected ? c.primary : 'transparent', borderWidth: 1, borderColor: selected ? c.primary : c.border, opacity: pressed ? 0.75 : 1 })}>
      {!selected && <PatternWindow opacity={dark ? 0.07 : 0.1} />}
      <T variant="smallStrong" style={{ color: selected ? c.onPrimary : c.textMuted }}>
        {label}
      </T>
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <T variant="overline" color="textMuted">
        {title}
      </T>
      {children}
    </View>
  );
}

/** Sort choice as a small tile: icon over label; the selected one is outlined in green on a soft fill. */
function SortTile({ label, icon, selected, wide, onPress }: { label: string; icon: IconName; selected: boolean; wide?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Sort by ${label}`}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => ({
        // Two per row; an odd last tile spans the full width.
        width: wide ? '100%' : '48.6%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        height: 48,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primarySoft : c.surface,
        opacity: pressed ? 0.75 : 1,
      })}>
      <Icon name={icon} size={17} color={selected ? c.primary : c.textMuted} />
      <T variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: selected ? '700' : '500', color: selected ? c.primary : c.text }}>
        {label}
      </T>
    </Pressable>
  );
}

/** Light filter chip: outlined, with a soft green fill when selected. */
function SoftChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        height: 34,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primarySoft : c.surface,
        opacity: pressed ? 0.75 : 1,
      })}>
      <T variant="small" style={{ fontWeight: '600', color: selected ? c.primary : c.text }}>
        {label}
      </T>
    </Pressable>
  );
}

/** A compact segmented control for a few mutually exclusive values. */
function Segmented<K>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: c.surfaceAlt }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              haptic.light();
              onChange(o.key);
            }}
            style={{ flex: 1, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent' }}>
            <T variant="small" style={{ fontWeight: on ? '700' : '500', color: on ? c.text : c.textMuted }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
