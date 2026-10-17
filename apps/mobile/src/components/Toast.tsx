import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/lib/toast';
import { radius, shadow, space, useTheme } from '@/theme';
import { Icon, T, type IconName } from './ui';

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
  const tone = {
    success: { icon: 'checkmark-circle', fg: c.primary, soft: c.primarySoft },
    error: { icon: 'alert-circle', fg: c.danger, soft: c.dangerSoft },
    info: { icon: 'information-circle', fg: c.info, soft: c.infoSoft },
  }[toast.tone] as { icon: IconName; fg: string; soft: string };
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 8, left: space.lg, right: space.lg, transform: [{ translateY: y }], zIndex: 100 }}>
      {/* Styled like the app's cards: surface colour, hairline border, soft shadow; the tone shows in the icon. */}
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
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
      </View>
    </Animated.View>
  );
}
