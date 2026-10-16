import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { BACKABLE_STATUSES, REACH_CONFIG, estimateReach, feeBreakdown, validateContributionAmount } from '@shared';
import { BackingHeader } from '@/components/BackingHeader';
import { Field } from '@/components/Field';
import { Body, Header } from '@/components/Screen';
import { Banner, Button, Card, Icon, ProgressBar, T, haptic, Toggle } from '@/components/ui';
import { useBacking } from '@/lib/backing';
import { formatMoney, formatReach, pct } from '@/lib/format';
import type { Detail } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { fonts, radius, space, useTheme } from '@/theme';

/**
 * Step 1: choose an amount. Presets and "complete the goal" fill the one
 * amount field, so what will be charged is always visible and editable.
 */
export function AmountStep({ d, onBack, onContinue }: { d: Detail; onBack: () => void; onContinue: () => void }) {
  const { c } = useTheme();
  const b = useBacking();
  const user = useSession((s) => s.user);
  const [input, setInput] = useState(b.amount ? String(b.amount) : '');
  const [touched, setTouched] = useState(false);

  const amount = Number(input || 0);
  const remaining = Math.max(0, d.goal - d.raised);
  const error = validateContributionAmount(amount);
  const valid = !error && amount > 0;
  const fees = feeBreakdown(valid ? amount : 0);
  const reach = valid ? estimateReach(amount, d.reachFactor) : 0;
  const after = d.raised + (valid ? amount : 0);
  const closed = !BACKABLE_STATUSES.includes(d.status);
  const goalReached = remaining === 0;
  const pastGoal = valid && !goalReached && amount > remaining;
  const nameError = b.showName && !b.displayName.trim() ? 'Enter the name to show, or keep it private.' : undefined;

  const choose = (n: number) => {
    haptic.light();
    setInput(String(n));
    b.set({ amount: n });
  };

  // One contribution can't exceed the maximum, so the goal tile offers at most that ("Max").
  const overMax = remaining > REACH_CONFIG.maxContribution;
  const goalValue = Math.min(remaining, REACH_CONFIG.maxContribution);
  const showComplete = !goalReached && goalValue >= REACH_CONFIG.minContribution && !REACH_CONFIG.presets.includes(goalValue as any);
  const options: { value: number; sub: string; complete?: boolean }[] = [
    ...REACH_CONFIG.presets.map((p) => ({ value: p, sub: `≈ ${formatReach(estimateReach(p, d.reachFactor))} people` })),
    ...(showComplete ? [{ value: goalValue, sub: overMax ? 'Max' : 'Goal', complete: true }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Back this campaign" onBack={onBack} />
      <Body
        footer={
          <Button
            label={valid ? `Continue with ${formatMoney(amount)}` : 'Enter an amount'}
            size="lg"
            disabled={!valid || !!nameError || closed}
            onPress={() => {
              setTouched(true);
              if (!valid || nameError) return;
              b.set({ amount });
              onContinue();
            }}
          />
        }>
        <BackingHeader c={d} step={0} />
        {closed && <Banner tone="warning" icon="lock-closed-outline" body="This campaign isn’t accepting contributions right now." />}

        <View style={{ gap: space.md }}>
          <T variant="heading">How much would you like to contribute?</T>

          <View style={{ flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: radius.md, borderWidth: 2, borderColor: input ? c.primary : c.border, backgroundColor: c.surface, paddingHorizontal: space.lg, gap: space.sm }}>
            <T variant="subheading" color="textMuted">
              ₹
            </T>
            <TextInput
              value={input ? Number(input).toLocaleString('en-IN') : ''}
              onChangeText={(t) => {
                const digits = t.replace(/[^0-9]/g, '').slice(0, 7);
                setInput(digits);
                if (digits) b.set({ amount: Number(digits) });
              }}
              onBlur={() => setTouched(true)}
              keyboardType="number-pad"
              placeholder="Enter amount"
              placeholderTextColor={c.textSubtle}
              accessibilityLabel="Contribution amount in rupees"
              style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 20, color: c.text }}
            />
            {!!input && (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear amount" hitSlop={8} onPress={() => setInput('')}>
                <Icon name="close-circle" size={18} color={c.textSubtle} />
              </Pressable>
            )}
          </View>
          {touched && !!input && !!error && (
            <T variant="small" color="danger">
              {error}
            </T>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole="radiogroup">
            {options.map((o) => {
              const sel = amount === o.value;
              return (
                <Pressable
                  key={`${o.value}-${o.complete ? 'c' : 'p'}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={o.complete ? `${formatMoney(o.value)}, ${overMax ? 'the most you can give at once' : 'completes the goal'}` : `${formatMoney(o.value)}, ${o.sub}`}
                  onPress={() => choose(o.value)}
                  style={{ width: '31.5%', paddingVertical: space.sm + 2, borderRadius: radius.md, borderWidth: sel ? 2 : 1, borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primarySoft : c.surface, alignItems: 'center', gap: 1 }}>
                  <T variant="bodyStrong" color={sel ? 'primary' : 'text'}>
                    {formatMoney(o.value)}
                  </T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <T variant="small" color={sel ? 'primary' : 'textMuted'} style={{ fontSize: 11 }}>
                      {o.sub}
                    </T>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {goalReached ? (
            <T variant="small" color="success">
              Goal reached. Extra contributions show the message to even more people.
            </T>
          ) : pastGoal ? (
            <T variant="small" color="primary">
              This takes the campaign {formatMoney(amount - remaining)} past its goal. The extra buys more reach.
            </T>
          ) : (
            <T variant="small" color="textMuted">
              {formatMoney(remaining)} left to reach the goal.
            </T>
          )}
        </View>

        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
            <T variant="title" color="primary">
              ≈ {formatReach(reach)}
            </T>
            <T color="textMuted">people could see this message</T>
          </View>
          <T variant="small" color="textSubtle">
            Estimate from demo ad-price assumptions. Not a guarantee.
          </T>
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 2 }} />
          <Row k="Goes to advertising" v={formatMoney(fees.adBudget, true)} />
          <Row k={`Platform share (${Math.round(REACH_CONFIG.platformFeeRate * 100)}%) for review and setup`} v={formatMoney(fees.platformFee, true)} />
        </Card>

        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="smallStrong">With your contribution</T>
            <T variant="small" color="textMuted">
              {formatMoney(after)} of {formatMoney(d.goal)} · {pct(after, d.goal)}%
            </T>
          </View>
          <ProgressBar value={pct(after, d.goal)} tone={after >= d.goal ? 'success' : 'primary'} />
        </View>

        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong">Show my name on the campaign</T>
              <T variant="small" color="textMuted">
                Off by default. Your amount is never shown publicly.
              </T>
            </View>
            <Toggle
              value={b.showName}
              onValueChange={(v) => {
                haptic.light();
                b.set({ showName: v, displayName: v && !b.displayName && user && !user.isGuest ? user.name : b.displayName });
              }}
              accessibilityLabel="Show my name publicly"
            />
          </View>
          {b.showName && <Field label="Name to show" required value={b.displayName} onChangeText={(t) => b.set({ displayName: t })} max={60} error={nameError} placeholder="e.g. Jordan K." />}
        </Card>

        {(!user || user.isGuest) && (
          <Field
            label="Email for your receipt"
            value={b.email}
            onChangeText={(t) => b.set({ email: t.trim() })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            helper="No account needed. We only use this to send your receipt."
            placeholder="you@example.com"
          />
        )}

        <Banner tone="accent" icon="information-circle-outline" body="This is not a donation to the cause. Your contribution pays to show this message to more people." />
      </Body>
    </View>
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
