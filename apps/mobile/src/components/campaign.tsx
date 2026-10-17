import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BACKABLE_STATUSES, REACH_CONFIG, STATUS_META, feeBreakdown, peoplePerHundred, type CampaignSummary } from '@shared';
import { formatMoney, formatReach, pct, relTime, timeLeft } from '@/lib/format';
import { useFollowCampaign } from '@/lib/queries';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { Sheet } from './Sheet';
import { BRAND } from './brand/Logo';
import { Button, Icon, Pill, ProgressBar, Skeleton, StatusPill, T, haptic } from './ui';

/** Explains what "estimated reach" means. Used wherever a reach number appears. */
export function ReachInfo({ visible, onClose, factor = 1 }: { visible: boolean; onClose: () => void; factor?: number }) {
  const f = feeBreakdown(1000);
  return (
    <Sheet visible={visible} onClose={onClose} title="How reach is estimated">
      <T>
        Reach is an <T variant="bodyStrong">estimate</T>, not a guarantee. It is how many people outside the creator’s network we expect could see the message, based on demo assumptions about
        advertising prices.
      </T>
      <View style={{ gap: space.sm }}>
        <Row k="Platform share for review, setup and reporting" v={`${Math.round(REACH_CONFIG.platformFeeRate * 100)}%`} />
        <Row k="Spent on advertising from every ₹1,000" v={formatMoney(f.adBudget)} />
        <Row k="Assumed people per ₹100 of ads (blended)" v={`≈ ${Math.round(REACH_CONFIG.peoplePerAdRupee * 100 * factor)}`} />
        <Row k="So ₹100 contributed reaches about" v={`${peoplePerHundred(factor)} people`} />
      </View>
      <T variant="small" color="textMuted">
        Actual reach depends on ad inventory, prices, targeting, delivery and how people respond. After a campaign runs, the report shows measured delivery separately from this estimate.
      </T>
    </Sheet>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: space.md,
      }}>
      <T variant="small" color="textMuted" style={{ flex: 1 }}>
        {k}
      </T>
      <T variant="smallStrong">{v}</T>
    </View>
  );
}

/** "≈ 216K people at goal (est.)" with an info affordance. */
export function ReachLine({ people, label = 'people reached at goal', factor }: { people: number; label?: string; factor?: number }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`About ${formatReach(people)} ${label}, estimated. Learn how this is estimated.`}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <T variant="small" color="textMuted">
          <T variant="smallStrong">≈ {formatReach(people)}</T> {label}
        </T>
        <T variant="small" color="textSubtle">
          (est.)
        </T>
        <Icon name="information-circle-outline" size={15} color={c.textSubtle} />
      </Pressable>
      <ReachInfo visible={open} onClose={() => setOpen(false)} factor={factor} />
    </>
  );
}

export function Funding({ c: campaign, compact }: { c: CampaignSummary; compact?: boolean }) {
  const p = pct(campaign.raised, campaign.goal);
  const left = BACKABLE_STATUSES.includes(campaign.status) ? timeLeft(campaign.endsAt) : null;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T variant={compact ? 'bodyStrong' : 'subheading'}>{formatMoney(campaign.raised)}</T>
        <T variant="small" color="textMuted" style={{ flex: 1 }}>
          of {formatMoney(campaign.goal)}
        </T>
        <T variant="smallStrong" color={p >= 100 ? 'success' : 'text'}>
          {p}%
        </T>
      </View>
      <ProgressBar value={p} tone={p >= 100 ? 'success' : 'primary'} />
      {!compact && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="small" color="textMuted">
            {campaign.backerCount.toLocaleString('en-US')} backers
          </T>
          {!!left && <Countdown endsAt={campaign.endsAt} />}
        </View>
      )}
    </View>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Live "ends in" timer that ticks every second until the campaign closes. */
export function Countdown({ endsAt }: { endsAt: string | null }) {
  const { c } = useTheme();
  const [now, setNow] = useState(Date.now);
  const ms = endsAt ? new Date(endsAt).getTime() - now : 0;
  const live = ms > 0;
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);
  if (!endsAt) return null;
  if (ms <= 0) {
    return (
      <T variant="small" color="textMuted">
        Ended
      </T>
    );
  }
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const text = `${d ? `${d}d ` : ''}${pad(Math.floor((s % 86400) / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m ${pad(s % 60)}s`;
  const urgent = ms < 864e5;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel={`Ends in ${timeLeft(endsAt)?.replace(' left', '')}`}>
      <Icon name="time-outline" size={13} color={urgent ? c.warning : c.textMuted} />
      <T variant="small" color="textMuted">
        Ends in{' '}
        <T variant="smallStrong" style={{ color: urgent ? c.warning : c.text, fontVariant: ['tabular-nums'] }}>
          {text}
        </T>
      </T>
    </View>
  );
}

