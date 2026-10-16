import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { peoplePerDollar } from '@shared';
import { CampaignCard, CardSkeleton, ReachInfo } from '@/components/campaign';
import { Button, Card, ErrorState, Icon, IconButton, SectionTitle, T, type IconName } from '@/components/ui';
import { useCampaigns } from '@/lib/queries';
import { radius, space, useTheme } from '@/theme';

export function Wordmark() {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityRole="header" accessibilityLabel="Campaigns">
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="megaphone" size={16} color={c.onPrimary} />
      </View>
      <T variant="heading" style={{ fontSize: 22 }}>
        campaigns
      </T>
    </View>
  );
}

const STEPS: { icon: IconName; who: string; title: string; body: string }[] = [
  { icon: 'create-outline', who: 'Creator', title: 'Create', body: 'Write the message, add sources, and choose who it should reach.' },
  { icon: 'shield-checkmark-outline', who: 'Platform', title: 'Review', body: 'We check claims against sources and prepare the ads with distribution partners.' },
  { icon: 'radio-outline', who: 'Backers', title: 'Amplify', body: 'People chip in a few dollars to show the message to new audiences. Everyone gets a report.' },
];

export default function Home() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [reachOpen, setReachOpen] = useState(false);
  const featured = useCampaigns({ featured: true, status: 'all', sort: 'trending' });
  const feed = useCampaigns({ status: 'all', sort: 'trending', limit: 12 });
  const cardW = Math.min(width - 56, 360);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: space.huge }}
      refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => { feed.refetch(); featured.refetch(); }} tintColor={c.primary} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md }}>
        <Wordmark />
        <IconButton icon="help-circle-outline" label="How it works" onPress={() => router.push('/info/how-it-works')} />
      </View>

      {/* Hero */}
      <View style={{ paddingHorizontal: space.xl, gap: space.lg, paddingTop: space.md }}>
        <T variant="display" style={{ fontSize: 36, lineHeight: 42 }}>
          Deliver messages beyond your feed.
        </T>
        <T color="textMuted" style={{ fontSize: 16, lineHeight: 24 }}>
          Back the messages you care about so they reach people outside the creator’s own network. Your contribution pays for distribution, not the cause itself.
        </T>
        <Pressable
          onPress={() => setReachOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Estimate: one dollar puts a message in front of about ${peoplePerDollar()} people. Learn how this is estimated.`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.primarySoft, opacity: pressed ? 0.85 : 1 })}>
          <T variant="display" color="primary" style={{ fontSize: 30 }}>
            $1
          </T>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">≈ {peoplePerDollar()} people outside your network</T>
            <T variant="small" color="textMuted">
              Estimate from demo assumptions, not a guarantee. Tap to see how.
            </T>
          </View>
          <Icon name="information-circle-outline" size={20} color={c.primary} />
        </Pressable>
        <View style={{ gap: space.sm }}>
          <Button label="Explore campaigns" size="lg" onPress={() => router.push('/explore')} />
          <Button label="Start a campaign" size="lg" variant="secondary" onPress={() => router.push('/create')} />
        </View>
      </View>
      <ReachInfo visible={reachOpen} onClose={() => setReachOpen(false)} />

      {/* Featured */}
      <View style={{ marginTop: space.huge, gap: space.lg }}>
        <View style={{ paddingHorizontal: space.xl }}>
          <SectionTitle overline="Featured" title="Messages gaining momentum" action="See all" onAction={() => router.push('/explore')} />
        </View>
        {featured.isError ? (
          <ErrorState message={(featured.error as Error).message} onRetry={featured.refetch} />
        ) : (
          <FlatList
            horizontal
            data={featured.data?.items ?? [null, null]}
            keyExtractor={(item, i) => item?.id ?? `s${i}`}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + space.md}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}
            renderItem={({ item }) => <View style={{ width: cardW }}>{item ? <CampaignCard c={item} /> : <CardSkeleton />}</View>}
          />
        )}
      </View>

      {/* How it works */}
      <View style={{ marginTop: space.huge, paddingHorizontal: space.xl, gap: space.lg }}>
        <SectionTitle overline="How it works" title="Create. Review. Amplify." />
        <View style={{ gap: 0 }}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={{ flexDirection: 'row', gap: space.lg }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={s.icon} size={20} color={c.primary} />
                </View>
                {i < STEPS.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: c.border, marginVertical: 4 }} />}
              </View>
              <View style={{ flex: 1, paddingBottom: space.xl, gap: 2 }}>
                <T variant="overline" color="textMuted">
                  {s.who}
                </T>
                <T variant="subheading">{s.title}</T>
                <T color="textMuted">{s.body}</T>
              </View>
            </View>
          ))}
        </View>
        <Card style={{ gap: space.sm, backgroundColor: c.accentSoft, borderColor: c.accentSoft }}>
          <T variant="overline" color="accent">
            The fair question
          </T>
          <T variant="subheading">Why back a message instead of donating?</T>
          <T color="textMuted">
            A donation pays for rent, staff and supplies. Backing a campaign pays for the message to reach people who haven’t heard it yet, which can bring the cause new
            supporters. If you want to fund the cause directly, donate to it directly.
          </T>
          <Button label="Read how funds are used" variant="ghost" size="sm" iconRight="arrow-forward" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => router.push('/info/how-it-works')} />
        </Card>
      </View>

      {/* Feed */}
      <View style={{ marginTop: space.huge, paddingHorizontal: space.xl, gap: space.lg }}>
        <SectionTitle overline="Campaign feed" title="Open for backing" action="Explore" onAction={() => router.push('/explore')} />
        {feed.isPending ? (
          [0, 1].map((i) => <CardSkeleton key={i} />)
        ) : feed.isError ? (
          <ErrorState message={(feed.error as Error).message} onRetry={feed.refetch} />
        ) : (
          feed.data.items.map((item) => <CampaignCard key={item.id} c={item} />)
        )}
        <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
          <T variant="heading" center>
            Have a message that should travel further?
          </T>
          <T color="textMuted" center>
            Nonprofits, creators, businesses and community groups can create a campaign in five steps.
          </T>
          <Button label="Start a campaign" icon="add" onPress={() => router.push('/create')} />
        </Card>
      </View>

      <View style={{ marginTop: space.xxxl, paddingHorizontal: space.xl, flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
        {[
          ['About', 'about'],
          ['Partners', 'partners'],
          ['FAQs', 'faq'],
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
    </ScrollView>
  );
}
