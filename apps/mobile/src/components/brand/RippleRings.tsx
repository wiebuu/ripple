import { useEffect, useState } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Concentric rings, the Ripple motif. Static by default; `animated` sends
 * waves outward (used for celebrations and loading).
 */
export function RippleRings({ size = 160, color, rings = 3, animated = false, style }: { size?: number; color: string; rings?: number; animated?: boolean; style?: StyleProp<ViewStyle> }) {
  const [waves] = useState(() => Array.from({ length: rings }, () => new Animated.Value(0)));

  useEffect(() => {
    if (!animated) return;
    const loops = waves.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [animated, waves]);

  return (
    <View pointerEvents="none" style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {waves.map((v, i) => {
        const base = (i + 1) / rings;
        const ringStyle = animated
          ? { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }] }
          : { opacity: 0.5 - i * (0.35 / rings), transform: [{ scale: base }] };
        return <Animated.View key={i} style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(1, size / 80), borderColor: color }, ringStyle]} />;
      })}
    </View>
  );
}
