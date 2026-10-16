import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { Icon, T } from './ui';

/** Global confirmation toast (saved, submitted, copied...). Announced to screen readers. */
export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const y = useState(() => new Animated.Value(-120))[0];

  useEffect(() => {
    if (!toast) return;
    Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 18 }).start();
    const t = setTimeout(() => Animated.timing(y, { toValue: -120, duration: 200, useNativeDriver: true }).start(hide), 2600);
    return () => clearTimeout(t);
  }, [toast, y, hide]);

  if (!toast) return null;
  const icon = toast.tone === 'error' ? 'alert-circle' : toast.tone === 'info' ? 'information-circle' : 'checkmark-circle';
  const color = toast.tone === 'error' ? c.danger : toast.tone === 'info' ? c.info : c.success;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 8, left: space.lg, right: space.lg, transform: [{ translateY: y }], zIndex: 100 }}>
      <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: c.text }}>
        <Icon name={icon} size={20} color={color} />
        <T variant="bodyStrong" style={{ color: c.bg, flex: 1 }}>
          {toast.message}
        </T>
      </View>
    </Animated.View>
  );
}