const open = (c: CampaignSummary) => router.push({ pathname: '/campaign/[id]', params: { id: c.id } });

/** Primary feed card: image, category, title, creator, summary, funding, reach, one clear action. */
export function CampaignCard({ c: campaign, width }: { c: CampaignSummary; width?: number }) {
  const { c } = useTheme();
  const backable = BACKABLE_STATUSES.includes(campaign.status);
  return (
    <View
      style={{
        width,
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${campaign.title}, by ${campaign.creatorName}. ${pct(campaign.raised, campaign.goal)} percent funded.`}
        onPress={() => open(campaign)}
        style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}>
        <Image
          source={campaign.coverImage}
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            backgroundColor: c.skeleton,
          }}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
        />
        <View style={{ padding: space.lg, paddingBottom: space.md, gap: space.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              flexWrap: 'wrap',
            }}>
            <T variant="overline" color="primary">
              {campaign.category}
            </T>
            {!backable && <StatusPill status={campaign.status} />}
          </View>
          <View style={{ gap: 4 }}>
            <T variant="heading" numberOfLines={2}>
              {campaign.title}
            </T>
            <T variant="small" color="textMuted">
              by {campaign.creatorName}
            </T>
          </View>
          <T color="textMuted" numberOfLines={2}>
            {campaign.summary}
          </T>
          <Funding c={campaign} />
        </View>
      </Pressable>
      <View
        style={{
          paddingHorizontal: space.lg,
          paddingBottom: space.lg,
          gap: space.md,
        }}>
        <ReachLine people={campaign.reachAtGoal} factor={campaign.reachFactor} />
        {backable ? (
          <Button
            label="Back this campaign"
            onPress={() =>
              router.push({
                pathname: '/back/[id]',
                params: { id: campaign.id },
              })
            }
          />
        ) : campaign.status === 'COMPLETED' ? (
          <Button
            label="See the results"
            variant="secondary"
            icon="bar-chart-outline"
            onPress={() =>
              router.push({
                pathname: '/campaign/[id]/report',
                params: { id: campaign.id },
              })
            }
          />
        ) : (
          <FollowButton c={campaign} />
        )}
      </View>
    </View>
  );
}

/** Follows a campaign so its milestones and delivery updates appear in Activity → Following. */
export function FollowButton({ c: campaign }: { c: CampaignSummary }) {
  const follow = useFollowCampaign();
  const on = !!campaign.isFollowing;
  return (
    <Button
      label={on ? 'Following progress' : 'Follow progress'}
      icon={on ? 'checkmark-circle' : 'notifications-outline'}
      variant={on ? 'quiet' : 'secondary'}
      onPress={() => {
        follow.mutate({ id: campaign.id, on: !on });
        toast(on ? 'Unfollowed' : 'Following. Updates will appear in Activity → Following.');
      }}
    />
  );
}

/** Overlapping initials of public supporters plus a count. Names are only shown if backers opted in. */
export function SupporterStack({ count, names = [], cta = true }: { count: number; names?: string[]; cta?: boolean }) {
  const { c } = useTheme();
  const shown = Math.min(4, Math.max(count, names.length));
  const initials = Array.from({ length: shown }, (_, i) =>
    names[i]
      ? names[i]
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : '',
  );
  if (!count) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }} accessibilityLabel={`${count} supporters`}>
      <View style={{ flexDirection: 'row' }}>
        {initials.map((t, i) => (
          <View
            key={i}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              marginLeft: i ? -8 : 0,
              backgroundColor: i === 0 ? c.primarySoft : c.surfaceAlt,
              borderWidth: 2,
              borderColor: c.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {t ? (
              <T variant="small" style={{ fontSize: 10, fontWeight: '700' }} color={i === 0 ? 'primary' : 'textMuted'}>
                {t}
              </T>
            ) : (
              <Icon name="person-outline" size={12} color={c.textSubtle} />
            )}
          </View>
        ))}
      </View>
      <T variant="small" color="textMuted" style={{ flex: 1 }}>
        {cta ? 'Join ' : ''}
        <T variant="smallStrong">{count.toLocaleString('en-IN')}</T> supporter
        {count === 1 ? '' : 's'}
      </T>
    </View>
  );
}

/** Compact row for lists (Explore results, profile lists). */
export function CampaignRow({ c: campaign, right, onPress, meta }: { c: CampaignSummary; right?: React.ReactNode; onPress?: () => void; meta?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={campaign.title || 'Untitled draft'}
      onPress={onPress ?? (() => open(campaign))}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: space.md,
        padding: space.md,
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        opacity: pressed ? 0.9 : 1,
      })}>
      {campaign.coverImage ? (
        <Image
          source={campaign.coverImage}
          style={{
            width: 84,
            height: 84,
            borderRadius: radius.md,
            backgroundColor: c.skeleton,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: radius.md,
            backgroundColor: c.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="image-outline" size={24} color={c.textSubtle} />
        </View>
      )}
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T variant="overline" color="primary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {campaign.category || 'No category'}
          </T>
          {campaign.status !== 'FUNDING' && <StatusPill status={campaign.status} />}
        </View>
        <T variant="bodyStrong" numberOfLines={2}>
          {campaign.title || 'Untitled draft'}
        </T>
        {meta ? (
          <T variant="small" color="textMuted">
            {meta}
          </T>
        ) : campaign.goal > 0 ? (
          <Funding c={campaign} compact />
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function CardSkeleton() {
  const { c } = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
      }}>
      <Skeleton h={190} r={0} />
      <View style={{ padding: space.lg, gap: space.md }}>
        <Skeleton w={80} h={10} />
        <Skeleton h={22} />
        <Skeleton w="60%" h={14} />
        <Skeleton h={6} />
        <Skeleton h={48} r={12} />
      </View>
    </View>
  );
}

export function RowSkeleton() {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space.md,
        padding: space.md,
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
      }}>
      <Skeleton w={84} h={84} r={12} />
      <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
        <Skeleton w={70} h={10} />
        <Skeleton h={16} />
        <Skeleton w="50%" h={12} />
      </View>
    </View>
  );
}

/** Thin progress line used on the compact tiles. */
function Line({ value, track, fill }: { value: number; track: string; fill: string }) {
  return (
    <View
      style={{
        height: 4,
        borderRadius: 2,
        backgroundColor: track,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${Math.max(3, value)}%`,
          height: 4,
          borderRadius: 2,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}

/** Small label on top of a photo (category, stage). */
function PhotoTag({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        height: 22,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(11,11,12,0.62)',
      }}>
      <T
        variant="small"
        style={{
          fontSize: 10.5,
          lineHeight: 13,
          color: '#F4F2EE',
          fontWeight: '600',
        }}>
        {label}
      </T>
    </View>
  );
}

/**
 * Compact grid tile for Explore: photo with the category on it, a two-line
 * title, creator, a thin progress line and the amount raised.
 */
export function CampaignTile({ c: campaign, width }: { c: CampaignSummary; width: number }) {
  const { c } = useTheme();
  const p = pct(campaign.raised, campaign.goal);
  const backable = BACKABLE_STATUSES.includes(campaign.status);
  const left = backable ? timeLeft(campaign.endsAt) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${campaign.title}, by ${campaign.creatorName}. ${p} percent funded.`}
      onPress={() => open(campaign)}
      style={({ pressed }) => ({
        width,
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View>
        <Image
          source={campaign.coverImage}
          style={{
            width: '100%',
            aspectRatio: 4 / 3,
            backgroundColor: c.skeleton,
          }}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
        />
        <View
          style={{
            position: 'absolute',
            left: 8,
            top: 8,
            right: 8,
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 4,
          }}>
          <PhotoTag label={campaign.category} />
          {!backable && <PhotoTag label={STATUS_META[campaign.status].label} />}
        </View>
      </View>
      <View style={{ padding: space.sm + 2, gap: 6 }}>
        <T variant="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 19, minHeight: 38 }}>
          {campaign.title}
        </T>
        <T variant="small" color="textMuted" numberOfLines={1} style={{ fontSize: 12, marginTop: -2 }}>
          {campaign.creatorName}
        </T>
        <Line value={p} track={c.track} fill={p >= 100 ? c.success : c.primary} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 4,
          }}>
          <T variant="smallStrong" numberOfLines={1} style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}>
            {formatMoney(campaign.raised)}
          </T>
          <T variant="smallStrong" style={{ color: p >= 100 ? c.success : c.primary }}>
            {p}%
          </T>
        </View>
        {!!left && (
          <T variant="small" color="textSubtle" style={{ fontSize: 11, marginTop: -4 }}>
            {left}
          </T>
        )}
      </View>
    </Pressable>
  );
}

/** Wide photo card for the Explore spotlight row: title and progress sit on the image. */
export function SpotlightCard({ c: campaign, width, height = 190 }: { c: CampaignSummary; width: number; height?: number }) {
  const p = pct(campaign.raised, campaign.goal);
  const left = BACKABLE_STATUSES.includes(campaign.status) ? timeLeft(campaign.endsAt) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Featured: ${campaign.title}. ${p} percent funded.`}
      onPress={() => open(campaign)}
      style={({ pressed }) => ({
        width,
        height,
        borderRadius: radius.xl,
        overflow: 'hidden',
        backgroundColor: BRAND.ink,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <Image source={campaign.coverImage} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(11,11,12,0.05)', 'rgba(11,11,12,0.35)', 'rgba(11,11,12,0.92)']} locations={[0, 0.4, 1]} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
      <View style={{ position: 'absolute', left: 12, top: 12 }}>
        <PhotoTag label="Featured" />
      </View>
      <View
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          gap: 6,
        }}>
        <T variant="overline" style={{ color: BRAND.accent, fontSize: 10 }}>
          {campaign.category}
        </T>
        <T variant="heading" numberOfLines={2} style={{ color: '#F4F2EE', fontSize: 17, lineHeight: 21 }}>
          {campaign.title}
        </T>
        <Line value={p} track="rgba(244,242,238,0.22)" fill={BRAND.accent} />
        <T variant="small" style={{ color: 'rgba(244,242,238,0.75)', fontSize: 12 }}>
          {p}% funded{left ? ` · ${left}` : ''}
        </T>
      </View>
    </Pressable>
  );
}

