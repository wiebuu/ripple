import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { REACH_CONFIG, estimateReach, feeBreakdown } from '@shared';
import { BackingHeader } from '@/components/BackingHeader';
import { Body, Header } from '@/components/Screen';
import { Banner, Button, Card, ErrorState, Icon, ProgressBar, T } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useBacking } from '@/lib/backing';
import { formatMoney, formatReach, pct } from '@/lib/format';
import { useCampaign } from '@/lib/queries';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import type { Contribution } from '@shared';

/** Step 2: review the amount, fees and policy, then create the pending contribution. */
export function ReviewStep({ id, onBack, onPaymentStarted }: { id: string; onBack: () => void; onPaymentStarted: (kid: string) => void }) {
  const { c } = useTheme();
  const q = useCampaign(id);
  const b = useBacking();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!q.data) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Review" onBack={onBack} />{q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}</View>;
  const d = q.data;
  const f = feeBreakdown(b.amount);
  const reach = estimateReach(b.amount, d.reachFactor);
  const after = d.raised + b.amount;

  const proceed = async () => {
    setBusy(true);
    setErr(null);
    try {
      const k = await api<Contribution>('/contributions', {
        body: { campaignId: id, amount: b.amount, showName: b.showName, displayName: b.showName ? b.displayName.trim() : undefined, receiptEmail: b.email || undefined },
      });
      onPaymentStarted(k.id);
    } catch (e) {
      setErr(errorMessage(e));
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Review contribution" onBack={onBack} />
      <Body footer={<Button label={`Continue to payment · ${formatMoney(f.total, true)}`} size="lg" disabled={!agreed} loading={busy} onPress={proceed} />}>
        <BackingHeader c={d} step={1} />

        <Card style={{ gap: space.md }}>
          <Line k="Your contribution" v={formatMoney(f.amount, true)} strong />
          <View style={{ paddingLeft: space.md, gap: space.sm, borderLeftWidth: 2, borderLeftColor: c.border }}>
            <Line k="Advertising for this message" v={formatMoney(f.adBudget, true)} small />
            <Line k={`Platform share (${Math.round(REACH_CONFIG.platformFeeRate * 100)}%): review, setup, reporting`} v={formatMoney(f.platformFee, true)} small />
          </View>
          <Line k="Payment processing (2%)" v={formatMoney(f.processingFee, true)} />
          <View style={{ marginTop: space.xs, padding: space.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.primary, backgroundColor: c.primarySoft, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T variant="overline" color="primary">
                Total charged
              </T>
              <T variant="small" color="textMuted">
                Paid in INR via Razorpay (test mode)
              </T>
            </View>
            <T variant="number" style={{ fontSize: 26, lineHeight: 30 }}>
              {formatMoney(f.total, true)}
            </T>
          </View>
        </Card>

        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name="people-outline" size={18} color={c.primary} />
            <T variant="bodyStrong">≈ {formatReach(reach)} people could see this message</T>
          </View>
          <T variant="small" color="textMuted">
            Estimated, not guaranteed. The final report shows measured delivery separately.
          </T>
          <View style={{ gap: 6, marginTop: space.sm }}>
            <T variant="small" color="textMuted">
              Funding after your contribution: {formatMoney(after)} of {formatMoney(d.goal)} ({pct(after, d.goal)}%)
            </T>
            <ProgressBar value={pct(after, d.goal)} />
          </View>
          <T variant="small" color="textMuted">
            Your name: {b.showName ? `shown as “${b.displayName.trim()}”` : 'private'}
          </T>
        </Card>

        <Banner
          tone="accent"
          icon="megaphone-outline"
          title="You’re paying for reach, not donating"
          body="This contribution funds advertising for the campaign’s message. It does not go to the cause, the creator, or any organisation named in the story."
        />

        <View style={{ gap: space.sm }}>
          <T variant="smallStrong">Refunds</T>
          <T variant="small" color="textMuted">
            Full refund if the campaign is cancelled or not approved for distribution. If the goal isn’t reached, the team runs a smaller campaign or refunds you. Unspent
            ad budget is refunded proportionally.
          </T>
          <Pressable accessibilityRole="link" onPress={() => router.push('/info/terms')} hitSlop={8}>
            <T variant="smallStrong" color="primary">
              Read the funding policy
            </T>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed(!agreed)}
          style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: agreed ? c.primary : c.border, backgroundColor: c.surface }}>
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: agreed ? c.primary : c.textSubtle, backgroundColor: agreed ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {agreed && <Icon name="checkmark" size={16} color={c.onPrimary} />}
          </View>
          <T style={{ flex: 1 }}>I understand this pays for distributing the message and agree to the funding and refund policy.</T>
        </Pressable>
        {err && <Banner tone="danger" icon="alert-circle" body={err} />}
      </Body>
    </View>
  );
}

function Line({ k, v, strong, small, big }: { k: string; v: string; strong?: boolean; small?: boolean; big?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, alignItems: 'baseline' }}>
      <T variant={small ? 'small' : strong ? 'bodyStrong' : 'body'} color={small ? 'textMuted' : 'text'} style={{ flex: 1 }}>
        {k}
      </T>
      <T variant={big ? 'subheading' : small ? 'smallStrong' : 'bodyStrong'}>{v}</T>
    </View>
  );
}
