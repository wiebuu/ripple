import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { QUICK_MS, RippleMark } from '@/components/brand/RippleMark';
import { haptic } from '@/components/ui';

/** Longest a refresh may keep the ripple up, so a hung request can never leave it stuck. */
const MAX_SPIN_MS = 10_000;
/** A refresh shows two full ripples, then the ripple leaves (later only if the data is still loading). */
const MIN_SPIN_MS = QUICK_MS * 2;
/** How far the user pulls (pt) before the ripple is fully grown. */
const PULL = 70;
const SIZE = 36;
/** Height of the gap the content makes for the ripple when the platform doesn't (tab re-tap, Android pull). */
const ROOM = 64;
/** Tallest gap the ripple is drawn in; a longer pull just leaves empty space. */
const MAX_GAP = 160;
/** How quickly the ripple fades once a refresh is done. */
const EXIT_MS = 140;
/**
 * Android's SwipeRefreshLayout always draws its own disc, shadow and arrow (transparent colours are ignored),
 * so on Android the pull is handled here instead: the content follows the finger and opens the same gap as iOS.
 */
const CUSTOM_PULL = Platform.OS === 'android';
/** The content moves half as far as the finger, like a rubber band. */
const DRAG_RATIO = 0.5;

/**
 * Pull-to-refresh with the app's ripple instead of the platform spinner.
 *
 * The ripple lives only in the gap above the content, like the native
 * spinner: the space a pull drags open, or the space the content slides down
 * to make on a tab re-tap (and on Android, where a pull doesn't move content).
 * It is clipped to that gap, so it never draws over anything, and as the
 * content returns or the user scrolls up, the content's edge covers it.
 * A refresh fetches fresh data and ripples twice before the gap closes.
 * Background refetches never show it.
 *
 * Pass the screen's scroll offset if it already tracks one (`scrollY`, driven
 * by a native Animated.event); otherwise attach `onScroll` to the scroll view.
 * Render `indicator(top)` just before the scroll view (`top` = where the
 * content starts), wrap the scroll view in `<PullArea pull={pull}>`, and pass
 * `control()` as its refreshControl.
 */
