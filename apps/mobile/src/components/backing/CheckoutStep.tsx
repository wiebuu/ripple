import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Header } from '@/components/Screen';
import { CopyValue, TEST_CARD, TEST_OTP, TEST_UPI, type TestMethod, type TestOutcome } from '@/components/RazorpayTestGuide';
import { Banner, Button, EmptyState, T } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { space, useTheme } from '@/theme';
import type { PayResult } from '@/lib/backing';
import { RippleLoader } from '@/components/brand/RippleMark';

type Order = { keyId: string; orderId: string; amount: number; currency: string; campaignTitle: string; receiptEmail: string | null };

/** Razorpay Standard Checkout inside a WebView. Results are verified by the server, never trusted from here. */
function checkoutOptions(o: Order, color: string) {
  return {
    key: o.keyId,
    order_id: o.orderId,
    amount: o.amount,
    currency: o.currency,
    name: 'Ripple',
    description: `Distribution of “${o.campaignTitle}” (test mode)`,
    prefill: o.receiptEmail ? { email: o.receiptEmail } : {},
    theme: { color },
    notes: { purpose: 'Message distribution, not a donation' },
  };
}

function checkoutHtml(o: Order, color: string) {
  const opts = checkoutOptions(o, color);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#fff;font-family:-apple-system,system-ui;display:flex;align-items:center;justify-content:center;height:100vh;color:#555">
<p>Opening Razorpay test checkout…</p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  const send = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
  try {
    const o = ${JSON.stringify(opts)};
    o.handler = (r) => send({ type: 'success', ...r });
    o.modal = { ondismiss: () => send({ type: 'dismissed' }), confirm_close: true };
    const rzp = new Razorpay(o);
    rzp.on('payment.failed', (r) => send({ type: 'failed', reason: (r.error && r.error.description) || 'Payment failed' }));
    rzp.open();
  } catch (e) { send({ type: 'error', reason: String(e) }); }
</script></body></html>`;
}

/** Step 4: Razorpay Checkout (WebView on phones, the page itself on web). */
export function CheckoutStep({ kid, outcome, method, onBack, onDone }: { kid: string; outcome: TestOutcome; method: TestMethod; onBack: () => void; onDone: (r: PayResult) => void }) {
  const testMethod: TestMethod = method === 'card' ? 'card' : 'upi';
  const testOutcome: TestOutcome = outcome === 'failure' ? 'failure' : 'success';
  const { c } = useTheme();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    api<Order>(`/contributions/${kid}/razorpay/order`, { body: {} })
      .then(setOrder)
      .catch((e) => setError(errorMessage(e)));
  }, [kid]);

  const finish = onDone;

  const handle = async (m: any) => {
    try {
      if (m.type === 'success') {
        setVerifying(true);
        finish(await api<PayResult>(`/contributions/${kid}/razorpay/verify`, { body: { razorpay_order_id: m.razorpay_order_id, razorpay_payment_id: m.razorpay_payment_id, razorpay_signature: m.razorpay_signature } }));
      } else if (m.type === 'failed') {
        finish(await api<PayResult>(`/contributions/${kid}/razorpay/failed`, { body: { reason: m.reason } }));
      } else if (m.type === 'dismissed') {
        finish(await api<PayResult>(`/contributions/${kid}/cancel`, { body: {} }));
      } else {
        setError(m.reason ?? 'Checkout could not open');
      }
    } catch (err) {
      setVerifying(false);
      setError(errorMessage(err));
    }
  };

  const onMessage = (e: WebViewMessageEvent) => handle(JSON.parse(e.nativeEvent.data));

  // Web (and the browser preview) has no WebView: open Razorpay Checkout on the page itself.
  useEffect(() => {
    if (Platform.OS !== 'web' || !order) return;
    const w = window as any;
    const open = () => {
      const rzp = new w.Razorpay({
        ...checkoutOptions(order, c.primary),
        handler: (r: object) => handle({ type: 'success', ...r }),
        modal: { ondismiss: () => handle({ type: 'dismissed' }), confirm_close: true },
      });
      rzp.on('payment.failed', (r: any) => handle({ type: 'failed', reason: r?.error?.description ?? 'Payment failed' }));
      rzp.open();
    };
    if (w.Razorpay) return open();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = open;
    script.onerror = () => setError('Couldn’t load Razorpay Checkout. Check your connection.');
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Razorpay (test mode)" onBack={onBack} />
      <View style={{ paddingHorizontal: space.xl, paddingBottom: space.md }}>
        <Banner
          tone="warning"
          icon="flask-outline"
          title={`Test mode · testing a ${testOutcome === 'success' ? 'successful' : 'failed'} payment`}
          body={testMethod === 'upi' ? 'No real money moves. Choose UPI and paste:' : `No real money moves. Choose Card, use expiry ${TEST_CARD.expiry} and CVV ${TEST_CARD.cvv}, then OTP ${TEST_OTP[testOutcome]}.`}
          action={
            <View style={{ marginTop: 4, flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {testMethod === 'upi' ? (
                <CopyValue value={TEST_UPI[testOutcome]} label="test UPI ID" />
              ) : (
                <>
                  <CopyValue value={TEST_CARD.number} label="test card number" copy={TEST_CARD.number.replace(/\s/g, '')} />
                  <CopyValue value={TEST_OTP[testOutcome]} label="test OTP" />
                </>
              )}
            </View>
          }
        />
      </View>
      {error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn’t start Razorpay checkout" body={error} action={<Button label="Go back and try again" variant="secondary" onPress={onBack} />} />
      ) : !order || verifying ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
          <RippleLoader />
          <T color="textMuted">{verifying ? 'Verifying payment…' : 'Creating your order…'}</T>
        </View>
      ) : Platform.OS === 'web' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
          <RippleLoader />
          <T color="textMuted">Razorpay Checkout is open…</T>
        </View>
      ) : (
        <WebView originWhitelist={['*']} source={{ html: checkoutHtml(order, c.primary), baseUrl: 'https://checkout.razorpay.com' }} onMessage={onMessage} javaScriptEnabled style={{ flex: 1 }} />
      )}
    </View>
  );
}
