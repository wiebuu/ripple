import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PUBLIC_STATUSES, STATUS_META, TIMELINE, estimateReach, feeBreakdown, timelineIndex } from '@shared';
import { Accordion } from '@/components/Accordion';
import { Field } from '@/components/Field';
import { Body, Header } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Banner, Button, Card, Divider, ErrorState, Icon, IconButton, Pill, ProgressBar, Skeleton, Stat, StatusPill, T, type IconName } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { openEditor } from '@/lib/create';
import { canCancel, canDelete, cancelCampaign, cancelLabel, confirmDestructive, deleteDraft } from '@/lib/campaignActions';
import { formatMoney, formatReach, pct, relTime, shortDate } from '@/lib/format';
import { Countdown } from '@/components/campaign';
import { useCampaign, type Detail } from '@/lib/queries';
import { useBackOrPush } from '@/lib/nav';
import { shareCampaign } from '@/lib/share';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { PullArea, usePullRefresh } from '@/hooks/usePullRefresh';

export default function Manage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const q = useCampaign(id);
  const pull = usePullRefresh(q.refetch);
  const [menu, setMenu] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const goTo = useBackOrPush();

  if (q.isPending)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Manage campaign" />
        <Body>
          <Skeleton h={80} r={16} />
          <Skeleton h={160} r={16} />
          <Skeleton h={220} r={16} />
        </Body>
      </View>
    );
  if (q.isError || !q.data)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Manage campaign" />
        <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />
      </View>
    );

  const d = q.data;
  const isPublic = PUBLIC_STATUSES.includes(d.status);
  // Editing lives in the header (pencil); destructive actions live behind the ⋯ menu.
  const editable = d.status === 'DRAFT' || d.status === 'CHANGES_REQUESTED' || (d.status === 'FUNDING' && !d.hasPendingRevision);
  const hasMenu = isPublic || canDelete(d.status) || canCancel(d.status);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header
        title="Manage campaign"
        right={
          <View style={{ flexDirection: 'row' }}>
            {editable && <IconButton icon="create-outline" label="Edit campaign" onPress={() => openEditor(d.id, d.status === 'FUNDING' ? 1 : undefined)} />}
            {isPublic && <IconButton icon="share-outline" label="Share campaign" onPress={() => shareCampaign(d)} />}
            {hasMenu && <IconButton icon="ellipsis-horizontal" label="More actions" onPress={() => setMenu(true)} />}
          </View>
        }
      />
      {pull.indicator()}
      <PullArea pull={pull} scrollInside>
      <Body refreshControl={pull.control()} onScroll={pull.onScroll} scrollEventThrottle={16} scrollGesture={pull.scrollGesture}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          {d.coverImage ? (
            <Image source={d.coverImage} style={{ width: 72, height: 72, borderRadius: radius.md }} contentFit="cover" />
          ) : (
            <View style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="image-outline" size={24} color={c.textSubtle} />
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <StatusPill status={d.status} />
            <T variant="subheading" numberOfLines={2}>
              {d.title || 'Untitled draft'}
            </T>
            <T variant="small" color="textMuted">
              {d.publishedAt ? `Published ${shortDate(d.publishedAt)}` : d.submittedAt ? `Submitted ${shortDate(d.submittedAt)}` : `Created ${shortDate(d.createdAt)}`}
            </T>
          </View>
        </View>

        <NextStep d={d} />
        <Timeline d={d} />
        {isPublic && <Analytics d={d} />}
        {isPublic && <Updates d={d} onPosted={() => q.refetch()} />}

        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <Accordion title="Review history" icon="time-outline" summary={`${d.reviewNotes.length} events`} last>
            {d.reviewNotes.length === 0 && <T color="textMuted">No review activity yet.</T>}
            {[...d.reviewNotes].reverse().map((n) => (
              <View key={n.id} style={{ gap: 2, paddingBottom: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <StatusPill status={n.toStatus} />
                  <T variant="small" color="textSubtle">
                    {relTime(n.createdAt)}
                    {n.reviewerName ? ` · ${n.reviewerName}` : ''}
                  </T>
                </View>
                {!!n.note && <T variant="small">{n.note}</T>}
              </View>
            ))}
          </Accordion>
        </Card>
      </Body>
      </PullArea>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Campaign actions">
        <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
          {isPublic && (
            <MenuRow first icon="open-outline" label="View public page" onPress={() => { setMenu(false); goTo('campaign/[id]/index', { pathname: '/campaign/[id]', params: { id: d.id } }, d.id); }} />
          )}
          {canDelete(d.status) && (
            <MenuRow
              first={!isPublic}
              danger
              icon="trash-outline"
              label="Delete draft"
              onPress={() => {
                setMenu(false);
                confirmDestructive('Delete this draft?', 'This can’t be undone.', 'Delete', async () => {
                  if (await deleteDraft(d.id)) router.back();
                });
              }}
            />
          )}
          {canCancel(d.status) && (
            <MenuRow first={!isPublic} danger icon="close-circle-outline" label={cancelLabel(d.status)} onPress={() => { setMenu(false); setCancelOpen(true); }} />
          )}
        </View>
      </Sheet>
      <CancelSheet d={d} open={cancelOpen} onClose={() => setCancelOpen(false)} />
    </View>
  );
}

/** A row in the ⋯ menu; destructive actions are red. */
function MenuRow({ icon, label, onPress, danger, first }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; first?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, height: 52, paddingHorizontal: space.lg, borderTopWidth: first ? 0 : 1, borderTopColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
      <Icon name={icon} size={19} color={danger ? c.danger : c.text} />
      <T variant="bodyStrong" style={{ color: danger ? c.danger : c.text }}>
        {label}
      </T>
    </Pressable>
  );
}

function NextStep({ d }: { d: Detail }) {
  const { c } = useTheme();
  const goTo = useBackOrPush();
  const note = [...d.reviewNotes].reverse().find((n) => n.action === 'CHANGES_REQUESTED' || n.action === 'REJECTED')?.note;

  const view = <Button label="View public page" variant="secondary" icon="open-outline" onPress={() => goTo('campaign/[id]/index', { pathname: '/campaign/[id]', params: { id: d.id } }, d.id)} />;

  switch (d.status) {
    case 'DRAFT':
      return (
        <Card style={{ gap: space.md }}>
          <T variant="subheading">Finish your draft</T>
          <T color="textMuted">Complete all five steps and submit it for review. Your progress is saved automatically. Tap the pencil above to keep editing.</T>
        </Card>
      );
    case 'SUBMITTED':
      return (
        <View style={{ gap: space.md }}>
          <Banner tone="info" icon="hourglass-outline" title="In review" body="We’re checking your sources, visuals and targeting. Editing is paused until we respond, usually within 1–2 business days." />
        </View>
      );
    case 'CHANGES_REQUESTED':
      return (
        <Card style={{ gap: space.md, borderColor: c.warning }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name="chatbubble-ellipses-outline" size={20} color={c.warning} />
            <T variant="subheading">The reviewer asked for changes</T>
          </View>
          {!!note && <T style={{ fontStyle: 'italic' }}>“{note}”</T>}
          <T variant="small" color="textMuted">
            Tap the pencil above to make the changes and resubmit.
          </T>
        </Card>
      );
    case 'REJECTED':
      return (
        <Card style={{ gap: space.md, borderColor: c.danger }}>
          <T variant="subheading">This campaign wasn’t approved</T>
          {!!note && <T color="textMuted">Reason: {note}</T>}
          <Button label="Read the community guidelines" variant="secondary" onPress={() => router.push('/info/guidelines')} />
        </Card>
      );
    case 'FUNDING':
      return (
        <Card style={{ gap: space.md }}>
          <T variant="subheading">Open for backing</T>
          <T color="textMuted">Share your campaign with people who already support you; their backing pays to reach people who don’t know about it yet.</T>
          <Button label="Share campaign" icon="share-outline" onPress={() => shareCampaign(d)} />
          {d.hasPendingRevision && <Banner tone="info" icon="time-outline" body="Your edits are waiting for review. The live page hasn’t changed." />}
          {view}
        </Card>
      );
    case 'FUNDED':
    case 'FUNDING_ENDED':
    case 'DISTRIBUTION_PREP':
      return <Banner tone="success" icon="construct-outline" title={STATUS_META[d.status].label} body="Funding is closed. The team is finalising targeting and budget with distribution partners before ads launch. You’ll be notified when promotion starts." />;
    case 'PROMOTING':
    case 'COMPLETED':
      return (
        <Card style={{ gap: space.md }}>
          <T variant="subheading">{d.status === 'COMPLETED' ? 'Distribution finished' : 'Your message is being promoted'}</T>
          <Button label={d.status === 'COMPLETED' ? 'Open final report' : 'Open distribution report'} icon="bar-chart-outline" onPress={() => router.push({ pathname: '/campaign/[id]/report', params: { id: d.id } })} />
          {view}
        </Card>
      );
    default:
      return <Banner tone="neutral" icon="information-circle-outline" body={STATUS_META[d.status].description} />;
  }
}

/** Confirm sheet for cancelling (or withdrawing) a campaign, with an optional reason. Raised funds are refunded. */
function CancelSheet({ d, open, onClose }: { d: Detail; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const label = cancelLabel(d.status);
  const cancel = async () => {
    setBusy(true);
    if (await cancelCampaign(d.id, d.raised, reason)) onClose();
    setBusy(false);
  };
  return (
    <Sheet
      visible={open}
      onClose={onClose}
      title={`${label}?`}
      footer={
        <View style={{ gap: space.sm }}>
          <Button label={label} variant="danger" size="lg" loading={busy} onPress={cancel} />
          <Button label="Keep campaign" variant="ghost" size="sm" onPress={onClose} />
        </View>
      }>
      <T>
        {d.raised > 0
          ? `${formatMoney(d.raised)} from ${d.backerCount} backers will be refunded in full, and the campaign will close. This can’t be undone.`
          : 'The campaign will close and won’t be published or advertised. This can’t be undone.'}
      </T>
      <Field label="Reason" value={reason} onChangeText={setReason} max={500} softMax multiline placeholder="Optional. Shared with backers and the review team." />
    </Sheet>
  );
}

function Timeline({ d }: { d: Detail }) {
  const { c } = useTheme();
  const at = timelineIndex(d.status);
  const off = ['REJECTED', 'CANCELLED', 'REFUND_PENDING', 'FAILED'].includes(d.status);
  return (
    <Card padded={false} style={{ paddingHorizontal: space.lg }}>
      <Accordion title="Campaign progress" icon="git-commit-outline" summary={STATUS_META[d.status].label} initiallyOpen last>
        {off && <Banner tone="danger" icon="alert-circle-outline" body={STATUS_META[d.status].description} />}
        {TIMELINE.map((t, i) => {
          const done = i < at || (i === at && d.status === 'COMPLETED');
          const current = i === at && d.status !== 'COMPLETED';
          return (
            <View key={t.status} style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? c.primary : current ? c.primarySoft : c.surface, borderWidth: 2, borderColor: done || current ? c.primary : c.border, alignItems: 'center', justifyContent: 'center' }}>
                  {done && <Icon name="checkmark" size={13} color={c.onPrimary} />}
                </View>
                {i < TIMELINE.length - 1 && <View style={{ width: 2, flex: 1, minHeight: 14, backgroundColor: done ? c.primary : c.border }} />}
              </View>
              <View style={{ flex: 1, paddingBottom: space.md }}>
                <T variant={current ? 'bodyStrong' : 'body'} color={done || current ? 'text' : 'textSubtle'}>
                  {t.title}
                </T>
                {current && (
                  <T variant="small" color="textMuted">
                    {t.body}
                  </T>
                )}
              </View>
            </View>
          );
        })}
      </Accordion>
    </Card>
  );
}

function Analytics({ d }: { d: Detail }) {
  const f = feeBreakdown(d.raised);
  const r = d.report;
  const p = pct(d.raised, d.goal);
  return (
    <View style={{ gap: space.md }}>
      <T variant="heading">Analytics</T>
      <Card style={{ gap: space.md }}>
        <T variant="overline" color="textMuted">
          Funding
        </T>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="raised" value={formatMoney(d.raised)} />
          <Stat label="goal" value={formatMoney(d.goal)} />
          <Stat label="backers" value={d.backerCount.toLocaleString('en-US')} />
        </View>
        <ProgressBar value={p} tone={p >= 100 ? 'success' : 'primary'} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="small" color="textMuted">
            {p}% funded
          </T>
          {d.status === 'FUNDING' ? (
            <Countdown endsAt={d.endsAt} />
          ) : (
            <T variant="small" color="textMuted">
              Funding closed
            </T>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {[25, 50, 75, 100].map((m) => (
            <Pill key={m} label={`${m}%`} tone={p >= m ? 'success' : 'neutral'} />
          ))}
        </View>
      </Card>

      {!!d.backerActivity && <BackerActivityCard a={d.backerActivity} />}

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T variant="overline" color="textMuted" style={{ flex: 1 }}>
            Estimates
          </T>
          <Pill label="Estimated" tone="accent" />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="reach at goal" value={`≈ ${formatReach(d.reachAtGoal)}`} />
          <Stat label="reach for funds raised" value={`≈ ${formatReach(estimateReach(d.raised, d.reachFactor))}`} />
        </View>
        <T variant="small" color="textMuted">
          Based on demo ad-price assumptions. Not a guarantee.
        </T>
      </Card>

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T variant="overline" color="textMuted" style={{ flex: 1 }}>
            Delivery
          </T>
          <Pill label={r ? 'Measured (simulated)' : 'Not started'} tone={r ? 'success' : 'neutral'} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="ad budget" value={formatMoney(f.adBudget)} />
          <Stat label="spent" value={r ? formatMoney(r.adSpend) : '—'} />
        </View>
        <Divider />
        <View style={{ flexDirection: 'row' }}>
          <Stat label="impressions" value={r?.impressions != null ? formatReach(r.impressions) : '—'} />
          <Stat label="people reached" value={r?.measuredReach != null ? formatReach(r.measuredReach) : '—'} />
          <Stat label="clicks" value={r?.clicks != null ? formatReach(r.clicks) : '—'} />
        </View>
        <T variant="small" color="textMuted">
          {r ? `Ads run ${d.reach.durationDays} days${r.startedAt ? `, started ${shortDate(r.startedAt)}` : ''}.` : `Delivery numbers appear when ads launch. Planned flight: ${d.reach.durationDays} days.`}
        </T>
        {!!r && <Button label="Open full report" variant="secondary" size="sm" iconRight="arrow-forward" onPress={() => router.push({ pathname: '/campaign/[id]/report', params: { id: d.id } })} />}
      </Card>
      <T variant="small" color="textSubtle">
        Platform share ({formatMoney(f.platformFee)}) covers review, ad setup and reporting.
      </T>
    </View>
  );
}

/** Contributions over the last 14 days and the latest backers (names only when they opted in). */
function BackerActivityCard({ a }: { a: NonNullable<Detail['backerActivity']> }) {
  const { c } = useTheme();
  const max = Math.max(1, ...a.daily.map((x) => x.amount));
  const total = a.daily.reduce((s, x) => s + x.amount, 0);
  const count = a.daily.reduce((s, x) => s + x.count, 0);
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <T variant="overline" color="textMuted" style={{ flex: 1 }}>
          Backer activity · 14 days
        </T>
        <T variant="small" color="textMuted">
          {formatMoney(total)} from {count} contribution{count === 1 ? '' : 's'}
        </T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 3 }} accessibilityLabel={`Contributions in the last 14 days: ${formatMoney(total)}`}>
        {a.daily.map((x) => (
          <View key={x.day} style={{ flex: 1, height: Math.max(3, (x.amount / max) * 72), borderRadius: 3, backgroundColor: x.amount ? c.primary : c.track }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="small" color="textSubtle">
          {shortDate(a.daily[0]?.day ?? null)}
        </T>
        <T variant="small" color="textSubtle">
          Today
        </T>
      </View>
      {a.recent.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Divider />
          {a.recent.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Icon name="person-circle-outline" size={18} color={c.textSubtle} />
              <T variant="small" style={{ flex: 1 }}>
                {r.name}
              </T>
              <T variant="smallStrong">{formatMoney(r.amount, true)}</T>
              <T variant="small" color="textSubtle" style={{ width: 56, textAlign: 'right' }}>
                {relTime(r.at)}
              </T>
            </View>
          ))}
          <T variant="small" color="textMuted">
            Backer names are private unless they chose to show them.
          </T>
        </View>
      ) : (
        <T variant="small" color="textMuted">
          No contributions recorded in the app yet. Sample totals above come from demo data.
        </T>
      )}
    </Card>
  );
}

function Updates({ d, onPosted }: { d: Detail; onPosted: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const post = async () => {
    setBusy(true);
    try {
      await api(`/campaigns/${d.id}/updates`, { body: { title, body } });
      toast('Update posted. Backers and followers will be notified.');
      setTitle('');
      setBody('');
      setOpen(false);
      onPosted();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T variant="heading" style={{ flex: 1 }}>
          Updates
        </T>
        {!open && <Button label="Post update" icon="add" size="sm" variant="secondary" onPress={() => setOpen(true)} />}
      </View>
      {open && (
        <Card style={{ gap: space.md }}>
          <Field label="Title" required value={title} onChangeText={setTitle} max={80} placeholder="e.g. Council vote scheduled" />
          <Field label="Update" required value={body} onChangeText={setBody} max={2000} softMax multiline placeholder="What’s new? Backers and followers will be notified." />
          <T variant="small" color="textMuted">
            Updates appear on your campaign page. They don’t change the approved ad content.
          </T>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setOpen(false)} />
            <Button label="Post" style={{ flex: 1 }} loading={busy} disabled={title.trim().length < 3 || body.trim().length < 10} onPress={post} />
          </View>
        </Card>
      )}
      {d.updates.length === 0 && !open && <T color="textMuted">No updates yet. Post one when something changes. It keeps backers engaged.</T>}
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
  );
}
