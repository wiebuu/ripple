import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { Funding } from '@/components/campaign';
import { Body, Header } from '@/components/Screen';
import { Banner, Button, Card, ErrorState, Icon, Skeleton, T, haptic, type IconName } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMoney, formatReach } from '@/lib/format';

import { shareCampaign } from '@/lib/share';
import { RippleRings } from '@/components/brand/RippleRings';
import { space, useTheme, type Colors } from '@/theme';
import type { PayResult } from '@/lib/backing';

const META: Record<string, { icon: IconName; tone: keyof Colors; title: string }> = {
  SUCCEEDED: { icon: 'hand-heart', tone: 'primary', title: 'Thank you for backing this' },
  PENDING: { icon: 'time', tone: 'warning', title: 'Payment not completed' },
  FAILED: { icon: 'close-circle', tone: 'danger', title: 'Payment unsuccessful' },
  CANCELLED: { icon: 'remove-circle', tone: 'textMuted', title: 'Payment cancelled' },
};

export default function BackingResult() {
  const { kid } = useLocalSearchParams<{ kid: string }>();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['contribution', kid], queryFn: () => api<PayResult>(`/contributions/${kid}`), refetchOnMount: 'always' });
  const [scale] = useState(() => new Animated.Value(0.6));
  const status = q.data?.contribution.status;

  useEffect(() => {
    if (!status) return;
    if (status === 'SUCCEEDED') haptic.success();
    else if (status === 'FAILED') haptic.warn();
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  }, [status, scale]);

  // The backing flow was replaced by this screen, so the campaign page is right underneath.
  const done = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/campaign/[id]', params: { id: q.data!.campaign.id } }));

  if (q.isPending)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Payment" back={false} />
        <Body>
          <Skeleton h={80} w={80} r={40} style={{ alignSelf: 'center' }} />
          <Skeleton h={28} />
          <Skeleton h={140} r={16} />
        </Body>
      </View>
    );
  if (q.isError || !q.data)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Payment" />
        <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />
      </View>
    );

  const { contribution: k, campaign } = q.data;
  const m = META[k.status] ?? META.CANCELLED;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={k.status === 'SUCCEEDED' ? 'Confirmed' : 'Payment'} back={false} right={<Button label="Done" variant="ghost" size="sm" onPress={done} />} />
      <Body
        footer={
          k.status === 'SUCCEEDED' ? (
            <>
              <Button label="Share this campaign" icon="share-outline" size="lg" onPress={() => shareCampaign(campaign)} />
              <Button label="Back to campaign" variant="ghost" size="sm" onPress={done} />
            </>
          ) : (
            <>
              <Button label="Try again" icon="refresh" size="lg" onPress={() => router.replace({ pathname: '/back/[id]', params: { id: campaign.id } })} />
              <Button label="Back to campaign" variant="ghost" size="sm" onPress={done} />
            </>
          )
        }>
        <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.lg }} accessibilityLiveRegion="polite">
          <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
            {k.status === 'SUCCEEDED' && <RippleRings size={150} color={c.primary} animated style={{ position: 'absolute' }} />}
            <Animated.View style={{ transform: [{ scale }], width: 84, height: 84, borderRadius: 42, backgroundColor: k.status === 'SUCCEEDED' ? c.primarySoft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={m.icon} size={42} color={c[m.tone]} />
            </Animated.View>
          </View>
          {k.status === 'SUCCEEDED' && (
            <T variant="overline" color="primary" center>
              You’re supporter #{campaign.backerCount.toLocaleString('en-IN')}
            </T>
          )}
          <T variant="title" center>
            {m.title}
          </T>
          {k.status === 'SUCCEEDED' && (
            <T color="textMuted" center>
              {formatMoney(k.amount, true)} will help show “{campaign.title}” to about {formatReach(k.estimatedReach)} more people (est.).
            </T>
          )}
          {k.status !== 'SUCCEEDED' && k.failureReason && (
            <T color="textMuted" center>
              {k.failureReason}
            </T>
          )}
          {k.status === 'PENDING' && (
            <T color="textMuted" center>
              The Razorpay checkout was closed before the payment finished. Nothing was charged.
            </T>
          )}
        </View>

        {k.status === 'SUCCEEDED' && (
          <>
            <Card style={{ gap: space.md }}>
              <T variant="overline" color="textMuted">
                Updated progress
              </T>
              <Funding c={campaign} />
              {campaign.status === 'FUNDED' && <Banner tone="success" icon="trophy-outline" body="Your contribution helped reach the goal. The team will now prepare distribution." />}
            </Card>
            <Card onPress={() => router.push({ pathname: '/receipt/[kid]', params: { kid: k.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Icon name="receipt-outline" size={22} color={c.primary} />
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">Receipt {k.receiptNo}</T>
                <T variant="small" color="textMuted">
                  {formatMoney(k.total, true)} charged · card ending {k.cardLast4}
                </T>
              </View>
              <Icon name="chevron-forward" size={18} color={c.textSubtle} />
            </Card>
            <Banner tone="info" icon="notifications-outline" body="You’re now following this campaign. We’ll tell you when ads launch and when the final report is ready." />
          </>
        )}
        {k.status === 'CANCELLED' && <Banner tone="neutral" icon="shield-checkmark-outline" body="No money was taken. Your card was not charged." />}
      </Body>
    </View>
  );
}
