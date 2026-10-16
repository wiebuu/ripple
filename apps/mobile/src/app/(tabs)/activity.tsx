import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, T } from '@/components/ui';
import { space, useTheme } from '@/theme';

export default function ActivityTab() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.md, paddingHorizontal: space.xl }}>
      <T variant="title" accessibilityRole="header">
        Activity
      </T>
      <EmptyState icon="notifications-outline" title="Coming in the next build step" body="Notifications, funding milestones and followed campaigns will appear here." />
    </View>
  );
}
