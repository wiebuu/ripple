import { Image } from 'expo-image';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from '../ui';

/** The rings, baked in black and white (image tinting is unreliable on web). */
const MARKS = { ink: require('@/assets/images/ripple-mark-ink.png'), white: require('@/assets/images/ripple-mark-white.png') };
/** Rings in the theme's text colour: black in light mode, white in dark mode. */
export function useRippleMark() {
  const { dark } = useTheme();
  return dark ? MARKS.white : MARKS.ink;
}
export const BRAND = { ink: '#0B0B0C', accent: '#3FCF8E' };

/** App mark: ripple rings in the theme's text colour (black in light, white in dark) around a green centre. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const mark = useRippleMark();
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={mark} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
      <View style={{ position: 'absolute', width: size * 0.2, height: size * 0.2, borderRadius: size, backgroundColor: BRAND.accent }} />
    </View>
  );
}

/** Home header: the mark plus "ripple" at the same size as every other tab title. */
export function Wordmark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityRole="header" accessibilityLabel="Ripple">
      <LogoMark />
      <T variant="title">ripple</T>
    </View>
  );
}
