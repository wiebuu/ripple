import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/lib/toast';
import { radius, shadow, space, useTheme } from '@/theme';
import { Icon, T, type IconName } from './ui';

/** How long a toast stays before hiding itself. */
const SHOW_MS = 2600;
/** Off-screen position above the status bar. */
const HIDDEN = -160;
/** Auto-hide timer. Module-level because there is only ever one toast host. */
let hideTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Global confirmation toast (saved, submitted, copied...). Announced to screen readers.
 * Swipe it up (or tap it) to dismiss; holding it pauses the auto-hide.
 */
export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  // JS-driven so a drag can move it directly (setValue doesn't reach natively driven values on Android).
  const [y] = useState(() => new Animated.Value(HIDDEN));

  const dismiss = () => {
    clearTimeout(hideTimer);
    Animated.timing(y, { toValue: HIDDEN, duration: 180, useNativeDriver: false }).start(() => hide());
  };
  const startTimer = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(dismiss, SHOW_MS);
  };

  useEffect(() => {
    if (!toast) return;
    y.setValue(HIDDEN);
    Animated.spring(y, { toValue: 0, useNativeDriver: false, damping: 18 }).start();
    startTimer();
    return () => clearTimeout(hideTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => clearTimeout(hideTimer))
    // Moves freely upward; resists a downward pull.
    .onUpdate((e) => y.setValue(e.translationY < 0 ? e.translationY : e.translationY * 0.2))
    .onEnd((e) => {
      if (e.translationY < -24 || e.velocityY < -400) dismiss();
      else {
        Animated.spring(y, { toValue: 0, useNativeDriver: false, damping: 18 }).start();
        startTimer();
      }
    });
  const tap = Gesture.Tap().runOnJS(true).onEnd(dismiss);

  if (!toast) return null;
  const tone = {
    success: { icon: 'checkmark-circle', fg: c.primary, soft: c.primarySoft },
    error: { icon: 'alert-circle', fg: c.danger, soft: c.dangerSoft },
    info: { icon: 'information-circle', fg: c.info, soft: c.infoSoft },
  }[toast.tone] as { icon: IconName; fg: string; soft: string };
  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: space.lg, right: space.lg, transform: [{ translateY: y }], zIndex: 100 }}>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        {/* Styled like the app's cards: surface colour, hairline border, soft shadow; the tone shows in the icon. */}
        <View
          collapsable={false}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          accessibilityHint="Swipe up or tap to dismiss"
          style={[
            { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingLeft: space.md, paddingRight: space.lg, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
            shadow.card,
            // A card shadow is too faint to lift it off busy screens; give it a bit more depth.
            { shadowOpacity: 0.14, shadowRadius: 18, elevation: 6 },
          ]}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tone.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={tone.icon} size={18} color={tone.fg} />
          </View>
          <T variant="bodyStrong" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
            {toast.message}
          </T>
          {/* A small grabber hints that it can be swiped away. */}
          <View style={{ position: 'absolute', bottom: 4, left: '50%', marginLeft: -14, width: 28, height: 3, borderRadius: 2, backgroundColor: c.border }} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}
