import { useState, type ReactNode } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import { space, useTheme } from '@/theme';
import { Divider, Icon, T, type IconName } from './ui';

/** Expandable section for secondary information (use of funds, review process...). */
export function Accordion({ title, icon, summary, children, initiallyOpen = false, last }: { title: string; icon?: IconName; summary?: string; children: ReactNode; initiallyOpen?: boolean; last?: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen(!open);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md + 2, opacity: pressed ? 0.7 : 1 })}>
        {icon && <Icon name={icon} size={18} color={c.primary} />}
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">{title}</T>
          {summary && !open && (
            <T variant="small" color="textMuted" numberOfLines={1}>
              {summary}
            </T>
          )}
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
      </Pressable>
      {open && <View style={{ paddingBottom: space.md, gap: space.sm + 2 }}>{children}</View>}
      {!last && <Divider />}
    </View>
  );
}
