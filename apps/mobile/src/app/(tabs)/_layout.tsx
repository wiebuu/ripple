import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Icon, haptic, type IconName } from '@/components/ui';
import { useNotifications } from '@/lib/queries';
import { shadow, useTheme } from '@/theme';

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ color, focused }: { color: any; focused: boolean }) => <Icon name={focused ? iconActive : icon} size={26} color={color} />,
});

/** Raised round button for the primary creator action. */
function CreateButton({ onPress, accessibilityState }: { onPress?: (e: any) => void; accessibilityState?: { selected?: boolean } }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a campaign"
        accessibilityState={accessibilityState}
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => [
          // Ring is a surface-coloured outer circle rather than a border, so the fill can't bleed past its edge.
          { width: 58, height: 58, borderRadius: 29, marginTop: -18, padding: 4, backgroundColor: c.surface, transform: [{ scale: pressed ? 0.94 : 1 }] },
          shadow.card,
        ]}>
        <View style={{ flex: 1, borderRadius: 25, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="add" size={30} color={c.onPrimary} />
        </View>
      </Pressable>
    </View>
  );
}

/** Five stable primary destinations. Icons only; each tab keeps an accessibility label. */
export default function TabsLayout() {
  const { c } = useTheme();
  const unread = useNotifications().data?.unread ?? 0;
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.light() }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // Android lifts the tab bar above the keyboard (e.g. typing in Explore's search); keep it out of the way.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, paddingTop: 6 },
      }}>
      <Tabs.Screen name="index" options={tab('Home', 'home-outline', 'home')} />
      <Tabs.Screen name="explore" options={tab('Explore', 'search-outline', 'search')} />
      <Tabs.Screen name="create" options={{ title: 'Create', tabBarButton: (props) => <CreateButton onPress={props.onPress} accessibilityState={props.accessibilityState} /> }} />
      <Tabs.Screen
        name="activity"
        options={{ ...tab('Activity', 'notifications-outline', 'notifications'), tabBarBadge: unread ? (unread > 9 ? '9+' : unread) : undefined, tabBarBadgeStyle: { backgroundColor: c.primary, color: c.onPrimary, fontSize: 10, fontWeight: '700', minWidth: 18, height: 18, lineHeight: 18, borderRadius: 9 } }}
      />
      <Tabs.Screen name="profile" options={tab('Profile', 'person-circle-outline', 'person-circle')} />
    </Tabs>
  );
}
