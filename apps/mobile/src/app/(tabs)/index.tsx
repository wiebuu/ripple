import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, FlatList, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, peoplePerHundred } from '@shared';
import { Wordmark } from '@/components/brand/Logo';
import { PatternScroll, PatternWindow, usePatternScroll } from '@/components/brand/PatternWindow';
import { PostCard, PostDivider, PostSkeleton, ReachInfo, SpotlightCard } from '@/components/campaign';
import { TabHeader } from '@/components/TabHeader';
import { Button, ErrorState, Icon, IconButton, Skeleton, T, haptic } from '@/components/ui';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { useTabReselect } from '@/hooks/useTabReselect';
import { HOME_FEATURED, HOME_FEED, useCampaigns, useInfiniteCampaigns } from '@/lib/queries';
import { radius, space, useTheme } from '@/theme';
import { PullArea, usePullRefresh } from '@/hooks/usePullRefresh';
import { RippleLoader } from '@/components/brand/RippleMark';

const STEPS: { who: string; title: string; body: string }[] = [
  { who: 'Creator', title: 'Create', body: 'Write the message and pick who it should reach.' },
  { who: 'Platform', title: 'Review', body: 'Claims are checked and the ads prepared.' },
  { who: 'Backers', title: 'Amplify', body: 'Small amounts fund the reach. Everyone gets a report.' },
];

export default function Home() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const featured = useCampaigns(HOME_FEATURED);
  const feed = useInfiniteCampaigns(HOME_FEED);

  const list = useRef<FlatList>(null);
  const header = useCollapsingHeader();
  const pull = usePullRefresh(() => Promise.all([feed.refetch(), featured.refetch()]), header.scrollY);
  const refresh = pull.onRefresh;
  const padTop = insets.top + header.height;
  useTabReselect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: true });
    refresh();
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Status bar backdrop so content never shows behind the clock when the header hides */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: c.bg, zIndex: 20 }} />
      <Animated.View onLayout={header.onLayout} style={[header.headerStyle, { top: insets.top, backgroundColor: c.bg }]}>
        <TabHeader left={<Wordmark />}>
          <IconButton icon="help-circle-outline" label="How it works" onPress={() => router.push('/info/how-it-works')} />
        </TabHeader>
      </Animated.View>

      {pull.indicator(padTop)}
      <PullArea pull={pull}>
      <PatternScroll axis="y" value={header.scrollY}>
      <Animated.FlatList
        ref={list}
        data={feed.items}
        keyExtractor={(item) => item.id}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: padTop, paddingBottom: space.huge }}
        refreshControl={pull.control(padTop)}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={<HomeIntro featured={featured} />}
        renderItem={({ item }) => <PostCard c={item} />}
        ItemSeparatorComponent={PostDivider}
        ListEmptyComponent={
          feed.isPending ? (
            <View>
              <PostSkeleton />
              <PostSkeleton />
            </View>
          ) : feed.isError ? (
            <View style={{ paddingHorizontal: space.xl }}>
              <ErrorState message={(feed.error as Error).message} onRetry={() => feed.refetch()} />
            </View>
          ) : null
        }
        ListFooterComponent={<HomeFooter loading={feed.isFetchingNextPage} done={!feed.hasNextPage && feed.items.length > 0} pageError={feed.isFetchNextPageError} onRetry={() => feed.fetchNextPage()} />}
      />
      </PatternScroll>
      </PullArea>
    </View>
  );
}

/** Section heading with an optional text action on the right. */
function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: space.xl }}>
      <T variant="heading" style={{ flex: 1, fontSize: 18, lineHeight: 23 }}>
        {title}
      </T>
      {!!action && (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <T variant="smallStrong" color="primary">
            {action}
          </T>
        </Pressable>
      )}
    </View>
  );
}

