import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { STEPS, type DraftContent } from '@shared';
import { autofillWiecodes, type FillTarget } from '@/lib/autofill';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { RippleLoader } from '../brand/RippleMark';
import { Sheet } from '../Sheet';
import { Icon, T, haptic, type IconName } from '../ui';

/**
 * Every AI action for the editor in one place, opened from the sparkle in the
 * header, so the form itself stays free of AI buttons. Fills the current step
 * (or every step) with a sample Wiecodes client campaign; on Basics it can also
 * suggest a title and summary from a short description.
 */
export function AiSheet({
  visible,
  onClose,
  step,
  update,
  onSuggestBasics,
}: {
  visible: boolean;
  onClose: () => void;
  step: number;
  update: (fn: (d: DraftContent) => DraftContent) => void;
  onSuggestBasics: () => void;
}) {
  const { c } = useTheme();
  const [busy, setBusy] = useState<FillTarget | null>(null);
  const onSubmit = step === 4;

  const run = async (target: FillTarget) => {
    if (busy != null) return;
    haptic.light();
    setBusy(target);
    try {
      const real = await autofillWiecodes(update, target);
      toast(`${target === 'all' ? 'Every step' : `${STEPS[step]}`} filled with a Wiecodes campaign${real ? '' : ' (sample copy)'}`);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Auto-fill">
      <T color="textMuted">Fill the form with a sample campaign for Wiecodes. Everything stays editable, and the funding goal is always yours to set.</T>
      <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
        {!onSubmit && <Row first icon="create-outline" title="Fill this step" body={`Writes ${STEPS[step]} for you`} loading={busy === step} onPress={() => run(step as FillTarget)} />}
        <Row first={onSubmit} icon="copy-outline" title="Fill every step" body="Basics, Story, Visuals and Reach in one go" loading={busy === 'all'} onPress={() => run('all')} />
        {step === 0 && (
          <Row
            icon="text-outline"
            title="Suggest a title and summary"
            body="Describe your idea and pick what you like"
            onPress={() => {
              onClose();
              onSuggestBasics();
            }}
          />
        )}
      </View>
    </Sheet>
  );
}

function Row({ icon, title, body, onPress, loading, first }: { icon: IconName; title: string; body: string; onPress: () => void; loading?: boolean; first?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: !!loading }}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderTopWidth: first ? 0 : 1, borderTopColor: c.border, backgroundColor: pressed ? c.surfaceAlt : c.surface })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        {loading ? <RippleLoader size={20} color={c.primary} /> : <Icon name={icon} size={18} color={c.primary} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong">{title}</T>
        <T variant="small" color="textMuted">
          {body}
        </T>
      </View>
      <Icon name="chevron-forward" size={16} color={c.textSubtle} />
    </Pressable>
  );
}
