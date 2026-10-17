import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { DraftContent } from '@shared';
import { autofillWiecodes, type FillTarget } from '@/lib/autofill';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { RippleLoader } from '../brand/RippleMark';
import { Icon, T, haptic } from '../ui';

/**
 * "Auto-fill with AI" for the editor: fills the current step (or every step)
 * with a sample Wiecodes client campaign so testers can move through the flow
 * quickly. Everything it writes stays editable.
 */
export function AutofillBar({ step, update }: { step: number; update: (fn: (d: DraftContent) => DraftContent) => void }) {
  const [busy, setBusy] = useState<FillTarget | null>(null);
  const onSubmit = step === 4;

  const run = async (target: FillTarget) => {
    if (busy != null) return;
    haptic.light();
    setBusy(target);
    try {
      const real = await autofillWiecodes(update, target);
      const what = target === 'all' ? 'Every step' : 'This step';
      toast(`${what} filled with a Wiecodes campaign${real ? '' : ' (AI offline: sample copy)'}. Edit anything you like.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {!onSubmit && <FillButton label="Auto-fill with AI" icon="sparkles-outline" primary loading={busy === (step as FillTarget)} onPress={() => run(step as FillTarget)} />}
        <FillButton label={onSubmit ? 'Auto-fill every step with AI' : 'Fill every step'} icon="sparkles-outline" primary={onSubmit} loading={busy === 'all'} onPress={() => run('all')} />
      </View>
      <T variant="small" color="textSubtle">
        {onSubmit ? 'Fills Basics to Reach with a sample Wiecodes campaign. The funding goal and rules stay yours to set.' : 'Fills in a sample campaign for Wiecodes. You can edit or delete anything.'}
      </T>
    </View>
  );
}

function FillButton({ label, icon, primary, loading, onPress }: { label: string; icon: 'sparkles-outline'; primary?: boolean; loading: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 36,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: primary ? c.primary : c.border,
        backgroundColor: primary ? c.primarySoft : c.surface,
        opacity: pressed ? 0.75 : 1,
      })}>
      {loading ? <RippleLoader size={16} color={c.primary} /> : <Icon name={icon} size={15} color={c.primary} />}
      <T variant="smallStrong" style={{ color: primary ? c.primary : c.text }}>
        {label}
      </T>
    </Pressable>
  );
}
