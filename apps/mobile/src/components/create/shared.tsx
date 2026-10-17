import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { STEP_SHORT, STEPS, type DraftContent, type Errors } from '@shared';
import type { SaveState } from '@/lib/draft';
import { relTime } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';
import { Icon, T, haptic } from '../ui';

export type StepProps = {
  d: DraftContent;
  update: (fn: (d: DraftContent) => DraftContent) => void;
  errors: Errors;
  draftId: string;
};

/** Persistent five-step indicator. Completed steps are tappable to jump back. */
export function StepProgress({ step, onJump, invalid }: { step: number; onJump: (i: number) => void; invalid: boolean[] }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: space.xl, paddingBottom: space.sm }} accessibilityLabel={`Step ${step + 1} of 5: ${STEPS[step]}`}>
      {STEP_SHORT.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={`Go to step ${i + 1}, ${STEPS[i]}${invalid[i] && done ? ', needs attention' : ''}`}
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic.light();
              onJump(i);
            }}
            hitSlop={{ top: 8, bottom: 8 }}
            style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: done ? (invalid[i] ? c.warning : c.primary) : active ? c.primary : c.track }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              {done && <Icon name={invalid[i] ? 'alert-circle' : 'checkmark-circle'} size={11} color={invalid[i] ? c.warning : c.primary} />}
              <T variant="small" numberOfLines={1} color={active ? 'text' : 'textSubtle'} style={{ fontSize: 11, fontWeight: active ? '700' : '500' }}>
                {s}
              </T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Saved · 2m ago" / "Saving…" / "Saved on this device". */
export function SaveIndicator({ state, savedAt, error }: { state: SaveState; savedAt: number | null; error?: string }) {
  const { c } = useTheme();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const map = {
    pending: { icon: 'ellipsis-horizontal' as const, text: 'Unsaved changes', color: c.textSubtle },
    saving: { icon: 'sync-outline' as const, text: 'Saving…', color: c.textSubtle },
    saved: { icon: 'checkmark-done' as const, text: savedAt ? `Saved ${relTime(new Date(savedAt).toISOString())}` : 'Saved', color: c.success },
    idle: { icon: 'cloud-done-outline' as const, text: savedAt ? `Saved ${relTime(new Date(savedAt).toISOString())}` : 'Draft', color: c.textSubtle },
    error: { icon: 'cloud-offline-outline' as const, text: 'Saved on this device', color: c.warning },
  }[state];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLiveRegion="polite" accessibilityLabel={error ? `${map.text}. ${error}` : map.text}>
      <T variant="small" style={{ color: map.color, fontSize: 12 }}>
        {map.text}
      </T>
    </View>
  );
}

export function StepIntro({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T variant="title">{title}</T>
      <T color="textMuted">{body}</T>
    </View>
  );
}

export function Tip({ children }: { children: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.sm + 2, backgroundColor: c.infoSoft }}>
      <Icon name="bulb-outline" size={14} color={c.info} style={{ marginTop: 2 }} />
      <T variant="small" style={{ flex: 1 }}>
        {children}
      </T>
    </View>
  );
}

export function FieldError({ error }: { error?: string }) {
  const { c } = useTheme();
  if (!error) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLiveRegion="polite">
      <Icon name="alert-circle" size={15} color={c.danger} style={{ marginTop: 2 }} />
      <T variant="small" color="danger" style={{ flex: 1 }}>
        {error}
      </T>
    </View>
  );
}

export function Label({ text, required, hint }: { text: string; required?: boolean; hint?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T variant="smallStrong">
        {text}
        {required ? <T variant="smallStrong" color="danger">{' *'}</T> : <T variant="small" color="textSubtle">{'  optional'}</T>}
      </T>
      {!!hint && (
        <T variant="small" color="textMuted">
          {hint}
        </T>
      )}
    </View>
  );
}
