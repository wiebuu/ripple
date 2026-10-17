import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { CHANNELS, PLATFORMS } from '@shared';
import { AreaChart, BarList } from '@/components/charts';
import { PLATFORM_LOGOS } from '@/lib/platforms';
import { Accordion } from '@/components/Accordion';
import { Body, Header } from '@/components/Screen';
import { Banner, Card, DemoBadge, Divider, EmptyState, ErrorState, Icon, Pill, Skeleton, Stat, T } from '@/components/ui';
import { formatMoney, formatReach, shortDate } from '@/lib/format';
import { useReport } from '@/lib/queries';
import { space, useTheme } from '@/theme';
import { PullArea, usePullRefresh } from '@/hooks/usePullRefresh';

/** Distribution report. Money, measured delivery and the original estimate are kept visibly separate. */
export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const q = useReport(id);
  const pull = usePullRefresh(q.refetch);

  if (q.isPending)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Report" />
        <Body>
          <Skeleton h={120} r={16} />
          <Skeleton h={200} r={16} />
        </Body>
      </View>
    );
  if (q.isError || !q.data)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Report" />
        <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />
      </View>
    );

  const { campaign: cp, report: r, isOwner } = q.data;
  if (!r)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Report" />
        <EmptyState icon="bar-chart-outline" title="No delivery yet" body="The report fills in once ads launch. Funding has to close and the ads must be approved first." />
      </View>
    );

  const unspent = Math.max(0, r.adBudget - r.adSpend);
  const ctr = r.impressions ? ((r.clicks ?? 0) / r.impressions) * 100 : 0;
  const spentPct = r.adBudget ? Math.round((r.adSpend / r.adBudget) * 100) : 0;
  const maxSpend = Math.max(1, ...r.byChannel.map((x) => x.spend));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={r.final ? 'Final report' : 'Distribution report'} subtitle={cp.title} />
      {pull.indicator()}
      <PullArea pull={pull} scrollInside>
      <Body refreshControl={pull.control()} onScroll={pull.onScroll} scrollEventThrottle={16} scrollGesture={pull.scrollGesture}>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Pill label={r.final ? 'Final' : 'In progress'} tone={r.final ? 'success' : 'info'} />
          {cp.isDemo && <DemoBadge />}
          <Pill label={`${r.startedAt ? shortDate(r.startedAt) : '—'} → ${r.endedAt ? shortDate(r.endedAt) : 'ongoing'}`} tone="neutral" />
        </View>

        {isOwner ? (
          <Card style={{ gap: space.md }}>
            <T variant="overline" color="textMuted">
              Money
            </T>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="raised from backers" value={formatMoney(r.fundsRaised)} />
              <Stat label="ad budget" value={formatMoney(r.adBudget)} />
            </View>
            <Divider />
            <Line k="Platform share (review, setup, reporting)" v={formatMoney(r.platformFees, true)} />
            <Line k={`Spent on ads (${spentPct}% of budget)`} v={formatMoney(r.adSpend, true)} strong />
            <Line k={r.final ? 'Unspent, refunded to backers' : 'Not yet spent'} v={formatMoney(unspent, true)} />
          </Card>
        ) : (
          // Backers and visitors get the headline only; the fee breakdown is for the creator.
          <Card style={{ gap: space.md }}>
            <T variant="overline" color="textMuted">
              Backing
            </T>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="raised from backers" value={formatMoney(r.fundsRaised)} />
              <Stat label="spent on ads so far" value={formatMoney(r.adSpend)} />
            </View>
          </Card>
        )}

        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T variant="overline" color="textMuted" style={{ flex: 1 }}>
              Measured delivery
            </T>
            <Pill label="Simulated partner data" tone="success" />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="impressions" value={formatReach(r.impressions ?? 0)} hint="times the ad was shown" />
            <Stat label="people reached" value={formatReach(r.measuredReach ?? 0)} hint="unique people" />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="clicks" value={formatReach(r.clicks ?? 0)} hint="taps through to the story" />
            <Stat label="click-through rate" value={`${ctr.toFixed(1)}%`} hint="clicks ÷ impressions" />
          </View>
        </Card>

        {r.daily.length > 1 && (
          <Card style={{ gap: space.md }}>
            <T variant="overline" color="textMuted">
              Impressions per day
            </T>
            <AreaChart data={r.daily.map((d) => ({ day: d.day, value: d.impressions }))} unit="impressions" />
            <T variant="small" color="textMuted">
              Drag along the chart to see each day.
            </T>
          </Card>
        )}

        {r.byPlatform.length > 0 && (
          <Card style={{ gap: space.md }}>
            <T variant="overline" color="textMuted">
              By app
            </T>
            <BarList
              rows={r.byPlatform.map((p) => {
                const [logo, brand] = PLATFORM_LOGOS[p.platform];
                return {
                  key: p.platform,
                  label: PLATFORMS.find((x) => x.key === p.platform)?.label ?? p.platform,
                  leading: <Icon name={logo} size={18} color={brand ?? c.text} />,
                  value: p.impressions,
                  sub: `${formatReach(p.clicks)} clicks`,
                };
              })}
            />
          </Card>
        )}

        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T variant="overline" color="textMuted" style={{ flex: 1 }}>
              Original estimate
            </T>
            <Pill label="Estimate" tone="accent" />
          </View>
          <Stat label="people estimated before launch" value={`≈ ${formatReach(r.estimatedReach)}`} />
          <T variant="small" color="textMuted">
            {r.measuredReach != null && r.final
              ? `Measured reach was ${r.measuredReach >= r.estimatedReach ? 'above' : 'below'} the estimate. Estimates use average ad prices; actual delivery depends on inventory, targeting and how people responded.`
              : 'Shown for comparison only. It is never mixed into measured numbers.'}
          </T>
        </Card>

        {r.byChannel.length > 0 && (
          <Card style={{ gap: space.md }}>
            <T variant="overline" color="textMuted">
              By channel
            </T>
            {r.byChannel.map((ch) => (
              <View key={ch.channel} style={{ gap: 4 }}>
                {/* Name and spend on one line, the delivery figures on their own line, so nothing has to wrap. */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                  <T variant="smallStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {CHANNELS.find((x) => x.key === ch.channel)?.label ?? ch.channel}
                  </T>
                  <T variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>
                    {isOwner ? formatMoney(ch.spend) : `${formatReach(ch.impressions)} impr.`}
                  </T>
                </View>
                <T variant="small" color="textMuted" style={{ fontSize: 12 }}>
                  {isOwner ? `${formatReach(ch.impressions)} impressions · ` : ''}
                  {formatReach(ch.clicks)} clicks
                </T>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: c.track }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: c.primary, width: `${(ch.spend / maxSpend) * 100}%` }} />
                </View>
              </View>
            ))}
          </Card>
        )}

        {!r.final && <Banner tone="info" icon="time-outline" body="Ads are still running. Numbers update as partners report delivery." />}

        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <Accordion title="What these numbers mean" icon="help-circle-outline" last>
            <Term k="Impressions" v="Each time the ad appeared on a screen." />
            <Term k="People reached" v="Unique people who saw it at least once." />
            <Term k="Clicks" v="Taps from the ad through to the campaign story." />
            <Term k="Estimate" v="Our prediction before launch, from average ad prices. Shown for comparison only, never mixed into measured numbers." />
          </Accordion>
        </Card>
      </Body>
      </PullArea>
    </View>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.lg }}>
      <T variant="small" color="textMuted" style={{ flex: 1 }}>
        {k}
      </T>
      <T variant={strong ? 'smallStrong' : 'small'} style={{ flexShrink: 1, textAlign: 'right' }}>
        {v}
      </T>
    </View>
  );
}

/** A glossary entry: the term in bold with its meaning underneath, both left-aligned. */
function Term({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T variant="smallStrong">{k}</T>
      <T variant="small" color="textMuted">
        {v}
      </T>
    </View>
  );
}
