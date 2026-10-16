import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { AmountStep } from '@/components/backing/AmountStep';
import { CheckoutStep } from '@/components/backing/CheckoutStep';
import { PayStep } from '@/components/backing/PayStep';
import { ReviewStep } from '@/components/backing/ReviewStep';
import type { TestMethod, TestOutcome } from '@/components/RazorpayTestGuide';
import { Body, Header } from '@/components/Screen';
import { ErrorState, Skeleton } from '@/components/ui';
import { useBacking, type PayResult } from '@/lib/backing';
import { invalidateCampaign, queryClient, useCampaign } from '@/lib/queries';
import { useTheme } from '@/theme';

type Step = 'amount' | 'review' | 'pay' | 'checkout';

/**
 * The whole backing journey lives in this one screen so it never stacks pages:
 * back moves between steps, and finishing replaces the flow with the result,
 * leaving the campaign page directly underneath.
 */
export default function BackingFlow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const q = useCampaign(id);
  const start = useBacking((s) => s.start);
  const [step, setStep] = useState<Step>('amount');
  const [kid, setKid] = useState<string | null>(null);
  const [test, setTest] = useState<{ outcome: TestOutcome; method: TestMethod }>({ outcome: 'success', method: 'upi' });

  useEffect(() => {
    start(id);
  }, [id, start]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/campaign/[id]', params: { id } }));
  const back = () => {
    if (step === 'checkout') setStep('pay');
    else if (step === 'pay') setStep('review');
    else if (step === 'review') setStep('amount');
    else leave();
  };
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });

  // Android hardware back steps back through the flow instead of leaving it.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        backRef.current();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  const done = (r: PayResult) => {
    // Hand the fresh result over so the result screen never shows a stale state.
    queryClient.setQueryData(['contribution', r.contribution.id], r);
    invalidateCampaign(id);
    router.replace({ pathname: '/back/result/[kid]', params: { kid: r.contribution.id } });
  };

  // iOS swipe-back would leave the whole flow, so only allow it on the first step.
  const options = <Stack.Screen options={{ gestureEnabled: step === 'amount' }} />;

  if (!q.data)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {options}
        <Header title="Back this campaign" onBack={leave} />
        {q.isError ? (
          <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />
        ) : (
          <Body>
            <Skeleton h={60} />
            <Skeleton h={160} r={16} />
          </Body>
        )}
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {options}
      {step === 'amount' && <AmountStep d={q.data} onBack={back} onContinue={() => setStep('review')} />}
      {step === 'review' && (
        <ReviewStep
          id={id}
          onBack={back}
          onPaymentStarted={(k) => {
            setKid(k);
            setStep('pay');
          }}
        />
      )}
      {step === 'pay' && !!kid && (
        <PayStep
          id={id}
          kid={kid}
          onBack={back}
          onDone={done}
          onCheckout={(outcome, method) => {
            setTest({ outcome, method });
            setStep('checkout');
          }}
        />
      )}
      {step === 'checkout' && !!kid && <CheckoutStep kid={kid} outcome={test.outcome} method={test.method} onBack={back} onDone={done} />}
    </View>
  );
}
