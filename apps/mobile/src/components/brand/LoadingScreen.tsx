import { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { RIPPLE_MS, RippleMark } from './RippleMark';
import { TigerPattern } from './TigerPattern';

/** A beat after the screen appears before the first drop lands, so the mark is seen at rest first. */
const FIRST_DROP_DELAY = 700;

/**
 * Branded loading screen shown while fonts, the saved session and Home's data load.
 * Follows light/dark like the rest of the app: the faint pattern and the mark
 * in the text colour, with a drop landing on its centre. It always finishes the
 * ripple in progress: once `ready`, it calls `onDone` as soon as a ripple
 * completes; until then it keeps rippling.
 */
export function LoadingScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { c } = useTheme();
  const latest = useRef({ ready, onDone });
  useEffect(() => {
    latest.current = { ready, onDone };
  });
  // Safety net: if animation frames stall (low power, backgrounded), still open once ready, within a ripple's length.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => latest.current.onDone(), FIRST_DROP_DELAY + RIPPLE_MS + 300);
    return () => clearTimeout(t);
  }, [ready]);
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Loading Ripple" accessibilityRole="progressbar">
      <TigerPattern />
      <Animated.View style={{ alignItems: 'center', opacity: fade }}>
        <RippleMark size={132} delay={FIRST_DROP_DELAY} onRippleEnd={() => latest.current.ready && latest.current.onDone()} />
        <Text style={{ marginTop: 44, color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>ripple</Text>
        <Text style={{ marginTop: 6, color: c.textMuted, fontSize: 14, letterSpacing: 0.3 }}>One drop. Endless ripples.</Text>
      </Animated.View>
    </View>
  );
}
