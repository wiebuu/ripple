import { Image } from 'expo-image';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme';

/** Colours are baked into the PNGs. Ink is the reversed look for green surfaces. */
const SOURCES = {
  accent: require('../../../assets/images/ripple-pattern.png'),
  ink: require('../../../assets/images/ripple-pattern-ink.png'),
};

/** Same tile size as the loading screen's TigerPattern, so the swirls are never zoomed. */
const TILE_W = 700;
const TILE_H = 440.5;

type Node = Animated.Value | Animated.AnimatedAddition<number>;
/** Total scroll of every container a window sits in, live (for transforms) and as numbers (for measuring). */
type ScrollOffset = { x: Node; y: Node; now: () => { x: number; y: number } };

const ZERO = new Animated.Value(0);
const ScrollCtx = createContext<ScrollOffset>({ x: ZERO, y: ZERO, now: () => ({ x: 0, y: 0 }) });

/**
 * Wrap the content of a scroll container whose PatternWindows should keep the
 * backdrop still while they scroll past. `value` is the container's scroll
 * offset on `axis`, fed by an Animated.event. Nested containers add up.
 */
export function PatternScroll({ axis, value, children }: { axis: 'x' | 'y'; value: Animated.Value; children: ReactNode }) {
  const parent = useContext(ScrollCtx);
  const current = useRef(0);
  useEffect(() => {
    const id = value.addListener(({ value: v }) => {
      current.current = v;
    });
    return () => value.removeListener(id);
  }, [value]);
  const ctx = useMemo<ScrollOffset>(
    () => ({
      x: axis === 'x' ? Animated.add(parent.x, value) : parent.x,
      y: axis === 'y' ? Animated.add(parent.y, value) : parent.y,
      now: () => {
        const p = parent.now();
        return axis === 'x' ? { x: p.x + current.current, y: p.y } : { x: p.x, y: p.y + current.current };
      },
    }),
    [axis, value, parent],
  );
  return <ScrollCtx.Provider value={ctx}>{children}</ScrollCtx.Provider>;
}

/** Scroll value and handler for a container wrapped in PatternScroll. */
export function usePatternScroll(axis: 'x' | 'y') {
  const [value] = useState(() => new Animated.Value(0));
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { [axis]: value } } }], { useNativeDriver: true }), [axis, value]);
  return { value, onScroll };
}

/**
 * A window onto one swirl backdrop fixed to the screen. Every PatternWindow
 * shows the part of the same backdrop that sits behind it, and keeps showing
 * the right part while its container scrolls, so surfaces slide over a still
 * background. Place it as the first child of a surface with `overflow: 'hidden'`.
 */
export function PatternWindow({ tone = 'accent', opacity }: { tone?: keyof typeof SOURCES; opacity?: number }) {
  const { dark } = useTheme();
  const { width, height } = useWindowDimensions();
  const scroll = useContext(ScrollCtx);
  const ref = useRef<View>(null);
  // Where the window would sit on screen with every container scrolled to the start.
  const [base, setBase] = useState<{ x: number; y: number } | null>(null);
  // Dark mode's brighter green and darker page make the swirls read stronger, so they're toned down there.
  const alpha = opacity ?? (tone === 'ink' ? (dark ? 0.11 : 0.2) : dark ? 0.08 : 0.22);
  const cols = Math.max(1, Math.ceil(width / TILE_W));
  const rows = Math.max(1, Math.ceil(height / TILE_H));

  const measure = () =>
    ref.current?.measureInWindow((wx, wy) => {
      const s = scroll.now();
      const x = Math.round(wx + s.x);
      const y = Math.round(wy + s.y);
      setBase((p) => (p && p.x === x && p.y === y ? p : { x, y }));
    });
  // Measure once after mount too: onLayout alone doesn't always fire for a fill-only view.
  useEffect(() => {
    const id = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      ref={ref}
      collapsable={false}
      pointerEvents="none"
      onLayout={measure}
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: base ? alpha : 0 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {base && (
        <Animated.View style={{ position: 'absolute', left: -base.x, top: -base.y, width, height, transform: [{ translateX: scroll.x }, { translateY: scroll.y }] }}>
          {Array.from({ length: rows * cols }, (_, i) => {
            const r = Math.floor(i / cols);
            const col = i % cols;
            return (
              <Image
                key={i}
                source={SOURCES[tone]}
                contentFit="fill"
                cachePolicy="memory-disk"
                style={{
                  position: 'absolute',
                  left: col * TILE_W,
                  top: r * TILE_H,
                  width: TILE_W,
                  height: TILE_H,
                  // Mirrored tiles, as on the loading screen, so seams line up.
                  transform: [{ scaleX: col % 2 ? -1 : 1 }, { scaleY: r % 2 ? -1 : 1 }],
                }}
              />
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}
