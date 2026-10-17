import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CHANNELS, COMPLAINT_REASONS, STATUS_META, feeBreakdown, type CampaignStatus, type Complaint, type DraftContent } from '@shared';
import { Accordion } from '@/components/Accordion';
import { AdPreview } from '@/components/create/VisualsStep';
import { Field } from '@/components/Field';
import { Body, Header } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { StoryView } from '@/components/Story';
import { Banner, Button, Card, Divider, EmptyState, ErrorState, Icon, Pill, Skeleton, StatusPill, T, Toggle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatMoney, formatReach, relTime } from '@/lib/format';
import { invalidateCampaign, useReviewDetail } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { PullArea, usePullRefresh } from '@/hooks/usePullRefresh';

type Decision = 'approve' | 'request_changes' | 'reject';

export default function ReviewCampaign() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const q = useReviewDetail(id);
  const pull = usePullRefresh(q.refetch);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  if (user?.role !== 'REVIEWER')
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Review" />
        <EmptyState icon="lock-closed-outline" title="Reviewer access only" />
      </View>
    );
  if (q.isPending)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Review" />
        <Body>
          <Skeleton h={200} r={16} />
        </Body>
      </View>
    );
  if (q.isError || !q.data)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Review" />
        <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />
      </View>
    );

  const d = q.data;
  const content = d.content;
  const issues = Object.values(d.validationErrors);

  const run = async (key: string, path: string, body: object, msg: string) => {
    setBusy(key);
    try {
      // Paths starting with '/' are absolute API routes; others are relative to this campaign.
      await api(path.startsWith('/') ? path : `/review/campaigns/${id}/${path}`, { body });
      invalidateCampaign(id);
      await q.refetch();
      toast(msg);
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };
  const transition = (to: CampaignStatus, msg: string) => run(to, 'transition', { to }, msg);

  const decide = async () => {
    if (!decision) return;
    const ok = await run(decision, 'decision', { action: decision, note: note.trim() || undefined }, decision === 'approve' ? 'Approved and published' : decision === 'reject' ? 'Campaign declined' : 'Changes requested');
    if (ok) {
      setDecision(null);
      setNote('');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Review campaign" subtitle={STATUS_META[d.status].label} />
      {pull.indicator()}
      <PullArea pull={pull} scrollInside>
      <Body refreshControl={pull.control()} onScroll={pull.onScroll} scrollEventThrottle={16} scrollGesture={pull.scrollGesture}>
        <View style={{ gap: space.sm }}>
          <StatusPill status={d.status} />
          <T variant="title">{d.title || 'Untitled'}</T>
          <T variant="small" color="textMuted">
            {d.category} · by {d.creatorName} ({d.creatorType}) · goal {formatMoney(d.goal)}
          </T>
        </View>

        {issues.length > 0 ? (
          <Banner tone="warning" icon="alert-circle-outline" title={`${issues.length} automatic check${issues.length > 1 ? 's' : ''} failed`} body={issues.join('\n')} />
        ) : (
          <Banner tone="success" icon="checkmark-circle-outline" body="All required fields are complete. Check claims against sources and ads against policy before approving." />
        )}

        <Actions d={d} busy={busy} onDecide={setDecision} transition={transition} run={run} />

        {d.complaints.length > 0 && <Complaints items={d.complaints} busy={busy} run={run} />}

        {d.pendingContent && (
          <Card style={{ gap: space.md, borderColor: c.warning }}>
            <T variant="subheading">Pending revision from the creator</T>
            <T variant="small" color="textMuted">
              Compare with the live content below. Approving replaces the public page and ad content; the funding goal stays the same.
            </T>
            <Card padded={false} style={{ paddingHorizontal: space.md }}>
              <Accordion title="Revised story" last>
                <StoryView story={(d.pendingContent as DraftContent).story} />
              </Accordion>
            </Card>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="Decline edits" variant="secondary" style={{ flex: 1 }} loading={busy === 'rev-no'} onPress={() => run('rev-no', 'revision', { approve: false }, 'Revision declined')} />
              <Button label="Approve edits" style={{ flex: 1 }} loading={busy === 'rev-yes'} onPress={() => run('rev-yes', 'revision', { approve: true }, 'Revision published')} />
            </View>
          </Card>
        )}

        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <Accordion title="Story & sources" icon="document-text-outline" summary={`${content.story.sources.length} sources`} initiallyOpen>
            <StoryView story={{ ...content.story, headline: content.story.headline || content.basics.title }} />
          </Accordion>
          <Accordion title="Creative assets" icon="images-outline" summary={`${content.visuals.adImages.length} images${content.visuals.adVideo ? ' + video' : ''}`}>
            {!!(content.visuals.coverImage || content.basics.coverImage) && <Image source={content.visuals.coverImage || content.basics.coverImage} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md }} contentFit="cover" />}
            <ScrollView horizontal contentContainerStyle={{ gap: space.sm }}>
              {content.visuals.adImages.map((u, i) => (
                <Image key={i} source={u} style={{ width: 96, height: 96, borderRadius: radius.sm }} contentFit="cover" />
              ))}
            </ScrollView>
            <AdPreview d={content} placement="Feed" />
          </Accordion>
          <Accordion title="Targeting & budget" icon="locate-outline" summary={content.reach.locations.join(', ')}>
            <Line k="Locations" v={content.reach.locations.join(', ') || '—'} />
            <Line k="Ages" v={`${content.reach.ageRange[0]}–${content.reach.ageRange[1]}`} />
            <Line k="Interests" v={content.reach.interests.join(', ') || 'None'} />
            <Line k="Channels" v={CHANNELS.filter((ch) => content.reach.channels[ch.key]).map((ch) => `${ch.label} ${content.reach.channels[ch.key]}`).join(', ')} />
            <Line k="Ad flight" v={`${content.reach.durationDays} days`} />
            <Line k="Proposed ad budget at goal" v={formatMoney(feeBreakdown(d.goal).adBudget)} />
            <Line k="Raised so far" v={formatMoney(d.raised)} />
          </Accordion>
          <Accordion title="Audience feedback" icon="chatbubbles-outline" summary="Anonymous reader responses">
            <Tally label="Visuals encouraged reading" rows={d.feedback.visuals} />
            <Tally label="Changed their mind" rows={d.feedback.mindChanged} />
          </Accordion>
          {d.report && (
            <Accordion title="Delivery" icon="bar-chart-outline" summary={`${formatMoney(d.report.adSpend)} spent`}>
              <Line k="Spent" v={`${formatMoney(d.report.adSpend, true)} of ${formatMoney(d.report.adBudget, true)}`} />
              <Line k="Impressions" v={formatReach(d.report.impressions ?? 0)} />
              <Line k="Reach (measured)" v={formatReach(d.report.measuredReach ?? 0)} />
              <Line k="Clicks" v={formatReach(d.report.clicks ?? 0)} />
            </Accordion>
          )}
          <Accordion title="Audit history" icon="time-outline" summary={`${d.audit.length} records`} last>
            {d.audit.map((a) => (
              <View key={a.id} style={{ gap: 2, paddingBottom: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                  <Pill label={a.action.replace('_', ' ').toLowerCase()} tone="neutral" />
                  <T variant="small" color="textMuted">
                    {a.fromStatus ? `${STATUS_META[a.fromStatus].label} → ` : ''}
                    {STATUS_META[a.toStatus].label}
                  </T>
                </View>
                <T variant="small" color="textSubtle">
                  {a.actorName ?? 'System'} · {relTime(a.createdAt)}
                </T>
                {!!a.note && <T variant="small">{a.note}</T>}
              </View>
            ))}
          </Accordion>
        </Card>
      </Body>
      </PullArea>

      <Sheet
        visible={!!decision}
        onClose={() => setDecision(null)}
        title={decision === 'approve' ? 'Approve and publish' : decision === 'reject' ? 'Decline campaign' : 'Request changes'}
        footer={
          <Button
            label={decision === 'approve' ? 'Approve and open for backing' : decision === 'reject' ? 'Decline' : 'Send to creator'}
            variant={decision === 'reject' ? 'danger' : 'primary'}
            size="lg"
            loading={!!busy}
            disabled={decision !== 'approve' && !note.trim()}
            onPress={decide}
          />
        }>
        <T color="textMuted">
          {decision === 'approve'
            ? 'The campaign is published and opens for backing for 30 days. Ads do not launch until funding closes and distribution is authorised.'
            : decision === 'reject'
              ? 'The creator will see your reason. Declined campaigns cannot be resubmitted.'
              : 'Tell the creator exactly what to fix. They can edit and resubmit.'}
        </T>
        <Field label={decision === 'approve' ? 'Note for the audit log' : 'Note to the creator'} required={decision !== 'approve'} value={note} onChangeText={setNote} multiline max={1000} softMax placeholder={decision === 'request_changes' ? 'e.g. Source 2 link is broken; the 90% figure isn’t supported by the cited source.' : ''} />
      </Sheet>
    </View>
  );
}

type ActionsProps = {
  d: NonNullable<ReturnType<typeof useReviewDetail>['data']>;
  busy: string | null;
  onDecide: (d: Decision) => void;
  transition: (to: CampaignStatus, msg: string) => Promise<boolean>;
  run: (key: string, path: string, body: object, msg: string) => Promise<boolean>;
};

/** Only the actions valid for the current lifecycle state are offered. */
function Actions({ d, busy, onDecide, transition, run }: ActionsProps) {
  const { c } = useTheme();
  switch (d.status) {
    case 'SUBMITTED':
      return (
        <Card style={{ gap: space.sm }}>
          <T variant="subheading">Decision</T>
          <Button label="Approve" icon="checkmark-circle-outline" onPress={() => onDecide('approve')} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Ask for edits" variant="secondary" style={{ flex: 1 }} onPress={() => onDecide('request_changes')} />
            <Button label="Decline" variant="danger" style={{ flex: 1 }} onPress={() => onDecide('reject')} />
          </View>
        </Card>
      );
    case 'FUNDING':
      return (
        <Card style={{ gap: space.sm }}>
          <T variant="subheading">Funding is open</T>
          <T variant="small" color="textMuted">
            The campaign moves to “Goal reached” automatically. For demos you can end the funding period early.
          </T>
          <Button label="End funding period now" variant="secondary" loading={busy === 'FUNDING_ENDED'} onPress={() => transition('FUNDING_ENDED', 'Funding period ended')} />
        </Card>
      );
    case 'FUNDED':
    case 'FUNDING_ENDED':
      return (
        <Card style={{ gap: space.sm }}>
          <T variant="subheading">{d.status === 'FUNDED' ? 'Goal reached' : 'Ended below goal'}</T>
          <T variant="small" color="textMuted">
            Reaching the goal does not launch ads. Start distribution preparation to finalise targeting and budget{d.status === 'FUNDING_ENDED' ? ', or refund backers' : ''}.
          </T>
          <Button label="Start distribution preparation" loading={busy === 'DISTRIBUTION_PREP'} onPress={() => transition('DISTRIBUTION_PREP', 'Distribution preparation started')} />
          <Button label="Refund backers instead" variant="danger" size="sm" loading={busy === 'REFUND_PENDING'} onPress={() => transition('REFUND_PENDING', 'Refunds started')} />
        </Card>
      );
    case 'DISTRIBUTION_PREP':
      return (
        <Card style={{ gap: space.md }}>
          <T variant="subheading">Authorise distribution</T>
          <T variant="small" color="textMuted">
            Both checks must be complete before ads can launch.
          </T>
          <Check label="Budget approved" sub={`${formatMoney(feeBreakdown(d.raised).adBudget)} across the selected channels`} value={d.budgetApproved} onChange={(v) => run('ready', 'readiness', { budgetApproved: v }, v ? 'Budget approved' : 'Budget approval removed')} />
          <Divider />
          <Check label="Ads set up with partners" sub="Creative approved, targeting configured" value={d.adSetupReady} onChange={(v) => run('ready', 'readiness', { adSetupReady: v }, v ? 'Ad setup confirmed' : 'Ad setup unchecked')} />
          <Button label="Launch promotion" icon="rocket-outline" disabled={!d.budgetApproved || !d.adSetupReady} loading={busy === 'PROMOTING'} onPress={() => transition('PROMOTING', 'Promotion started')} />
        </Card>
      );
    case 'PROMOTING':
      return (
        <Card style={{ gap: space.sm }}>
          <T variant="subheading">Promoting</T>
          <Button label="Simulate a day of delivery" variant="secondary" icon="play-forward-outline" loading={busy === 'sim'} onPress={() => run('sim', 'simulate-delivery', {}, 'Delivery data updated')} />
          <Button label="Complete campaign & publish final report" loading={busy === 'COMPLETED'} onPress={() => transition('COMPLETED', 'Campaign completed')} />
        </Card>
      );
    default:
      return (
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Icon name="information-circle-outline" size={18} color={c.textMuted} />
          <T variant="small" color="textMuted" style={{ flex: 1 }}>
            {STATUS_META[d.status].description} No reviewer action needed.
          </T>
        </View>
      );
  }
}

function Complaints({ items, busy, run }: { items: Complaint[]; busy: string | null; run: ActionsProps['run'] }) {
  const { c } = useTheme();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const open = items.filter((k) => k.status === 'OPEN');
  return (
    <Card style={{ gap: space.md, borderColor: open.length ? c.danger : c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name="flag-outline" size={18} color={open.length ? c.danger : c.textMuted} />
        <T variant="subheading" style={{ flex: 1 }}>
          Audience reports
        </T>
        <Pill label={`${open.length} open`} tone={open.length ? 'danger' : 'neutral'} />
      </View>
      {items.map((k) => {
        const label = COMPLAINT_REASONS.find((r) => r.key === k.reason)?.label ?? k.reason;
        return (
          <View key={k.id} style={{ gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <T variant="bodyStrong" style={{ flex: 1 }}>
                {label}
              </T>
              <T variant="small" color="textSubtle">
                {relTime(k.createdAt)}
              </T>
            </View>
            {!!k.details && <T variant="small">“{k.details}”</T>}
            {k.status === 'OPEN' ? (
              <>
                <Field label="Decision note" required value={notes[k.id] ?? ''} onChangeText={(t) => setNotes((n) => ({ ...n, [k.id]: t }))} placeholder="What you checked and decided" />
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button label="Dismiss" variant="secondary" size="sm" style={{ flex: 1 }} disabled={(notes[k.id] ?? '').trim().length < 3} loading={busy === `c-${k.id}-dismiss`} onPress={() => run(`c-${k.id}-dismiss`, `/review/complaints/${k.id}`, { action: 'dismiss', note: notes[k.id] }, 'Report dismissed')} />
                  <Button label="Action taken" size="sm" style={{ flex: 1 }} disabled={(notes[k.id] ?? '').trim().length < 3} loading={busy === `c-${k.id}-resolve`} onPress={() => run(`c-${k.id}-resolve`, `/review/complaints/${k.id}`, { action: 'resolve', note: notes[k.id] }, 'Report resolved')} />
                </View>
                <T variant="small" color="textMuted">
                  To pause distribution, use the lifecycle actions above (cancel or refund). Every decision is added to the audit history.
                </T>
              </>
            ) : (
              <T variant="small" color="textMuted">
                {k.status === 'RESOLVED' ? 'Action taken' : 'Dismissed'}: {k.resolution}
              </T>
            )}
          </View>
        );
      })}
    </Card>
  );
}

function Check({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">{label}</T>
        <T variant="small" color="textMuted">
          {sub}
        </T>
      </View>
      <Toggle value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

function Tally({ label, rows }: { label: string; rows: { answer: string; count: number }[] }) {
  const { c } = useTheme();
  const total = rows.reduce((a, b) => a + b.count, 0) || 1;
  return (
    <View style={{ gap: 6 }}>
      <T variant="smallStrong">{label}</T>
      {rows.map((r) => (
        <View key={r.answer} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T variant="small" style={{ width: 72 }}>
            {r.answer === 'NO' ? 'No' : r.answer === 'SOMEWHAT' ? 'Somewhat' : 'Yes'}
          </T>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.track }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.primary, width: `${(r.count / total) * 100}%` }} />
          </View>
          <T variant="small" color="textMuted" style={{ width: 24, textAlign: 'right' }}>
            {r.count}
          </T>
        </View>
      ))}
    </View>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.lg }}>
      <T variant="small" color="textMuted">
        {k}
      </T>
      <T variant="small" style={{ flex: 1, textAlign: 'right' }}>
        {v}
      </T>
    </View>
  );
}
