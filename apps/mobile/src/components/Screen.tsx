import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '@/theme';
import { IconButton, T } from './ui';

/** Top bar used by every stack screen: consistent back behaviour and title. */
export function Header({ title, onBack, right, subtitle, back = true }: { title?: string; subtitle?: string; onBack?: () => void; right?: ReactNode; back?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs }}>
        {back ? (
          <IconButton icon="chevron-back" label="Back" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />
        ) : (
          <View style={{ width: space.md }} />
        )}
        <View style={{ flex: 1, alignItems: back ? 'center' : 'flex-start' }}>
          {!!title && (
            <T variant="subheading" numberOfLines={1} accessibilityRole="header">
              {title}
            </T>
          )}
          {!!subtitle && (
            <T variant="small" color="textMuted" numberOfLines={1}>
              {subtitle}
            </T>
          )}
        </View>
        <View style={{ minWidth: 44, flexDirection: 'row', justifyContent: 'flex-end' }}>{right}</View>
      </View>
    </View>
  );
}

/** Scrollable screen body with consistent gutters. */
export function Body({ children, style, footer, ...rest }: ScrollViewProps & { children: ReactNode; style?: StyleProp<ViewStyle>; footer?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[{ padding: space.xl, gap: space.xl, paddingBottom: footer ? space.xl : insets.bottom + space.xxxl }, style]}
        {...rest}>
        {children}
      </ScrollView>
      {footer && <Footer>{footer}</Footer>}
    </View>
  );
}

/** Sticky action area at the bottom of a screen. Keeps the next action in thumb reach. */
export function Footer({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.md), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border, gap: space.sm }}>
      {children}
    </View>
  );
}
