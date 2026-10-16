import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { BACKABLE_STATUSES, REACH_CONFIG, feeBreakdown, peoplePerDollar, type CampaignSummary } from '@shared';
import { formatMoney, formatReach, pct, timeLeft } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';
import { Sheet } from './Sheet';
import { Button, Icon, Pill, ProgressBar, Skeleton, StatusPill, T } from './ui';

/** Explains what "estimated reach" means. Used wherever a reach number appears. */
export function ReachInfo({ visible, onClose, factor = 1 }: { visible: boolean; onClose: () => void; factor?: number }) {
  const f = feeBreakdown(100);
  return (
    <Sheet visible={visible} onClose={onClose} title="How reach is estimated">
      <T>
        Reach is an <T variant="bodyStrong">estimate</T>, not a guarantee. It is how many people outside the creator’s network we expect could see the message, based on demo
        assumptions about advertising prices.
      </T>
      <View style={{ gap: space.sm }}>
        <Row k="Platform share for review, setup and reporting" v={`${Math.round(REACH_CONFIG.platformFeeRate * 100)}%`} />
        <Row k="Spent on advertising from every $100" v={formatMoney(f.adBudget, true)} />
        <Row k="Assumed people per ad dollar (blended)" v={`≈ ${Math.round(REACH_CONFIG.peoplePerAdDollar * factor)}`} />
        <Row k="So $1 contributed reaches about" v={`${peoplePerDollar(factor)} people`} />
      </View>
      <T variant="small" color="textMuted">
        Actual reach depends on ad inventory, prices, targeting, delivery and how people respond. After a campaign runs, the report shows measured delivery
        separately from this estimate.
      </T>
    </Sheet>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
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
        <Icon name="people-outline" size={15} color={c.primary} />
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
  const left = campaign.status === 'FUNDING' ? timeLeft(campaign.endsAt) : null;
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
          {left && (
            <T variant="small" color="textMuted">
              {left}
            </T>
          )}
        </View>
      )}
    </View>
  );
}

const open = (c: CampaignSummary) => router.push({ pathname: '/campaign/[id]', params: { id: c.id } });

/** Primary feed card: image, category, title, creator, summary, funding, reach, one clear action. */
export function CampaignCard({ c: campaign, width }: { c: CampaignSummary; width?: number }) {
  const { c } = useTheme();
  const backable = BACKABLE_STATUSES.includes(campaign.status);
  return (
    <View style={{ width, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${campaign.title}, by ${campaign.creatorName}. ${pct(campaign.raised, campaign.goal)} percent funded.`}
        onPress={() => open(campaign)}
        style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}>
        <Image source={campaign.coverImage} style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: c.skeleton }} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
        <View style={{ padding: space.lg, paddingBottom: space.md, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
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
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md }}>
        <ReachLine people={campaign.reachAtGoal} factor={campaign.reachFactor} />
        {backable ? (
          <Button label="Back this campaign" onPress={() => router.push({ pathname: '/back/[id]', params: { id: campaign.id } })} />
        ) : (
          <Button label={campaign.status === 'COMPLETED' ? 'See the results' : 'Follow progress'} variant="secondary" onPress={() => open(campaign)} />
        )}
      </View>
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
      style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, padding: space.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.9 : 1 })}>
      {campaign.coverImage ? (
        <Image source={campaign.coverImage} style={{ width: 84, height: 84, borderRadius: radius.md, backgroundColor: c.skeleton }} contentFit="cover" />
      ) : (
        <View style={{ width: 84, height: 84, borderRadius: radius.md, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
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
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
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
    <View style={{ flexDirection: 'row', gap: space.md, padding: space.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border }}>
      <Skeleton w={84} h={84} r={12} />
      <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
        <Skeleton w={70} h={10} />
        <Skeleton h={16} />
        <Skeleton w="50%" h={12} />
      </View>
    </View>
  );
}

export { Pill };
