import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BACKABLE_STATUSES, CHANNELS, REACH_CONFIG, STATUS_META, feeBreakdown } from '@shared';
import { Accordion } from '@/components/Accordion';
import { Funding, ReachLine, SupporterStack } from '@/components/campaign';
import { ReportSheet } from '@/components/ReportSheet';
import { Footer } from '@/components/Screen';
import { StoryView, SourceList } from '@/components/Story';
import { Banner, Button, Card, DemoBadge, ErrorState, Icon, IconButton, Pill, Skeleton, StatusPill, T, haptic } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMoney, formatReach, pct, relTime, shortDate, timeLeft } from '@/lib/format';
import { useCampaign, useFollowCampaign, useToggle, type Detail } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useBackOrPush } from '@/lib/nav';
import { shareCampaign } from '@/lib/share';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';

export default function CampaignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useCampaign(id);
  const scrollY = useState(() => new Animated.Value(0))[0];
  const [reportOpen, setReportOpen] = useState(false);
  const goTo = useBackOrPush();
  // Where the funding card ends in the scroll content: the sticky bar only appears once it has scrolled away.
  const [colY, setColY] = useState(0);
  const [fundEnd, setFundEnd] = useState(0);

  if (q.isPending) return <DetailSkeleton />;
  if (q.isError || !q.data)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <ErrorState message={(q.error as Error)?.message} onRetry={q.refetch} />
      </View>
    );

  const d = q.data;
  const headerOpacity = scrollY.interpolate({ inputRange: [180, 240], outputRange: [0, 1], extrapolate: 'clamp' });
  const backable = BACKABLE_STATUSES.includes(d.status);
  const passed = fundEnd ? colY + fundEnd - (insets.top + 60) : 1e6;
  const footerShift = scrollY.interpolate({ inputRange: [passed - 40, passed], outputRange: [140, 0], extrapolate: 'clamp' });
  const footerFade = scrollY.interpolate({ inputRange: [passed - 40, passed], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Compact header fades in once the cover scrolls away */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          zIndex: 2,
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top,
          // 8pt of breathing room below the buttons; paddingBottom keeps the title level with them.
          height: insets.top + 60,
          paddingBottom: 8,
          backgroundColor: c.bg,
          opacity: headerOpacity,
          justifyContent: 'center',
          paddingLeft: 60,
          paddingRight: 112,
        }}>
        <T variant="bodyStrong" numberOfLines={1}>
          {d.title}
        </T>
      </Animated.View>
      <View style={{ position: 'absolute', zIndex: 3, top: insets.top + 4, left: space.sm, right: space.sm, flexDirection: 'row', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" label="Back to Explore" tone="onImage" onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <SaveButton d={d} />
          <IconButton icon="share-outline" label="Share campaign" tone="onImage" onPress={() => shareCampaign(d)} />
        </View>
      </View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}>
        <Image source={d.coverImage} style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: c.skeleton }} contentFit="cover" accessibilityLabel={`Cover image for ${d.title}`} />

        <View onLayout={(e) => setColY(e.nativeEvent.layout.y)} style={{ paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
            <T variant="overline" color="primary">
              {d.category}
            </T>
            {d.status !== 'FUNDING' && <StatusPill status={d.status} />}
            {d.isDemo && <DemoBadge />}
          </View>
          <T variant="display">{d.title}</T>
          <View style={{ gap: 2 }}>
            <T variant="bodyStrong">
              by {d.creatorName}{' '}
              <T variant="small" color="textMuted">
                · {d.creatorType}
              </T>
            </T>
            <T variant="small" color="textMuted">
              {d.publishedAt ? `Published ${shortDate(d.publishedAt)}` : d.submittedAt ? `Submitted ${shortDate(d.submittedAt)}` : 'Not yet submitted'}
            </T>
          </View>
          <T color="textMuted" style={{ fontSize: 17, lineHeight: 25 }}>
            {d.summary}
          </T>

          {!!d.isOwner && (
            <Banner
              tone="info"
              icon="person-circle-outline"
              title="This is your campaign"
              body={STATUS_META[d.status].description}
              action={
                <Button
                  label="Manage campaign"
                  size="sm"
                  variant="secondary"
                  style={{ alignSelf: 'flex-start', marginTop: 6 }}
                  onPress={() => goTo('manage/[id]', { pathname: '/manage/[id]', params: { id: d.id } }, d.id)}
                />
              }
            />
          )}

          <View onLayout={(e) => setFundEnd(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
            <FundingCard d={d} />
          </View>
        </View>

        <View style={{ paddingHorizontal: space.xl, paddingTop: space.xxxl }}>
          <StoryView story={d.story} />
        </View>

        <View style={{ paddingHorizontal: space.xl, paddingTop: space.xxxl }}>
          <T variant="overline" color="textMuted" style={{ marginBottom: space.xs }}>
            Before you back this
          </T>
          <UseOfFunds d={d} />
          <Audience d={d} />
          <Accordion title="Review & trust" icon="shield-checkmark-outline" summary="What we checked, and what we didn’t">
            <T>Every campaign is reviewed by our team before it can be published or advertised:</T>
            {[
              'Claims checked against the sources listed',
              'Images and ads checked against advertising policies',
              'Targeting checked: adults only, no sensitive categories',
              'Budget and channels confirmed before ads launch',
            ].map((x) => (
              <Bullet key={x} text={x} />
            ))}
            <T variant="small" color="textMuted">
              Review is not independent fact-checking, and we don’t publish trust scores. Read the sources and decide for yourself.
            </T>
            <T variant="smallStrong">Sources ({d.story.sources.length})</T>
            <SourceList sources={d.story.sources} />
          </Accordion>
          <Accordion title="Distribution partners" icon="git-network-outline" summary="Where the ads are bought">
            <T>Ads are bought through standard advertising networks for the channels shown above. Partners deliver and measure the ads; they don’t see backer details.</T>
            <Button
              label="About our partners"
              variant="ghost"
              size="sm"
              iconRight="arrow-forward"
              style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
              onPress={() => router.push('/info/partners')}
            />
          </Accordion>
          {!d.isOwner && (
            <Pressable accessibilityRole="button" onPress={() => setReportOpen(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
              <Icon name="flag-outline" size={18} color={c.textMuted} />
              <T variant="small" color="textMuted">
                Something wrong with this campaign?{' '}
                <T variant="smallStrong" color="danger">
                  Report it
                </T>
              </T>
            </Pressable>
          )}
        </View>

        {(d.status === 'PROMOTING' || d.status === 'COMPLETED') && (
          <View style={{ paddingHorizontal: space.xl, paddingTop: space.xxl }}>
            <Card onPress={() => router.push({ pathname: '/campaign/[id]/report', params: { id: d.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="overline" color="primary">
                  {d.report?.final ? 'Final report' : 'Distribution report'}
                </T>
                <T variant="subheading">See where the money went</T>
                <T variant="small" color="textMuted">
                  {d.report?.impressions ? `${formatReach(d.report.impressions)} impressions measured so far` : 'Delivery numbers appear once ads start'}
                </T>
              </View>
              <Icon name="chevron-forward" size={20} color={c.textSubtle} />
            </Card>
          </View>
        )}

        {d.updates.length > 0 && (
          <View style={{ paddingHorizontal: space.xl, paddingTop: space.xxl, gap: space.md }}>
            <T variant="heading">Updates</T>
            {d.updates.map((u) => (
              <Card key={u.id} style={{ gap: 4 }}>
                <T variant="small" color="textMuted">
                  {relTime(u.createdAt)}
                </T>
                <T variant="bodyStrong">{u.title}</T>
                <T color="textMuted">{u.body}</T>
              </Card>
            ))}
          </View>
        )}

        {d.publicBackers.length > 0 && (
          <View style={{ paddingHorizontal: space.xl, paddingTop: space.xxl, gap: space.sm }}>
            <T variant="heading">Recent backers</T>
            <T variant="small" color="textMuted">
              Backer names are private by default. Only people who chose to be listed appear here, and amounts are never shown.
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {d.publicBackers.map((b, i) => (
                <Pill key={i} label={b.name} />
              ))}
              {d.backerCount > d.publicBackers.length && <Pill label={`+ ${(d.backerCount - d.publicBackers.length).toLocaleString('en-US')} private`} />}
            </View>
          </View>
        )}

        {d.status !== 'DRAFT' && !d.isOwner && <FeedbackPrompt id={d.id} />}
      </Animated.ScrollView>
      <ReportSheet campaignId={d.id} visible={reportOpen} onClose={() => setReportOpen(false)} />

      {/* Sticky bar: slides in only after the funding card (which has its own actions) has scrolled away. */}
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, opacity: footerFade, transform: [{ translateY: footerShift }] }}>
        <Footer>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong" numberOfLines={1}>
                {formatMoney(d.raised)}{' '}
                <T variant="small" color="textMuted">
                  of {formatMoney(d.goal)} · {pct(d.raised, d.goal)}%
                </T>
              </T>
              <T variant="small" color="textMuted" numberOfLines={1}>
                {backable ? timeLeft(d.endsAt) : STATUS_META[d.status].label} · ≈ {formatReach(d.reachAtGoal)} reach (est.)
              </T>
            </View>
            {backable ? (
              <Button label="Back this" icon="hand-heart" onPress={() => router.push({ pathname: '/back/[id]', params: { id: d.id } })} />
            ) : (
              <Button label="Share" icon="share-outline" variant="secondary" onPress={() => shareCampaign(d)} />
            )}
          </View>
        </Footer>
      </Animated.View>
    </View>
  );
}

function SaveButton({ d }: { d: Detail }) {
  const save = useToggle('save', d.id);
  return (
    <IconButton
      icon={d.isSaved ? 'bookmark' : 'bookmark-outline'}
      label={d.isSaved ? 'Remove from saved' : 'Save campaign'}
      tone="onImage"
      onPress={() => {
        save.mutate(!d.isSaved);
        toast(d.isSaved ? 'Removed from saved' : 'Saved to your profile');
      }}
    />
  );
}

function FundingCard({ d }: { d: Detail }) {
  const follow = useFollowCampaign();
  const backable = BACKABLE_STATUSES.includes(d.status);
  return (
    <Card style={{ gap: space.md }}>
      <Funding c={d} />
      <SupporterStack count={d.backerCount} names={d.publicBackers.map((b) => b.name)} cta={backable} />
      <ReachLine people={d.reachAtGoal} factor={d.reachFactor} />
      {d.status === 'FUNDED' && (
        <Banner tone="success" icon="checkmark-circle" body="Goal reached! You can still back it: extra funds show the message to even more people. Ads haven’t launched yet." />
      )}
      {d.status === 'DISTRIBUTION_PREP' && <Banner tone="info" icon="construct-outline" body="Funding closed. Targeting and budget are being finalised before ads launch." />}
      {d.status === 'PROMOTING' && <Banner tone="success" icon="radio-outline" body="Ads are running now. Delivery numbers update in the report." />}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {backable && <Button label="Back this" icon="megaphone-outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/back/[id]', params: { id: d.id } })} />}
        <Button
          label={d.isFollowing ? 'Following' : 'Follow'}
          icon={d.isFollowing ? 'checkmark' : 'notifications-outline'}
          variant="secondary"
          style={!backable && { flex: 1 }}
          onPress={() => {
            follow.mutate({ id: d.id, on: !d.isFollowing });
            toast(d.isFollowing ? 'Unfollowed' : 'Following. Updates will appear in Activity → Following.');
          }}
        />
      </View>
      {!!d.isDemo && (
        <T variant="small" color="textSubtle">
          Figures on sample campaigns are demonstration data.
        </T>
      )}
    </Card>
  );
}

function UseOfFunds({ d }: { d: Detail }) {
  const f = feeBreakdown(500);
  return (
    <Accordion
      title="How your contribution is used"
      icon="pie-chart-outline"
      summary={`${Math.round((1 - REACH_CONFIG.platformFeeRate) * 100)}% goes to advertising`}
      initiallyOpen={d.status === 'FUNDING'}>
      <Banner tone="accent" icon="information-circle-outline" body="This is not a donation to the cause. Your contribution pays to show this message to more people." />
      <T variant="smallStrong">For every ₹500 you contribute</T>
      <Line k="Advertising for this message" v={formatMoney(f.adBudget, true)} strong />
      <Line k={`Platform share (${Math.round(REACH_CONFIG.platformFeeRate * 100)}%) for review, ad setup and reporting`} v={formatMoney(f.platformFee, true)} />
      <Line k="Card processing, added at checkout" v={`+ ${formatMoney(f.processingFee, true)}`} />
      <T variant="smallStrong" style={{ marginTop: space.sm }}>
        Policies
      </T>
      <Bullet text="Funds are held by the platform and spent only on approved advertising. They are not transferred to the creator." />
      <Bullet text="If the campaign is cancelled or not approved for distribution, you get a full refund." />
      <Bullet text="If the goal isn’t reached, the team either runs a smaller campaign with what was raised or refunds backers. You’ll be notified either way." />
      <Bullet text="Unspent ad budget at the end of a campaign is refunded proportionally." />
      <Button
        label="Read the full funding policy"
        variant="ghost"
        size="sm"
        iconRight="arrow-forward"
        style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
        onPress={() => router.push('/info/terms')}
      />
    </Accordion>
  );
}

function Audience({ d }: { d: Detail }) {
  const { c } = useTheme();
  const r = d.reach;
  const total = Object.values(r.channels).reduce((a, b) => a + (b ?? 0), 0) || 1;
  return (
    <Accordion title="Audience & distribution" icon="locate-outline" summary={r.locations.join(', ')}>
      <Line k="Where" v={r.locations.join(', ') || 'Set during review'} />
      <Line k="Ages" v={`${r.ageRange[0]}–${r.ageRange[1]}`} />
      {r.interests.length > 0 && <Line k="Interests" v={r.interests.join(', ')} />}
      <Line k="Ad flight" v={`${r.durationDays} days after funding closes`} />
      <T variant="smallStrong" style={{ marginTop: space.sm }}>
        Channels
      </T>
      {CHANNELS.filter((ch) => r.channels[ch.key]).map((ch) => (
        <View key={ch.key} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="small">{ch.label}</T>
            <T variant="smallStrong">{Math.round(((r.channels[ch.key] ?? 0) / total) * 100)}%</T>
          </View>
          <View style={{ height: 4, backgroundColor: c.track, borderRadius: 2 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: c.primary, width: `${((r.channels[ch.key] ?? 0) / total) * 100}%` }} />
          </View>
        </View>
      ))}
      <T variant="small" color="textMuted">
        The creator chose these settings. Final targeting, bids and placements are set by the review team and partners, and may change to stay within advertising policies.
      </T>
      <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: c.surfaceAlt, gap: 4 }}>
        <T variant="smallStrong">Privacy & ad disclosure</T>
        <T variant="small" color="textMuted">
          Ads are labelled as sponsored and name the creator. We don’t target by health, religion, politics or other sensitive traits, and backers’ details are never shared with ad partners.
        </T>
      </View>
    </Accordion>
  );
}

const Line = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.lg }}>
    <T variant="small" color="textMuted" style={{ flex: 1 }}>
      {k}
    </T>
    <T variant={strong ? 'smallStrong' : 'small'} style={{ maxWidth: '55%', textAlign: 'right' }}>
      {v}
    </T>
  </View>
);

function Bullet({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.textMuted, marginTop: 8 }} />
      <T variant="small" style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

function FeedbackPrompt({ id }: { id: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const ask = async (question: 'VISUALS' | 'MIND_CHANGED', answer: string) => {
    haptic.light();
    setAnswers((a) => ({ ...a, [question]: answer }));
    api(`/campaigns/${id}/feedback`, { body: { question, answer }, auth: !!useSession.getState().token }).catch(() => {});
  };
  const done = answers.VISUALS && answers.MIND_CHANGED;
  return (
    <View style={{ paddingHorizontal: space.xl, paddingTop: space.xxl }}>
      <Card style={{ gap: space.lg }}>
        <View style={{ gap: 2 }}>
          <T variant="subheading">Quick feedback</T>
          <T variant="small" color="textMuted">
            Anonymous. Helps creators improve their message.
          </T>
        </View>
        <FeedbackQuestion label="Did the visuals make you want to keep reading?" value={answers.VISUALS} onAnswer={(a) => ask('VISUALS', a)} />
        <FeedbackQuestion label="Did this change your mind about the issue?" value={answers.MIND_CHANGED} onAnswer={(a) => ask('MIND_CHANGED', a)} />
        {!!done && (
          <T variant="small" color="success">
            Thanks, your feedback was recorded.
          </T>
        )}
      </Card>
    </View>
  );
}

function FeedbackQuestion({ label, value, onAnswer }: { label: string; value?: string; onAnswer: (a: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <T variant="bodyStrong">{label}</T>
      <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
        {['NO', 'SOMEWHAT', 'YES'].map((a) => {
          const sel = value === a;
          return (
            <Pressable
              key={a}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              onPress={() => onAnswer(a)}
              style={{
                flex: 1,
                height: 44,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: sel ? c.primary : c.border,
                backgroundColor: sel ? c.primarySoft : c.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <T variant="smallStrong" color={sel ? 'primary' : 'text'}>
                {a === 'NO' ? 'No' : a === 'SOMEWHAT' ? 'Somewhat' : 'Yes'}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DetailSkeleton() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Skeleton h={300} r={0} />
      <View style={{ padding: space.xl, gap: space.md }}>
        <Skeleton w={90} h={10} />
        <Skeleton h={30} />
        <Skeleton w="70%" h={30} />
        <Skeleton w="40%" h={14} />
        <Skeleton h={120} r={16} style={{ marginTop: space.lg }} />
      </View>
    </View>
  );
}
