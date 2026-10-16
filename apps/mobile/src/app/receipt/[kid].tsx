import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';
import { Body, Header } from '@/components/Screen';
import { Button, Card, Divider, ErrorState, IconButton, Pill, Skeleton, T } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMoney, formatReach } from '@/lib/format';
import { space } from '@/theme';
import type { PayResult } from '@/lib/backing';
import { useBackOrPush } from '@/lib/nav';

const TONE = { SUCCEEDED: 'success', PENDING: 'warning', FAILED: 'danger', CANCELLED: 'neutral', REFUNDED: 'info' } as const;

export default function Receipt() {
  const { kid } = useLocalSearchParams<{ kid: string }>();
  const goTo = useBackOrPush();
  const q = useQuery({ queryKey: ['contribution', kid], queryFn: () => api<PayResult>(`/contributions/${kid}`) });

  if (q.isPending)
    return (
      <View style={{ flex: 1 }}>
        <Header title="Receipt" />
        <Body>
          <Skeleton h={260} r={16} />
        </Body>
      </View>
    );
  if (q.isError || !q.data)
    return (
      <View style={{ flex: 1 }}>
        <Header title="Receipt" />
        <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />
      </View>
    );

  const { contribution: k, campaign } = q.data;
  const date = new Date(k.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const text = `Ripple receipt ${k.receiptNo}\n${date}\nCampaign amplification: ${campaign.title}\nContribution ${formatMoney(k.amount, true)}\nProcessing ${formatMoney(k.processingFee, true)}\nTotal ${formatMoney(k.total, true)}\nStatus ${k.status}`;

  return (
    <View style={{ flex: 1 }}>
      <Header title="Receipt" right={<IconButton icon="share-outline" label="Share receipt" onPress={() => Share.share({ message: text })} />} />
      <Body>
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T variant="overline" color="textMuted">
              Receipt
            </T>
            <Pill label={k.status.charAt(0) + k.status.slice(1).toLowerCase()} tone={TONE[k.status]} />
          </View>
          <T variant="subheading">{k.receiptNo}</T>
          <T variant="small" color="textMuted">
            {date}
          </T>
          <Divider />
          <T variant="smallStrong">Campaign amplification</T>
          <T>{campaign.title}</T>
          <Divider />
          <Line k="Contribution" v={formatMoney(k.amount, true)} />
          <Line k="  of which advertising" v={formatMoney(k.amount - k.platformFee, true)} muted />
          <Line k="  of which platform share" v={formatMoney(k.platformFee, true)} muted />
          <Line k="Card processing" v={formatMoney(k.processingFee, true)} />
          <Divider />
          <Line k="Total" v={formatMoney(k.total, true)} strong />
          <Line k="Paid with" v={k.cardLast4 && /^\d{4}$/.test(k.cardLast4) ? `Razorpay test · card •••• ${k.cardLast4}` : 'Razorpay (test mode)'} muted />
          <Line k="Estimated reach" v={`≈ ${formatReach(k.estimatedReach)} people`} muted />
          <Line k="Name on campaign page" v={k.showName ? 'Shown' : 'Private'} muted />
        </Card>
        <T variant="small" color="textMuted">
          This payment funds distribution of the campaign’s message. It is not a charitable donation and is not tax-deductible. Razorpay test mode: no real money was moved.
        </T>
        <Button label="View campaign" variant="secondary" onPress={() => goTo('campaign/[id]/index', { pathname: '/campaign/[id]', params: { id: campaign.id } }, campaign.id)} />
      </Body>
    </View>
  );
}

function Line({ k, v, strong, muted }: { k: string; v: string; strong?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <T variant={strong ? 'bodyStrong' : 'small'} color={muted ? 'textMuted' : 'text'} style={{ flex: 1 }}>
        {k}
      </T>
      <T variant={strong ? 'subheading' : 'smallStrong'}>{v}</T>
    </View>
  );
}
