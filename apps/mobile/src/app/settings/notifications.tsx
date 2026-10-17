import { useMutation } from '@tanstack/react-query';
import { View } from 'react-native';
import type { NotificationKind, NotificationPrefs } from '@shared';
import { Body, Header } from '@/components/Screen';
import { Banner, Card, Divider, ErrorState, Icon, Skeleton, T, haptic, Toggle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { KIND_META } from '@/lib/kinds';
import { queryClient, usePrefs } from '@/lib/queries';
import { toast } from '@/lib/toast';
import { space, useTheme } from '@/theme';

const ORDER: NotificationKind[] = ['CONTRIBUTION', 'MILESTONE', 'FUNDING', 'DEADLINE', 'PROMOTION', 'REPORT', 'UPDATE', 'SUBMISSION', 'REVIEW', 'SECURITY'];

export default function NotificationSettings() {
  const { c } = useTheme();
  const q = usePrefs();
  const save = useMutation({
    mutationFn: (p: Partial<NotificationPrefs>) => api<NotificationPrefs>('/notifications/prefs', { method: 'PUT', body: p }),
    onMutate: (p) => queryClient.setQueryData<NotificationPrefs>(['prefs'], (old) => (old ? { ...old, ...p } : old)),
    onError: (e) => {
      toast(errorMessage(e), 'error');
      q.refetch();
    },
  });
  const toggle = (k: keyof NotificationPrefs, v: boolean) => {
    haptic.light();
    save.mutate({ ...q.data, [k]: v });
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Notifications" />
      <Body>
        {q.isPending ? (
          // Shaped like the real page: intro line, then rows of icon, label and toggle.
          <View style={{ gap: space.lg }}>
            <View style={{ gap: 8 }}>
              <Skeleton h={12} />
              <Skeleton w="70%" h={12} />
            </View>
            <Card padded={false} style={{ paddingHorizontal: space.lg }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60 }}>
                    <Skeleton w={20} h={20} r={10} />
                    <Skeleton w={`${45 + ((i * 13) % 30)}%`} h={14} style={{ flex: 0 }} />
                    <View style={{ flex: 1 }} />
                    <Skeleton w={44} h={26} r={13} />
                  </View>
                  {i < 5 && <Divider />}
                </View>
              ))}
            </Card>
          </View>
        ) : q.isError || !q.data ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <>
            <T color="textMuted">Choose what Ripple tells you about. We group updates so you’re not notified about every single contribution.</T>
            <Card padded={false} style={{ paddingHorizontal: space.lg }}>
              {ORDER.map((k, i) => {
                const m = KIND_META[k];
                const locked = k === 'SECURITY';
                return (
                  <View key={k}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.sm }}>
                      <Icon name={m.icon} size={20} color={c[m.tone]} />
                      <View style={{ flex: 1 }}>
                        <T variant="bodyStrong">{m.label}</T>
                        {locked && (
                          <T variant="small" color="textMuted">
                            Always on to keep your account safe
                          </T>
                        )}
                      </View>
                      <Toggle value={locked || q.data[k]} disabled={locked} onValueChange={(v) => toggle(k, v)} accessibilityLabel={m.label} />
                    </View>
                    {i < ORDER.length - 1 && <Divider />}
                  </View>
                );
              })}
            </Card>
            <T variant="overline" color="textMuted">
              Delivery
            </T>
            <Card padded={false} style={{ paddingHorizontal: space.lg }}>
              <Row label="In-app" sub="Always on" value disabled />
              <Divider />
              <Row label="Email" sub="Receipts and weekly summary" value={q.data.email} onChange={(v) => toggle('email', v)} />
              <Divider />
              <Row label="Push notifications" sub="Milestones and launches" value={q.data.push} onChange={(v) => toggle('push', v)} />
            </Card>
            <Banner tone="neutral" icon="information-circle-outline" body="Email and push delivery are saved as preferences but not sent in this prototype." />
          </>
        )}
      </Body>
    </View>
  );
}

function Row({ label, sub, value, onChange, disabled }: { label: string; sub: string; value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.sm }}>
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">{label}</T>
        <T variant="small" color="textMuted">
          {sub}
        </T>
      </View>
      <Toggle value={value} disabled={disabled} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}
