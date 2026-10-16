import * as Clipboard from 'expo-clipboard';
import { Pressable, View } from 'react-native';
import { PAYMENT_CONFIG, formatMoney } from '@shared';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { Icon, T, haptic, type IconName } from './ui';

export type TestOutcome = 'success' | 'failure';
export type TestMethod = 'upi' | 'card';

/** Razorpay's documented test-mode details. They only work with rzp_test_ keys. */
export const TEST_UPI: Record<TestOutcome, string> = { success: 'success@razorpay', failure: 'failure@razorpay' };
export const TEST_CARD = { number: '4100 2800 0000 1007', expiry: '12/30', cvv: '123' };
export const TEST_OTP: Record<TestOutcome, string> = { success: '1234', failure: '12' };

/** UPI is usually capped per payment; above that, testers should use a card. */
export const defaultMethod = (amount: number | null): TestMethod => (amount != null && amount > PAYMENT_CONFIG.upiLimit ? 'card' : 'upi');

/** Compact tap-to-copy value. */
export function CopyValue({ value, label, copy }: { value: string; label?: string; copy?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label ?? value}`}
      onPress={async () => {
        haptic.light();
        await Clipboard.setStringAsync(copy ?? value);
        toast(`Copied ${label ?? value}`);
      }}
      hitSlop={6}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: c.surface, borderWidth: 1, borderColor: c.primary, opacity: pressed ? 0.7 : 1 })}>
      <T variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </T>
      <Icon name="copy-outline" size={14} color={c.primary} />
    </Pressable>
  );
}

function Segmented<K extends string>({ value, onChange, options }: { value: K; onChange: (k: K) => void; options: { key: K; label: string; icon: IconName; color?: string }[] }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: radius.sm, backgroundColor: c.surfaceAlt }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const sel = value === o.key;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            onPress={() => {
              haptic.light();
              onChange(o.key);
            }}
            style={{ flex: 1, flexDirection: 'row', gap: 5, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? c.surface : 'transparent' }}>
            <Icon name={o.icon} size={14} color={sel ? (o.color ?? c.primary) : c.textSubtle} />
            <T variant="small" style={{ fontWeight: '600', color: sel ? c.text : c.textMuted }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Detail({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 30 }}>
      <T variant="small" color="textMuted" style={{ width: 64 }}>
        {k}
      </T>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/**
 * How to test Razorpay test mode: choose the outcome and the method, get the
 * matching copyable test details. Card is suggested above the UPI limit.
 */
export function RazorpayTestGuide({ outcome, onChange, method, onMethodChange, amount }: { outcome: TestOutcome; onChange: (o: TestOutcome) => void; method: TestMethod; onMethodChange: (m: TestMethod) => void; amount: number | null }) {
  const { c } = useTheme();
  const ok = outcome === 'success';
  const overUpi = amount != null && amount > PAYMENT_CONFIG.upiLimit;
  const steps =
    method === 'upi'
      ? ['Tap “Pay with Razorpay” below and enter any 10-digit mobile number.', `Choose UPI and paste ${TEST_UPI[outcome]}.`]
      : ['Tap “Pay with Razorpay” below and enter any 10-digit mobile number.', 'Choose Card and enter the card, expiry and CVV above.', `On the test bank page, enter OTP ${TEST_OTP[outcome]}${ok ? ' (any 4–10 digits succeeds)' : ' (under 4 digits fails)'}.`];

  return (
    <View style={{ gap: space.sm }}>
      <T variant="smallStrong">How to test</T>
      <Segmented
        value={outcome}
        onChange={onChange}
        options={[
          { key: 'success', label: 'Succeeds', icon: 'checkmark-circle', color: c.success },
          { key: 'failure', label: 'Fails', icon: 'close-circle', color: c.danger },
        ]}
      />
      <Segmented
        value={method}
        onChange={onMethodChange}
        options={[
          { key: 'upi', label: 'UPI', icon: 'phone-portrait-outline' },
          { key: 'card', label: 'Card', icon: 'card-outline' },
        ]}
      />
      {overUpi && method === 'upi' && (
        <T variant="small" color="warning">
          UPI payments are usually limited to {formatMoney(PAYMENT_CONFIG.upiLimit)}. Use a test card for this amount.
        </T>
      )}
      <View style={{ gap: 2, padding: space.sm, borderRadius: radius.sm, backgroundColor: c.surfaceAlt }}>
        {method === 'upi' ? (
          <Detail k="UPI ID">
            <CopyValue value={TEST_UPI[outcome]} label="test UPI ID" />
          </Detail>
        ) : (
          <>
            <Detail k="Card">
              <CopyValue value={TEST_CARD.number} label="test card number" copy={TEST_CARD.number.replace(/\s/g, '')} />
            </Detail>
            <Detail k="Expiry">
              <T variant="smallStrong">{TEST_CARD.expiry} <T variant="small" color="textSubtle">(any future date)</T></T>
            </Detail>
            <Detail k="CVV">
              <T variant="smallStrong">{TEST_CARD.cvv} <T variant="small" color="textSubtle">(any 3 digits)</T></T>
            </Detail>
            <Detail k="OTP">
              <CopyValue value={TEST_OTP[outcome]} label="test OTP" />
            </Detail>
          </>
        )}
      </View>
      {steps.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
          <T variant="small" color="primary" style={{ fontWeight: '700', width: 14 }}>
            {i + 1}.
          </T>
          <T variant="small" style={{ flex: 1 }}>
            {s}
          </T>
        </View>
      ))}
      <T variant="small" color="textSubtle">
        {ok ? 'You’ll see the confirmation with a receipt.' : 'You’ll see “Payment unsuccessful”. No money is taken.'} Test mode never charges real money.
      </T>
    </View>
  );
}
