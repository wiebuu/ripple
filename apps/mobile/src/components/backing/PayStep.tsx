import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { BackingHeader } from '@/components/BackingHeader';
import { RazorpayTestGuide, defaultMethod, type TestMethod, type TestOutcome } from '@/components/RazorpayTestGuide';
import { Body, Header } from '@/components/Screen';
import { Banner, Button, Card, Icon, Pill, Skeleton, T } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { type PayResult } from '@/lib/backing';
import { useCampaign, useConfig } from '@/lib/queries';
import { space, useTheme } from '@/theme';

/** Step 3: Razorpay Checkout in test mode. No real money moves. */
export function PayStep({ id, kid, onBack, onCheckout, onDone }: { id: string; kid: string; onBack: () => void; onCheckout: (outcome: TestOutcome, method: TestMethod) => void; onDone: (r: PayResult) => void }) {
  const { c } = useTheme();
  const q = useCampaign(id);
  const config = useConfig();
  const razorpay = config.data?.payments.provider === 'razorpay-test';
  const [outcome, setOutcome] = useState<TestOutcome>('success');
  const [cancelling, setCancelling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pending = useQuery({ queryKey: ['contribution', kid], queryFn: () => api<PayResult>(`/contributions/${kid}`), enabled: !!kid });
  const total = pending.data?.contribution.total ?? null;
  const [methodChoice, setMethod] = useState<TestMethod | null>(null);
  const method = methodChoice ?? defaultMethod(total);

  const cancel = async () => {
    setCancelling(true);
    try {
      onDone(await api<PayResult>(`/contributions/${kid}/cancel`, { body: {} }));
    } catch (e) {
      setErr(errorMessage(e));
      setCancelling(false);
    }
  };

  const openRazorpay = () => onCheckout(outcome, method);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Payment" onBack={onBack} />
      <Body
        footer={
          <>
            <Button label={total != null ? `Pay ${formatMoney(total, true)} with Razorpay` : 'Pay with Razorpay'} icon="lock-closed" size="lg" disabled={!razorpay || cancelling} onPress={openRazorpay} />
            <Button label="Cancel payment" variant="ghost" size="sm" disabled={cancelling} loading={cancelling} onPress={cancel} />
          </>
        }>
        <BackingHeader c={q.data} step={2} />
        {config.isPending ? (
          <Skeleton h={220} r={16} />
        ) : !razorpay ? (
          <Banner tone="danger" icon="alert-circle-outline" title="Payments are unavailable" body="Razorpay test mode isn’t configured on the server. Add rzp_test_ keys to the API and try again." />
        ) : (
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Icon name="shield-checkmark-outline" size={20} color={c.primary} />
              <T variant="subheading" style={{ flex: 1 }}>
                Pay with Razorpay
              </T>
              <Pill label="Test mode" tone="warning" />
            </View>
            <T variant="small" color="textMuted">
              Cards, UPI and netbanking in Razorpay’s test environment. No real money moves.
            </T>
            <RazorpayTestGuide outcome={outcome} onChange={setOutcome} method={method} onMethodChange={setMethod} amount={total} />
          </Card>
        )}
        {!!err && <Banner tone="danger" icon="alert-circle" title="Something went wrong" body={err} />}
        <T variant="small" color="textSubtle" center>
          Payments are processed by Razorpay. Ripple never sees or stores your card or UPI details.
        </T>
      </Body>
    </View>
  );
}