function HomeIntro({ featured }: { featured: ReturnType<typeof useCampaigns> }) {
  const { c, dark } = useTheme();
  const { width } = useWindowDimensions();
  const [reachOpen, setReachOpen] = useState(false);
  const spotW = Math.min(width - 64, 320);
  const chips = usePatternScroll('x');
  return (
    <View style={{ gap: space.xxl }}>
      {/* Hero: compact themed card with the faint swirl pattern */}
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.xs }}>
        <View style={{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: c.surface, padding: space.lg + 2, gap: space.md, borderWidth: 1, borderColor: c.border }}>
          <PatternWindow />
          <T variant="overline" color="primary">
            Community-funded reach
          </T>
          <T variant="title" style={{ fontSize: 26, lineHeight: 30 }}>
            Turn one message into a ripple.
          </T>
          <T color="textMuted" style={{ fontSize: 14, lineHeight: 20 }}>
            Back a campaign to show its message to people outside the creator’s network. You fund the reach, not the cause.
          </T>
          <Pressable
            onPress={() => setReachOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Estimate: 100 rupees puts a message in front of about ${peoplePerHundred()} people. Learn how this is estimated.`}
            hitSlop={6}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.primarySoft, opacity: pressed ? 0.8 : 1 })}>
            <T variant="smallStrong" color="primary">
              ₹100 ≈ {peoplePerHundred()} new people
            </T>
            <T variant="small" color="textMuted" style={{ fontSize: 12 }}>
              est.
            </T>
            <Icon name="information-circle-outline" size={14} color={c.primary} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 2 }}>
            <Pressable accessibilityRole="button" onPress={() => { haptic.light(); router.navigate('/explore'); }} style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: radius.md, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
              <T variant="bodyStrong" style={{ color: c.onPrimary }}>
                Explore campaigns
              </T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { haptic.light(); router.navigate('/create'); }} style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
              <T variant="bodyStrong">Start a campaign</T>
            </Pressable>
          </View>
        </View>
      </View>
      <ReachInfo visible={reachOpen} onClose={() => setReachOpen(false)} />

      {/* Browse by cause: jumps to Explore already filtered */}
      <View style={{ gap: space.md }}>
        <Section title="Browse by cause" />
        <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} onScroll={chips.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: space.xl, gap: 6 }}>
          <PatternScroll axis="x" value={chips.value}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              accessibilityRole="button"
              onPress={() => {
                haptic.light();
                router.navigate({ pathname: '/explore', params: { category: cat } });
              }}
              style={({ pressed }) => ({ height: 34, paddingHorizontal: 14, borderRadius: radius.pill, overflow: 'hidden', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1 })}>
              <PatternWindow opacity={dark ? 0.08 : 0.12} />
              <T variant="smallStrong">{cat}</T>
            </Pressable>
          ))}
          </PatternScroll>
        </Animated.ScrollView>
      </View>

      {/* Featured */}
      <View style={{ gap: space.md }}>
        <Section title="Gaining momentum" action="See all" onAction={() => router.navigate('/explore')} />
        {featured.isError ? (
          <View style={{ paddingHorizontal: space.xl }}>
            <ErrorState message={(featured.error as Error).message} onRetry={() => featured.refetch()} />
          </View>
        ) : (
          <FlatList
            horizontal
            data={featured.data?.items ?? [null, null]}
            keyExtractor={(item, i) => item?.id ?? `s${i}`}
            showsHorizontalScrollIndicator={false}
            snapToInterval={spotW + space.md}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}
            renderItem={({ item }) => (item ? <SpotlightCard c={item} width={spotW} height={176} /> : <Skeleton w={spotW} h={176} r={22} />)}
          />
        )}
      </View>

      {/* How it works: three numbered steps in one card */}
      <View style={{ gap: space.md }}>
        <Section title="How it works" action="Learn more" onAction={() => router.push('/info/how-it-works')} />
        <View style={{ marginHorizontal: space.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: space.lg, gap: space.md }}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <T variant="smallStrong" color="primary">
                  {i + 1}
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">
                  {s.title}{' '}
                  <T variant="small" color="textSubtle">
                    · {s.who}
                  </T>
                </T>
                <T variant="small" color="textMuted">
                  {s.body}
                </T>
              </View>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: c.border }} />
          <View style={{ gap: 2 }}>
            <T variant="smallStrong">Why back a message instead of donating?</T>
            <T variant="small" color="textMuted">
              A donation pays for the cause’s costs. Backing pays for the message to reach new people, who may then support the cause. To fund the cause itself, donate to it directly.
            </T>
          </View>
        </View>
      </View>

      <Section title="All campaigns" action="Search" onAction={() => router.navigate({ pathname: '/explore', params: { focus: String(Date.now()) } })} />
    </View>
  );
}

function HomeFooter({ loading, done, pageError, onRetry }: { loading: boolean; done: boolean; pageError: boolean; onRetry: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: space.xl, gap: space.xl, paddingTop: space.sm }}>
      {loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.md }} accessibilityLiveRegion="polite">
          <RippleLoader />
          <T variant="small" color="textMuted">
            Loading more campaigns…
          </T>
        </View>
      )}
      {pageError && <Button label="Couldn’t load more. Try again" variant="secondary" icon="refresh" onPress={onRetry} />}
      {!!done && (
        <T variant="small" color="textSubtle" center>
          You’ve seen every campaign. Check back soon.
        </T>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.primarySoft }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="bodyStrong">Got a message that should make waves?</T>
          <T variant="small" color="textMuted">
            Create a campaign in five steps.
          </T>
        </View>
        <Button label="Start" size="sm" onPress={() => router.navigate('/create')} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.sm }}>
        {[
          ['About', 'about'],
          ['Partners', 'partners'],
          ['FAQs', 'faq'],
          ['Help', 'help'],
          ['Community guidelines', 'guidelines'],
          ['Terms', 'terms'],
          ['Privacy', 'privacy'],
        ].map(([label, page]) => (
          <Pressable key={page} accessibilityRole="link" onPress={() => router.push({ pathname: '/info/[page]', params: { page } })} hitSlop={8}>
            <T variant="small" color="textMuted" style={{ textDecorationLine: 'underline' }}>
              {label}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
