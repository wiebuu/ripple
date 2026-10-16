import { useMemo, useState } from 'react';
import { Animated } from 'react-native';

/**
 * Instagram-style header: it stays put for the first `delay` points of
 * scrolling, then slides away so content gets the full screen, and slides
 * back as soon as the user scrolls up again.
 */
export function useCollapsingHeader(delay = 96) {
  const [scrollY] = useState(() => new Animated.Value(0));
  const [height, setHeight] = useState(0);

  const translateY = useMemo(() => {
    const h = Math.max(height, 1);
    // Ignore iOS overscroll bounce at the top (negative offsets).
    const positive = scrollY.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: 'clamp' });
    return Animated.diffClamp(positive, 0, h + delay).interpolate({ inputRange: [delay, delay + h], outputRange: [0, -h], extrapolate: 'clamp' });
  }, [scrollY, height, delay]);

  return {
    scrollY,
    height,
    onLayout: (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = Math.round(e.nativeEvent.layout.height);
      if (h !== height) setHeight(h);
    },
    onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    headerStyle: { position: 'absolute' as const, top: 0, left: 0, right: 0, zIndex: 10, transform: [{ translateY }] },
  };
}
