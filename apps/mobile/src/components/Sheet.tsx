import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, Easing, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '@/theme';
import { IconButton, T, haptic } from './ui';

const NATIVE = Platform.OS !== 'web';
/** Drag further than this (or flick down) to close. */
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 0.9;
/** Decelerating curve: the sheet keeps moving and settles softly, like iOS sheets. */
const EASE_OUT = Easing.bezier(0.2, 0, 0, 1);

/**
 * Bottom sheet for secondary detail and short forms.
 * The backdrop fades in and out on its own while the sheet slides; close by
 * tapping outside, the close button, or dragging the sheet down (from the
 * handle/header, or from the content when it is scrolled to the top).
 */
export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const offscreen = Dimensions.get('window').height;

  // Stay mounted through the closing animation, then unmount.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const [fade] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(offscreen));
  // Read only inside gesture callbacks: the content's scroll offset and the latest onClose.
  const scrollY = useRef(0);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
        Animated.spring(slide, { toValue: 0, damping: 26, stiffness: 260, mass: 0.9, useNativeDriver: NATIVE }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 220, easing: EASE_OUT, useNativeDriver: NATIVE }),
        Animated.timing(slide, { toValue: offscreen, duration: 280, easing: EASE_OUT, useNativeDriver: NATIVE }),
      ]).start(({ finished }) => finished && setMounted(false));
    }
  }, [visible, mounted, fade, slide, offscreen]);

  // The refs are only read inside the gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [{ pan, grab }] = useState(() => {
    const isDownDrag = (dx: number, dy: number) => dy > 6 && Math.abs(dy) > Math.abs(dx);
    const drag = {
      onPanResponderMove: (_: unknown, g: { dy: number }) => {
        const y = Math.max(0, g.dy);
        slide.setValue(y);
        fade.setValue(Math.max(0, 1 - y / 400));
      },
      onPanResponderRelease: (_: unknown, g: { dy: number; vy: number }) => {
        if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_VELOCITY) {
          // Finish the swipe in one continuous motion from where the finger let go
          // (faster flicks finish sooner), then tell the parent it closed.
          haptic.light();
          const duration = Math.max(160, Math.min(300, 300 - g.vy * 60));
          Animated.parallel([
            Animated.timing(slide, { toValue: offscreen, duration, easing: EASE_OUT, useNativeDriver: NATIVE }),
            Animated.timing(fade, { toValue: 0, duration, easing: EASE_OUT, useNativeDriver: NATIVE }),
          ]).start(() => closeRef.current());
        } else {
          Animated.parallel([
            Animated.spring(slide, { toValue: 0, damping: 24, stiffness: 300, useNativeDriver: NATIVE }),
            Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: NATIVE }),
          ]).start();
        }
      },
      onPanResponderTerminationRequest: () => false,
    };
    return {
      // Content: take over a downward drag only when it is scrolled to the top.
      pan: PanResponder.create({
        ...drag,
        onMoveShouldSetPanResponderCapture: (_, g) => isDownDrag(g.dx, g.dy) && scrollY.current <= 0,
        onMoveShouldSetPanResponder: (_, g) => isDownDrag(g.dx, g.dy),
      }),
      // Handle bar and title: grab the touch straight away so pulling the handle always works.
      grab: PanResponder.create({ ...drag, onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true }),
    };
  });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.overlay, opacity: fade }}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View
          {...pan.panHandlers}
          style={{ backgroundColor: c.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '88%', paddingBottom: insets.bottom + space.md, transform: [{ translateY: slide }] }}>
          <View {...grab.panHandlers}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }} accessibilityHint="Drag down to close">
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: space.xl, paddingRight: space.sm, paddingBottom: space.xs }}>
              <T variant="subheading" style={{ flex: 1 }} accessibilityRole="header">
                {title}
              </T>
              <IconButton icon="close" label="Close" onPress={onClose} />
            </View>
          </View>
          <ScrollView
            onScroll={(e) => {
              scrollY.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.lg }}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer && <View style={{ paddingHorizontal: space.xl, paddingTop: space.sm }}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
