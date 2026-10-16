import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { BRAND, useRippleMark } from './Logo';
import { RippleRings } from './RippleRings';
import { TigerPattern } from './TigerPattern';

/**
 * Branded loading screen shown while fonts and the saved session load.
 * Follows light/dark like the rest of the app: the faint pattern, the mark in
 * the text colour and green ripples moving outward.
 */
export function LoadingScreen() {
  const { c } = useTheme();
  const mark = useRippleMark();
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Loading Ripple" accessibilityRole="progressbar">
      <TigerPattern />
      <Animated.View style={{ alignItems: 'center', opacity: fade }}>
        <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
          <RippleRings size={300} color={BRAND.accent} animated style={{ position: 'absolute' }} />
          <Image source={mark} style={{ width: 132, height: 132 }} />
          <View style={{ position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: BRAND.accent }} />
        </View>
        <Text style={{ marginTop: 44, color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>ripple</Text>
        <Text style={{ marginTop: 6, color: c.textMuted, fontSize: 14, letterSpacing: 0.3 }}>Messages that travel further</Text>
      </Animated.View>
    </View>
  );
}
