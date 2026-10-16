import { Image } from 'expo-image';
import { View } from 'react-native';
import type { CampaignSummary } from '@shared';
import { radius, space, useTheme } from '@/theme';
import { T } from './ui';

const STEPS = ['Amount', 'Review', 'Pay'];

/** Compact campaign reminder + 3-step progress shown on every backing screen. */
export function BackingHeader({ c: campaign, step }: { c?: CampaignSummary; step: number }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityLabel={`Step ${step + 1} of 3: ${STEPS[step]}`}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? c.primary : c.track }} />
            <T variant="small" color={i === step ? 'text' : 'textSubtle'} style={i === step && { fontWeight: '600' }}>
              {i + 1}. {s}
            </T>
          </View>
        ))}
      </View>
      {!!campaign && (
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Image source={campaign.coverImage} style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: c.skeleton }} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <T variant="small" color="textMuted">
              Amplifying
            </T>
            <T variant="bodyStrong" numberOfLines={2}>
              {campaign.title}
            </T>
          </View>
        </View>
      )}
    </View>
  );
}
