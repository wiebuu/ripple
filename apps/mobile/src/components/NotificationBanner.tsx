import { useState } from 'react';
import { Animated, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppNotification } from '@shared';
import { KIND_META } from '@/lib/kinds';
import { useLiveAccount, useLiveNotifications } from '@/lib/live';
import { openNotification } from '@/lib/openNotification';
import { radius, shadow, space, useTheme } from '@/theme';
import { Icon, T, haptic } from './ui';

/** How long a banner stays before sliding away. */
const SHOW_MS = 5000;
const HIDDEN = -200;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * In-app notification banner. Notifications arrive over the live connection
 * the moment they're created (campaign approved, milestone reached, ads live …)
 * and drop in from the top like a system notification. Tap to open what it's
 * about (Manage for your own campaigns), swipe up to dismiss. Mounted once in
 * the root layout, which also keeps the live connection signed in.
 */
export function NotificationBanner() {
  useLiveAccount();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [n, setN] = useState<AppNotification | null>(null);
  // JS-driven so a drag can move it directly (setValue doesn't reach natively driven values on Android).
  const [y] = useState(() => new Animated.Value(HIDDEN));

  const hide = (then?: () => void) => {
    clearTimeout(hideTimer);
    Animated.timing(y, { toValue: HIDDEN, duration: 200, useNativeDriver: false }).start(() => {
      setN(null);
      then?.();
    });
  };
  const startTimer = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => hide(), SHOW_MS);
  };

  useLiveNotifications((next) => {
    haptic.light();
    setN(next);
    y.setValue(HIDDEN);
    Animated.spring(y, { toValue: 0, useNativeDriver: false, damping: 17 }).start();
    startTimer();
  });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => clearTimeout(hideTimer))
    .onUpdate((e) => y.setValue(e.translationY < 0 ? e.translationY : e.translationY * 0.2))
    .onEnd((e) => {
      if (e.translationY < -24 || e.velocityY < -400) hide();
      else {
        Animated.spring(y, { toValue: 0, useNativeDriver: false, damping: 17 }).start();
        startTimer();
      }
    });
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      if (!n) return;
      const open = n;
      haptic.light();
      hide(() => openNotification(open));
    });

  if (!n) return null;
  const meta = KIND_META[n.kind] ?? KIND_META.UPDATE;
  const tone = c[meta.tone];
  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: space.md, right: space.md, transform: [{ translateY: y }], zIndex: 110 }}>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View
          collapsable={false}
          accessibilityRole="button"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${n.title}. ${n.body}`}
          accessibilityHint="Opens it. Swipe up to dismiss."
          style={[
            { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md, paddingBottom: space.md + 4, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
            shadow.card,
            { shadowOpacity: 0.16, shadowRadius: 20, elevation: 8 },
          ]}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={meta.icon} size={19} color={tone} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <T variant="smallStrong" style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
                {n.title}
              </T>
              <T variant="small" color="textSubtle" style={{ fontSize: 11 }}>
                now
              </T>
            </View>
            <T variant="small" color="textMuted" numberOfLines={2}>
              {n.body}
            </T>
          </View>
          <View style={{ position: 'absolute', bottom: 5, left: '50%', marginLeft: -14, width: 28, height: 3, borderRadius: 2, backgroundColor: c.border }} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}