/**
 * Compact horizontal card for the Home feed: photo on the left; category,
 * title, creator, a thin progress line and the amount on the right.
 */
export function FeedCard({ c: campaign }: { c: CampaignSummary }) {
  const { c } = useTheme();
  const p = pct(campaign.raised, campaign.goal);
  const backable = BACKABLE_STATUSES.includes(campaign.status);
  const left = backable ? timeLeft(campaign.endsAt) : STATUS_META[campaign.status].label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${campaign.title}, by ${campaign.creatorName}. ${p} percent funded.`}
      onPress={() => open(campaign)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: space.md,
        padding: space.sm + 2,
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}>
      <Image
        source={campaign.coverImage}
        style={{
          width: 96,
          height: 108,
          borderRadius: radius.md,
          backgroundColor: c.skeleton,
        }}
        contentFit="cover"
        transition={200}
        accessibilityIgnoresInvertColors
      />
      <View style={{ flex: 1, gap: 5, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T variant="overline" color="primary" numberOfLines={1} style={{ fontSize: 10, flexShrink: 1 }}>
            {campaign.category}
          </T>
          {!!left && (
            <T variant="small" color="textSubtle" numberOfLines={1} style={{ fontSize: 11, marginLeft: 'auto' }}>
              {left}
            </T>
          )}
        </View>
        <T variant="bodyStrong" numberOfLines={2} style={{ fontSize: 15, lineHeight: 20 }}>
          {campaign.title}
        </T>
        <T variant="small" color="textMuted" numberOfLines={1} style={{ fontSize: 12 }}>
          by {campaign.creatorName}
        </T>
        <Line value={p} track={c.track} fill={p >= 100 ? c.success : c.primary} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <T variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>
            {formatMoney(campaign.raised)}
          </T>
          <T variant="small" color="textMuted" numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>
            of {formatMoney(campaign.goal)}
          </T>
          <T variant="smallStrong" style={{ color: p >= 100 ? c.success : c.primary }}>
            {p}%
          </T>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Feed post (Home and Explore): no card box. Creator row with a follow icon,
 * an edge-to-edge photo with funding (amount, %, progress line) on a dark fade
 * at its foot and a back icon beside it, then the title and a short summary.
 * Posts are separated by a hairline, like a social feed.
 */
export function PostCard({ c: campaign }: { c: CampaignSummary }) {
  const { c } = useTheme();
  const follow = useFollowCampaign();
  const p = pct(campaign.raised, campaign.goal);
  const backable = BACKABLE_STATUSES.includes(campaign.status);
  const completed = campaign.status === 'COMPLETED';
  const left = backable ? timeLeft(campaign.endsAt) : null;
  const following = !!campaign.isFollowing;
  const initials = campaign.creatorName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const when = campaign.publishedAt ? relTime(campaign.publishedAt) : null;
  const onImage = '#F4F2EE';
  return (
    <View style={{ paddingVertical: space.lg, gap: space.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm + 2,
          paddingHorizontal: space.xl,
        }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: c.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <T variant="smallStrong" color="primary">
            {initials}
          </T>
        </View>
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19 }}>
            {campaign.creatorName}
          </T>
          <T variant="small" color="textMuted" numberOfLines={1} style={{ fontSize: 12 }}>
            {campaign.category}
            {when ? ` · ${when}` : ''}
            {!backable ? ` · ${STATUS_META[campaign.status].label}` : ''}
          </T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={following ? 'Following progress. Tap to unfollow' : 'Follow progress'}
          accessibilityState={{ selected: following }}
          hitSlop={10}
          onPress={() => {
            haptic.light();
            follow.mutate({ id: campaign.id, on: !following });
            toast(following ? 'Unfollowed' : 'Following. Updates will appear in Activity → Following.');
          }}>
          <Icon name={following ? 'notifications' : 'notifications-outline'} size={22} color={following ? c.primary : c.text} />
        </Pressable>
      </View>

      {/* Photo and action are siblings (not nested buttons); taps on the funding text fall through to the photo. */}
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${campaign.title}, by ${campaign.creatorName}. ${p} percent funded.`}
          onPress={() => open(campaign)}
          style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}>
          <Image
            source={campaign.coverImage}
            style={{
              width: '100%',
              aspectRatio: 4 / 3,
              backgroundColor: c.skeleton,
            }}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={['rgba(11,11,12,0)', 'rgba(11,11,12,0.55)', 'rgba(11,11,12,0.85)']}
            locations={[0, 0.55, 1]}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 120,
            }}
          />
        </Pressable>
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: space.xl,
            right: space.lg,
            bottom: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.lg,
          }}>
          <View pointerEvents="none" style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <T variant="bodyStrong" style={{ color: onImage, fontVariant: ['tabular-nums'] }}>
                {formatMoney(campaign.raised)}
              </T>
              <T variant="small" numberOfLines={1} style={{ flex: 1, color: 'rgba(244,242,238,0.75)' }}>
                raised of {formatMoney(campaign.goal)}
              </T>
              <T variant="smallStrong" style={{ color: p >= 100 ? '#9FE3C2' : BRAND.accent }}>
                {p}%
              </T>
            </View>
            <Line value={p} track="rgba(244,242,238,0.25)" fill={BRAND.accent} />
          </View>
          {(backable || completed) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backable ? 'Back this campaign' : 'See the results'}
              hitSlop={12}
              onPress={() =>
                backable
                  ? router.push({
                      pathname: '/back/[id]',
                      params: { id: campaign.id },
                    })
                  : router.push({
                      pathname: '/campaign/[id]/report',
                      params: { id: campaign.id },
                    })
              }>
              <Icon name={backable ? 'hand-heart' : 'bar-chart-outline'} size={28} color={backable ? BRAND.accent : onImage} />
            </Pressable>
          )}
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${campaign.title}`} onPress={() => open(campaign)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        <View style={{ paddingHorizontal: space.xl, gap: 4 }}>
          <T variant="heading" numberOfLines={2} style={{ fontSize: 18, lineHeight: 23 }}>
            {campaign.title}
          </T>
          <T color="textMuted" numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>
            {campaign.summary}
          </T>
          <T variant="small" color="textSubtle" style={{ fontSize: 12, marginTop: 2 }}>
            {campaign.backerCount.toLocaleString('en-IN')} backers
            {left ? ` · ${left}` : ''} · ≈ {formatReach(campaign.reachAtGoal)} reach at goal
          </T>
        </View>
      </Pressable>
    </View>
  );
}

/** Hairline between feed posts. */
export function PostDivider() {
  const { c } = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: c.border,
        marginHorizontal: space.xl,
      }}
    />
  );
}

export function PostSkeleton() {
  return (
    <View style={{ paddingVertical: space.lg, gap: space.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.xl,
        }}>
        <Skeleton w={36} h={36} r={18} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton w="40%" h={12} />
          <Skeleton w="25%" h={10} />
        </View>
      </View>
      <Skeleton h={260} r={0} />
      <View style={{ paddingHorizontal: space.xl, gap: 8 }}>
        <Skeleton h={4} />
        <Skeleton w="80%" h={18} />
        <Skeleton h={12} />
      </View>
    </View>
  );
}

export function TileSkeleton({ width }: { width: number }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width,
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
      }}>
      <Skeleton h={(width * 3) / 4} r={0} />
      <View style={{ padding: space.sm + 2, gap: 8 }}>
        <Skeleton h={14} />
        <Skeleton w="60%" h={10} />
        <Skeleton h={4} />
      </View>
    </View>
  );
}

export { Pill };
