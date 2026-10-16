import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { channelFactor, estimateReach } from '@shared';
import { ReachLine } from '@/components/campaign';
import { Footer, Header } from '@/components/Screen';
import { StoryView } from '@/components/Story';
import { Banner, Button, Card, EmptyState, ProgressBar, T } from '@/components/ui';
import { useDrafts } from '@/lib/draft';
import { formatMoney } from '@/lib/format';
import { space, useTheme } from '@/theme';

/** Read-only preview of the draft exactly as the public page lays it out. */
export default function DraftPreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const d = useDrafts((s) => s.entries[id]?.content);

  if (!d)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Preview" />
        <EmptyState title="Nothing to preview yet" body="Open the draft first, then preview it." />
      </View>
    );

  const cover = d.visuals.coverImage || d.basics.coverImage;
  const goal = d.goal ?? 0;
  const story = { ...d.story, headline: d.story.headline || d.basics.title };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Preview" subtitle="Not published" />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }}>
        <View style={{ paddingHorizontal: space.xl, paddingBottom: space.lg }}>
          <Banner tone="accent" icon="eye-outline" body="This is how backers will see your campaign. Nothing is public until it’s approved." />
        </View>
        {cover ? (
          <Image source={cover} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" />
        ) : (
          <View style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <T color="textSubtle">No cover image yet</T>
          </View>
        )}
        <View style={{ padding: space.xl, gap: space.lg }}>
          <T variant="overline" color="primary">
            {d.basics.category || 'Category'}
          </T>
          <T variant="display">{d.basics.title || 'Your campaign title'}</T>
          <T variant="bodyStrong">by {d.basics.creatorName || 'Your name'}</T>
          {!!d.basics.summary && (
            <T color="textMuted" style={{ fontSize: 17, lineHeight: 25 }}>
              {d.basics.summary}
            </T>
          )}
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <T variant="subheading">₹0</T>
              <T variant="small" color="textMuted">
                of {goal ? formatMoney(goal) : 'your goal'}
              </T>
            </View>
            <ProgressBar value={0} />
            {goal > 0 && <ReachLine people={estimateReach(goal, channelFactor(d.reach.channels))} />}
            <Button label="Back this campaign" disabled />
          </Card>
          <View style={{ paddingTop: space.lg }}>
            <StoryView story={story} />
          </View>
        </View>
      </ScrollView>
      <Footer>
        <Button label="Back to editing" icon="create-outline" onPress={() => router.back()} />
      </Footer>
    </View>
  );
}
