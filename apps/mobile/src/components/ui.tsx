import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text as RNText,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { STATUS_META, type CampaignStatus } from '@shared';
import type { IconWeight } from 'phosphor-react-native';
import { radius, shadow, space, type, useTheme, type Colors, type TypeVariant } from '@/theme';
import { ICONS, type IconName } from './icons';
import { RippleRings } from './brand/RippleRings';

export type { IconName };

/** App icon: Phosphor glyphs behind stable names (see components/icons.ts). */
export function Icon({ name, size = 20, color, style, weight }: { name: IconName; size?: number; color?: string; style?: StyleProp<ViewStyle>; weight?: IconWeight }) {
  const [Glyph, defaultWeight] = ICONS[name] ?? ICONS['ellipse-outline'];
  return <Glyph size={size} color={color} weight={weight ?? defaultWeight} style={style} />;
}

export const haptic = {
  light: () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  success: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warn: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};

type TProps = TextProps & { variant?: TypeVariant; color?: keyof Colors; center?: boolean; style?: StyleProp<TextStyle> };
export function T({ variant = 'body', color = 'text', center, style, ...rest }: TProps) {
  const { c } = useTheme();
  return <RNText maxFontSizeMultiplier={1.6} {...rest} style={[type[variant], { color: c[color] }, center && { textAlign: 'center' }, style]} />;
}

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
  size?: 'md' | 'lg' | 'sm';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, variant = 'primary', size = 'md', icon, iconRight, loading, full, disabled, style, onPress, ...rest }: ButtonProps) {
  const { c } = useTheme();
  const palette = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surface, fg: c.text, border: c.border },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
    quiet: { bg: c.surfaceAlt, fg: c.text, border: c.surfaceAlt },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft },
  }[variant];
  // Kept compact so actions read as professional, not bulky.
  const h = size === 'lg' ? 48 : size === 'sm' ? 34 : 42;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={(e) => {
        haptic.light();
        onPress?.(e);
      }}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed }) => [
        {
          height: h,
          paddingHorizontal: size === 'sm' ? space.md : space.lg + 2,
          borderRadius: 10,
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: palette.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        full && { alignSelf: 'stretch' },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} color={palette.fg} />}
          <T variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'} style={[{ color: palette.fg }, size !== 'sm' && { fontSize: 14.5 }]} numberOfLines={1}>
            {label}
          </T>
          {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} color={palette.fg} />}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, tone = 'default', size = 22, style }: { icon: IconName; label: string; onPress?: () => void; tone?: 'default' | 'onImage' | 'primary'; size?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const bg = tone === 'onImage' ? 'rgba(0,0,0,0.42)' : 'transparent';
  const fg = tone === 'onImage' ? '#fff' : tone === 'primary' ? c.primary : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.light();
        onPress?.();
      }}
      hitSlop={8}
      style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, opacity: pressed ? 0.6 : 1 }, style]}>
      <Icon name={icon} size={size} color={fg} />
    </Pressable>
  );
}

export function Card({ children, style, padded = true, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; onPress?: () => void; accessibilityLabel?: string }) {
  const { c } = useTheme();
  const s: StyleProp<ViewStyle> = [{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, overflow: 'hidden' }, padded && { padding: space.lg }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [s, { opacity: pressed ? 0.92 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon, count }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; count?: number }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        haptic.light();
        onPress?.();
      }}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primary : c.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        opacity: pressed ? 0.8 : 1,
      })}>
      {icon && <Icon name={icon} size={15} color={selected ? c.onPrimary : c.textMuted} />}
      <T variant="smallStrong" style={{ color: selected ? c.onPrimary : c.text }}>
        {label}
        {count != null ? ` · ${count}` : ''}
      </T>
    </Pressable>
  );
}

export function ProgressBar({ value, height = 6, tone = 'primary' }: { value: number; height?: number; tone?: 'primary' | 'accent' | 'success' }) {
  const { c } = useTheme();
  const w = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(w, { toValue: Math.max(0, Math.min(100, value)), duration: 600, useNativeDriver: false }).start();
  }, [value, w]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
      style={{ height, borderRadius: height, backgroundColor: c.track, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: c[tone], width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

const toneColors = (c: Colors, tone: string) =>
  ({
    neutral: { bg: c.surfaceAlt, fg: c.textMuted },
    info: { bg: c.infoSoft, fg: c.info },
    success: { bg: c.successSoft, fg: c.success },
    warning: { bg: c.warningSoft, fg: c.warning },
    danger: { bg: c.dangerSoft, fg: c.danger },
    accent: { bg: c.accentSoft, fg: c.accent },
    primary: { bg: c.primarySoft, fg: c.primary },
  })[tone] ?? { bg: c.surfaceAlt, fg: c.textMuted };

/** Small text tag. Deliberately icon-free: tags stay quiet so icons keep their meaning elsewhere. */
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'primary' }) {
  const { c } = useTheme();
  const t = toneColors(c, tone);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: t.bg }}>
      <T variant="smallStrong" style={{ color: t.fg, fontSize: 12 }}>
        {label}
      </T>
    </View>
  );
}