export function usePullRefresh(refetch: () => unknown, scrollY?: Animated.Value) {
  // Opt out of the React Compiler: the gesture's callbacks read refs and the clock, but only on gesture events, never during render.
  'use no memo';
  const [refreshing, setRefreshing] = useState(false);
  // Only a pull drives RefreshControl; a tab re-tap must not make iOS shift the content.
  const [fromPull, setFromPull] = useState(false);
  const [own] = useState(() => new Animated.Value(0));
  const y = scrollY ?? own;
  // The slide shares a node graph with the scroll value, so it must use the same driver.
  const native = !!scrollY;
  const [pulling, setPulling] = useState(false);
  const [exit] = useState(() => new Animated.Value(1));
  const [leaving, setLeaving] = useState(false);
  // After a refresh, ignore the pull while the content springs back.
  const [settling, setSettling] = useState(false);
  const yNow = useRef(0);
  // Scroll offset when the slide opened; scrolling past it closes the gap again.
  const [anchor, setAnchor] = useState(0);
  const [shift] = useState(() => new Animated.Value(0));
  // Android custom pull: whether the list is at its top (only then can a pull start), and the live drag.
  const [atTop, setAtTop] = useState(true);
  const [dragging, setDragging] = useState(false);
  const dragged = useRef(0);
  const slide = (to: number) => Animated.timing(shift, { toValue: to, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();

  useEffect(() => {
    const id = y.addListener(({ value }) => {
      yNow.current = value;
      setPulling((p) => (p === value < -2 ? p : value < -2));
      if (value >= -2) setSettling(false);
      setAtTop((t) => (t === value <= 1 ? t : value <= 1));
    });
    return () => y.removeListener(id);
  }, [y]);

  // One refresh at a time: repeated tab taps or pulls while one is running are ignored.
  const busy = useRef(false);
  const refresh = async (byPull = false) => {
    if (busy.current) return;
    busy.current = true;
    haptic.light();
    setRefreshing(true);
    setFromPull(byPull);
    setAnchor(Math.max(0, yNow.current));
    // iOS opens its own gap for a pull; everywhere else, slide the content down to make one.
    if (!(byPull && Platform.OS === 'ios')) slide(ROOM);
    // eslint-disable-next-line react-hooks/purity -- runs when a refresh starts (tap or gesture), not during render
    const started = Date.now();
    try {
      await Promise.race([Promise.resolve(refetch()), new Promise((r) => setTimeout(r, MAX_SPIN_MS))]);
    } catch {
      // Query errors surface in the screen's own error state.
    } finally {
      const left = MIN_SPIN_MS - (Date.now() - started);
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      setRefreshing(false);
      setFromPull(false);
      setSettling(true);
      setLeaving(true);
      exit.setValue(1);
      Animated.timing(exit, { toValue: 0, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: native }).start();
      // Unmount on a timer rather than the animation's callback, so a stalled frame can never leave it on screen.
      setTimeout(() => setLeaving(false), EXIT_MS + 20);
      slide(0);
      busy.current = false;
    }
  };

  const onScroll = Animated.event<NativeSyntheticEvent<NativeScrollEvent>>([{ nativeEvent: { contentOffset: { y: own } } }], { useNativeDriver: false });

  // How far the content is pushed down by the slide: the slide, minus however far the user has scrolled up since.
  const scrolledUp = y.interpolate({ inputRange: [anchor, anchor + ROOM], outputRange: [0, -ROOM], extrapolate: 'clamp' });
  const pushed = Animated.add(shift, scrolledUp).interpolate({ inputRange: [0, ROOM], outputRange: [0, ROOM], extrapolate: 'clamp' });
  // The gap above the content: a pull's overscroll (iOS) plus the slide.
  const overscroll = y.interpolate({ inputRange: [-MAX_GAP, 0], outputRange: [MAX_GAP, 0], extrapolate: 'clamp' });
  const gap = Animated.add(overscroll, pushed);

  /** The RefreshControl for the scroll view, with the platform spinner hidden (iOS only; Android uses the custom pull). */
  const control = (progressViewOffset?: number) =>
    CUSTOM_PULL ? undefined : (
      <RefreshControl refreshing={refreshing && fromPull} onRefresh={() => refresh(true)} progressViewOffset={progressViewOffset} tintColor="transparent" colors={['transparent']} />
    );

  // The list's own scrolling, registered with the gesture system so the pull can run alongside it on Android.
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  /** Android pull: a downward drag that starts with the list at its top. Sideways swipes and upward scrolls pass through. */
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .simultaneousWithExternalGesture(scrollGesture)
        .runOnJS(true)
        .enabled(CUSTOM_PULL && atTop && !refreshing)
        .activeOffsetY(10)
        .failOffsetY(-10)
        .failOffsetX([-16, 16])
        // eslint-disable-next-line react-hooks/refs -- gesture callback, runs on touch events only
        .onUpdate((e) => {
          const d = Math.max(0, Math.min(ROOM, e.translationY * DRAG_RATIO));
          dragged.current = d;
          // A zero-length animation, not setValue: setValue doesn't reach a natively driven value on Android.
          Animated.timing(shift, { toValue: d, duration: 0, useNativeDriver: native }).start();
          if (d > 2) setDragging(true);
        })
        // eslint-disable-next-line react-hooks/refs -- gesture callback, runs on touch events only
        .onFinalize(() => {
          const d = dragged.current;
          dragged.current = 0;
          setDragging(false);
          if (d >= ROOM * 0.75) refresh(true);
          else if (d > 0) slide(0);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atTop, refreshing, scrollGesture],
  );

  /** The ripple, drawn only inside the gap above the content. `top` is where the content starts on screen. */
  const indicator = (top = 0) => {
    const following = (pulling && !settling) || dragging;
    if (!refreshing && !leaving && !following) return null;
    const opacity = refreshing ? 1 : leaving ? exit : 1;
    // Grows with the finger while pulling; full size while refreshing.
    const scale =
      refreshing || leaving
        ? 1
        : dragging
          ? shift.interpolate({ inputRange: [0, ROOM], outputRange: [0.5, 1], extrapolate: 'clamp' })
          : y.interpolate({ inputRange: [-PULL, 0], outputRange: [1, 0.5], extrapolate: 'clamp' });
    return (
      // Outer box: everything above the content's top edge is clipped (headers, filters stay clean).
      <View pointerEvents="none" style={{ height: 0, zIndex: 5 }}>
        <View style={{ position: 'absolute', top, left: 0, right: 0, height: MAX_GAP, overflow: 'hidden' }}>
          {/* Inner box: its bottom edge follows the content's edge, so the content covers the ripple as the gap closes. */}
          <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: MAX_GAP, overflow: 'hidden', transform: [{ translateY: gap.interpolate({ inputRange: [0, MAX_GAP], outputRange: [-MAX_GAP, 0] }) }] }}>
            {/* The ripple sits in the middle of the gap. */}
            <Animated.View
              accessibilityRole="progressbar"
              accessibilityLabel="Refreshing"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                alignItems: 'center',
                opacity,
                transform: [{ translateY: gap.interpolate({ inputRange: [0, MAX_GAP], outputRange: [MAX_GAP - SIZE / 2, MAX_GAP / 2 - SIZE / 2] }) }, { scale }],
              }}>
              <RippleMark size={SIZE} rings={3} quick />
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    );
  };

  const slideStyle = { flex: 1, transform: [{ translateY: pushed }] };

  return { refreshing, onRefresh: () => refresh(false), onScroll, control, indicator, slideStyle, gesture, scrollGesture };
}

/** Wraps a refreshable scroll view: slides it aside for the ripple, and on Android handles the pull gesture. */
export function PullArea({ pull, children }: { pull: ReturnType<typeof usePullRefresh>; children: ReactNode }) {
  return (
    <GestureDetector gesture={pull.gesture}>
      <Animated.View style={pull.slideStyle} collapsable={false}>
        <GestureDetector gesture={pull.scrollGesture}>{children}</GestureDetector>
      </Animated.View>
    </GestureDetector>
  );
}
