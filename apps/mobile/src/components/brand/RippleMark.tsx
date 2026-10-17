import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

/** BRAND.accent; not imported by value because Logo imports ui, which uses this loader. */
const ACCENT = '#3FCF8E';

/** The mark's geometry, measured from ripple-mark.png (512px, so the full mark spans 2 × 256): centre dot radius and each ring's inner/outer radius. */
const DOT_R = 44;
const RINGS: [number, number][] = [
  [99, 120],
  [146, 166],
  [190, 210],
  [236, 256],
];
/** How far each ring is pushed out by the wave, in mark units; it weakens as it travels outward. */
const PUSH = [16, 13, 10, 8];

/** One cycle: the drop lands, the wave runs through the rings, the centre settles back, then a short rest. */
const CYCLE_MS = 2000;
/** Length of the full-size mark's cycle, for callers that wait on it. */
export const RIPPLE_MS = CYCLE_MS;
const HIT = 0.08;
/** Where in a cycle the last ring has settled: the ripple is complete. */
const WAVE_END = 0.6;
/** Small loaders loop faster so short waits still show a full ripple. */
export const QUICK_MS = 1100;

/**
 * The app mark drawn ring by ring so it can move: a drop lands on the centre,
 * which dips, springs back and turns green, and a wave then pushes each ring
 * outward in turn. Only the mark's own shapes and colours are used.
 */
export function RippleMark({
  size,
  color,
  quick,
  rings = RINGS.length,
  onRippleEnd,
  delay = 0,
  style,
}: {
  size: number;
  color?: string;
  quick?: boolean;
  rings?: number;
  /** Called each time a ripple completes (the last ring has settled). */
  onRippleEnd?: () => void;
  /** Wait this long (ms) before the first drop lands. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const ink = color ?? c.text;
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    // JS driver: colour interpolation and easing aren't supported by the native driver; it only runs while something loads.
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: quick ? QUICK_MS : CYCLE_MS, easing: Easing.linear, useNativeDriver: false }));
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [t, quick, delay]);

  const endRef = useRef(onRippleEnd);
  useEffect(() => {
    endRef.current = onRippleEnd;
  });
  useEffect(() => {
    let prev = 0;
    const id = t.addListener(({ value }) => {
      if (prev < WAVE_END && value >= WAVE_END) endRef.current?.();
      prev = value;
    });
    return () => t.removeListener(id);
  }, [t]);

  // Fewer rings: scale so the outermost one shown still fills `size`.
  const shown = RINGS.slice(0, rings);
  const u = size / (shown[shown.length - 1][1] * 2);
  const at = (input: number[], output: number[]) => t.interpolate({ inputRange: input, outputRange: output, extrapolate: 'clamp' });

  // Centre: dips under the drop, springs past full size, settles; turns green on contact and back before the next drop.
  const dotScale = at([0, HIT, HIT + 0.04, HIT + 0.1, HIT + 0.18], [1, 1, 0.7, 1.12, 1]);
  const dotColor = t.interpolate({ inputRange: [0, HIT + 0.02, HIT + 0.06, 0.86, 0.98, 1], outputRange: [ink, ink, ACCENT, ACCENT, ink, ink], extrapolate: 'clamp' });

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {shown.map(([inner, outer], i) => {
        // Each ring swells out as the wave reaches it, dips slightly behind it, then settles.
        const start = HIT + 0.05 + i * 0.07;
        const push = PUSH[i] / outer;
        const scale = at([start, start + 0.08, start + 0.17, start + 0.26], [1, 1 + push, 1 - push * 0.3, 1]);
        const d = outer * 2 * u;
        // Keep rings visible at small sizes.
        const stroke = Math.max(1, (outer - inner) * u);
        return <Animated.View key={i} style={{ position: 'absolute', width: d, height: d, borderRadius: d / 2, borderWidth: stroke, borderColor: ink, transform: [{ scale }] }} />;
      })}
      <Animated.View style={{ width: DOT_R * 2 * u, height: DOT_R * 2 * u, borderRadius: DOT_R * u, backgroundColor: dotColor, transform: [{ scale: dotScale }] }} />
    </View>
  );
}

/** The app's only loading indicator: a small rippling mark. Use wherever a spinner would go. */
export function RippleLoader({ size = 32, color, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <RippleMark size={size} color={color} quick />
    </View>
  );
}
