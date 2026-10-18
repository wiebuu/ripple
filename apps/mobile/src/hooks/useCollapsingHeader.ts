import { useMemo, useState } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { TAB_HEADER_HEIGHT } from '@/components/TabHeader';

/**
 * Instagram-style header: it stays put for the first `delay` points of
 * scrolling, then slides away so content gets the full screen, and slides
 * back as soon as the user scrolls up again.
 *
 * Lists under the header should pad their content by the header's height and
 * pass the same value as RefreshControl's progressViewOffset (honoured on both
 * iOS and Android) so the pull-to-refresh spinner appears just below it.
 */
/** `onScrollJs` also receives every scroll event on the JS side (e.g. to track the distance to the end). */
export function useCollapsingHeader(delay = 96, onScrollJs?: (e: NativeScrollEvent) => void) {
  const [scrollY] = useState(() => new Animated.Value(0));
  // Start at the tab header's known height so content is placed right on the first frame instead of jumping down once measured.
  const [height, setHeight] = useState(TAB_HEADER_HEIGHT);

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
    onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: true,
      listener: onScrollJs && ((e: NativeSyntheticEvent<NativeScrollEvent>) => onScrollJs(e.nativeEvent)),
    }),
    headerStyle: { position: 'absolute' as const, top: 0, left: 0, right: 0, zIndex: 10, transform: [{ translateY }] },
  };
}
