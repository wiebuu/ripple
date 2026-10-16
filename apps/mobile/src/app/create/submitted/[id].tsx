import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { TIMELINE } from '@shared';
import { Body, Header } from '@/components/Screen';
import { Button, Icon, T, haptic } from '@/components/ui';
import { space, useTheme } from '@/theme';

/** Confirmation after submitting, with the lifecycle timeline so creators know what happens next. */
export default function Submitted() {
  const { id, revision } = useLocalSearchParams<{ id: string; revision?: string }>();
  const { c } = useTheme();
  useEffect(() => {
    haptic.success();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Submitted" back={false} />
      <Body
        footer={
          <>
            <Button label="Manage campaign" size="lg" onPress={() => router.replace({ pathname: '/manage/[id]', params: { id } })} />
            <Button label="Back to Home" variant="ghost" size="sm" onPress={() => router.dismissTo('/')} />
          </>
        }>
        <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.lg }} accessibilityLiveRegion="polite">
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="paper-plane" size={38} color={c.primary} />
          </View>
          <T variant="title" center>
            {revision ? 'Edits sent for review' : 'Your campaign is in review'}
          </T>
          <T color="textMuted" center>
            {revision
              ? 'Your live campaign stays as it was until a reviewer approves the changes.'
              : 'We’ll check your sources, visuals and targeting, usually within 1–2 business days. We’ll notify you either way.'}
          </T>
        </View>

        {!revision && (
          <View style={{ gap: 0 }}>
            <T variant="overline" color="textMuted" style={{ marginBottom: space.md }}>
              What happens next
            </T>
            {TIMELINE.map((t, i) => {
              const current = i === 0;
              return (
                <View key={t.status} style={{ flexDirection: 'row', gap: space.lg }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: current ? c.primary : c.surface, borderWidth: 2, borderColor: current ? c.primary : c.border, alignItems: 'center', justifyContent: 'center' }}>
                      {current ? <Icon name="checkmark" size={16} color={c.onPrimary} /> : <T variant="smallStrong" color="textSubtle">{i + 1}</T>}
                    </View>
                    {i < TIMELINE.length - 1 && <View style={{ width: 2, flex: 1, minHeight: 20, backgroundColor: c.border }} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: space.lg, gap: 2 }}>
                    <T variant="bodyStrong" color={current ? 'primary' : 'text'}>
                      {t.title}
                      {current ? '  ✓' : ''}
                    </T>
                    <T variant="small" color="textMuted">
                      {t.body}
                    </T>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Body>
    </View>
  );
}
