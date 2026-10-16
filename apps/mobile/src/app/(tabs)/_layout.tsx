import { Tabs } from 'expo-router';
import { Icon, type IconName } from '@/components/ui';
import { useNotifications } from '@/lib/queries';
import { fonts, useTheme } from '@/theme';

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ color, focused }: { color: any; focused: boolean }) => <Icon name={focused ? iconActive : icon} size={24} color={color} />,
});

/** Five stable primary destinations. */
export default function TabsLayout() {
  const { c } = useTheme();
  const unread = useNotifications().data?.unread ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11 },
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, paddingTop: 4 },
      }}>
      <Tabs.Screen name="index" options={tab('Home', 'home-outline', 'home')} />
      <Tabs.Screen name="explore" options={tab('Explore', 'search-outline', 'search')} />
      <Tabs.Screen name="create" options={tab('Create', 'add-circle-outline', 'add-circle')} />
      <Tabs.Screen
        name="activity"
        options={{ ...tab('Activity', 'notifications-outline', 'notifications'), tabBarBadge: unread ? (unread > 9 ? '9+' : unread) : undefined, tabBarBadgeStyle: { backgroundColor: c.accent, fontSize: 10 } }}
      />
      <Tabs.Screen name="profile" options={tab('Profile', 'person-circle-outline', 'person-circle')} />
    </Tabs>
  );
}