export function StatusPill({ status }: { status: CampaignStatus }) {
  const m = STATUS_META[status];
  return <Pill label={m.label} tone={m.tone} />;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }, style]} />;
}

export function Skeleton({ h = 16, w = '100%', r = 6, style }: { h?: number; w?: number | `${number}%`; r?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const o = useState(() => new Animated.Value(0.5))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View accessibilityLabel="Loading" style={[{ height: h, width: w, borderRadius: r, backgroundColor: c.skeleton, opacity: o }, style]} />;
}

export function EmptyState({ icon = 'leaf-outline', title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.sm }}>
      <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
        <RippleRings size={96} color={c.primary} rings={3} style={{ position: 'absolute', opacity: 0.5 }} />
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={22} color={c.textMuted} weight="duotone" />
        </View>
      </View>
      <T variant="subheading" center>
        {title}
      </T>
      {!!body && (
        <T color="textMuted" center>
          {body}
        </T>
      )}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Couldn’t load this"
      body={message ?? 'Check your connection and try again.'}
      action={onRetry && <Button label="Try again" variant="secondary" icon="refresh" onPress={onRetry} />}
    />
  );
}

export function Banner({ tone = 'info', icon, title, body, action }: { tone?: 'info' | 'warning' | 'danger' | 'success' | 'neutral' | 'accent'; icon?: IconName; title?: string; body: ReactNode; action?: ReactNode }) {
  const { c } = useTheme();
  const t = toneColors(c, tone);
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.sm + 2, backgroundColor: t.bg }}>
      {!!icon && <Icon name={icon} size={16} color={t.fg} style={{ marginTop: 1 }} />}
      <View style={{ flex: 1, gap: 2 }}>
        {!!title && (
          <T variant="smallStrong" style={{ color: t.fg }}>
            {title}
          </T>
        )}
        {typeof body === 'string' ? <T variant="small" style={{ color: c.text }}>{body}</T> : body}
        {action}
      </View>
    </View>
  );
}

export function ListRow({ icon, title, subtitle, onPress, right, danger }: { icon?: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; danger?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.md, opacity: pressed ? 0.6 : 1 })}>
      {!!icon && (
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? c.dangerSoft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={danger ? c.danger : c.text} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong" style={danger && { color: c.danger }}>
          {title}
        </T>
        {!!subtitle && (
          <T variant="small" color="textMuted">
            {subtitle}
          </T>
        )}
      </View>
      {right ?? (onPress && <Icon name="chevron-forward" size={18} color={c.textSubtle} />)}
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction, overline }: { title: string; action?: string; onAction?: () => void; overline?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md }}>
      <View style={{ flex: 1 }}>
        {!!overline && (
          <T variant="overline" color="primary" style={{ marginBottom: 4 }}>
            {overline}
          </T>
        )}
        <T variant="heading">{title}</T>
      </View>
      {!!action && (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <T variant="smallStrong" color="primary">
            {action}
          </T>
        </Pressable>
      )}
    </View>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="number">{value}</T>
      <T variant="small" color="textMuted">
        {label}
      </T>
      {!!hint && (
        <T variant="small" color="textSubtle" style={{ fontSize: 11 }}>
          {hint}
        </T>
      )}
    </View>
  );
}

export function DemoBadge() {
  return <Pill label="Sample data" tone="accent" />;
}

export { shadow };

/** react-native-web's switch uses a teal thumb when on unless told otherwise. */
const WEB_THUMB = Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : {};

/**
 * On/off switch used everywhere. The fixed-height wrapper keeps it vertically
 * centred in its row (the iOS switch can otherwise sit at the top of its box).
 */
export function Toggle({ value, onValueChange, disabled, accessibilityLabel }: { value: boolean; onValueChange?: (v: boolean) => void; disabled?: boolean; accessibilityLabel: string }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 32, justifyContent: 'center', alignSelf: 'center' }}>
      <Switch value={value} disabled={disabled} onValueChange={onValueChange} trackColor={{ true: c.primary, false: c.track }} ios_backgroundColor={c.track} thumbColor="#FFFFFF" {...WEB_THUMB} accessibilityLabel={accessibilityLabel} />
    </View>
  );
}
