import type { ReactNode } from 'react';
import { View } from 'react-native';
import { T } from '@/components/ui';
import { space } from '@/theme';

export const TAB_HEADER_HEIGHT = 56;

/**
 * The one header used by every main tab, so titles sit at the same height,
 * size and inset everywhere. Pass `title`, or `left` for custom content (the
 * Home wordmark). Children are the actions on the right. Use `flush` when the
 * parent already pads the sides (inside a padded ScrollView).
 */
export function TabHeader({ title, left, children, flush }: { title?: string; left?: ReactNode; children?: ReactNode; flush?: boolean }) {
  return (
    <View style={{ height: TAB_HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingLeft: flush ? 0 : space.xl, paddingRight: flush ? 0 : space.sm }}>
      <View style={{ flex: 1 }}>
        {left ?? (
          <T variant="title" accessibilityRole="header" numberOfLines={1}>
            {title}
          </T>
        )}
      </View>
      {children}
    </View>
  );
}
