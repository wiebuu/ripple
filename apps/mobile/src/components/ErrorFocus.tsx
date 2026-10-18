import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type View } from 'react-native';

/**
 * "Take me to what's missing": every field that is showing an error registers
 * itself here. After a failed Next / Submit, `focusFirst()` scrolls the form so
 * the top-most error sits in the upper part of the screen and shakes it once,
 * so the person sees exactly where to fix things.
 */
type Anchor = { view: RefObject<View | null>; nudge: () => void };
type Registry = { add: (a: Anchor) => () => void };
const Ctx = createContext<Registry | null>(null);

export function useErrorFocus(scroll: RefObject<ScrollView | null>) {
  const anchors = useRef(new Set<Anchor>());
  const offset = useRef(0);
  const { height } = useWindowDimensions();
  const registry = useMemo<Registry>(
    () => ({
      add: (a) => {
        anchors.current.add(a);
        return () => anchors.current.delete(a);
      },
    }),
    [],
  );

  /** Call right after marking the form as attempted: waits for the error messages to render, then jumps to the first. */
  const focusFirst = (delay = 60) => {
    setTimeout(() => {
      const list = [...anchors.current];
      if (!list.length) return;
      let found = 0;
      const spots: { y: number; a: Anchor }[] = [];
      list.forEach((a) =>
        a.view.current?.measureInWindow((_x, y) => {
          spots.push({ y, a });
          if (++found < list.length) return;
          const first = spots.sort((p, q) => p.y - q.y)[0];
          // Bring it to about a quarter of the way down, below the header.
          scroll.current?.scrollTo({ y: Math.max(0, offset.current + first.y - height * 0.25), animated: true });
          setTimeout(first.a.nudge, 280);
        }),
      );
    }, delay);
  };

  return {
    focusFirst,
    /** Pass to the ScrollView so the current offset is known. */
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
    },
    /** Pass to <ErrorScope registry={…}> around the form's contents. */
    registry,
  };
}

/** Wraps a form so its fields with errors can be found by useErrorFocus. */
export function ErrorScope({ registry, children }: { registry: Registry; children: ReactNode }) {
  return <Ctx.Provider value={registry}>{children}</Ctx.Provider>;
}

/**
 * For a field container: while `error` is set, the field is registered as a
 * place to scroll to. Returns the ref to attach and the value to shake it with (translateX).
 */
export function useErrorAnchor(error: unknown) {
  const registry = useContext(Ctx);
  const view = useRef<View>(null);
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!error || !registry) return;
    const nudge = () => {
      const to = (v: number) => Animated.timing(x, { toValue: v, duration: 55, useNativeDriver: true });
      Animated.sequence([to(-8), to(8), to(-6), to(6), to(-3), to(0)]).start();
    };
    return registry.add({ view, nudge });
  }, [error, registry, x]);
  return [view, x] as const;
}
