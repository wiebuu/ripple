import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, T } from '@/components/ui';
import { space, useTheme } from '@/theme';

export default function ProfileTab() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.md, paddingHorizontal: space.xl }}>
      <T variant="title" accessibilityRole="header">
        Profile
      </T>
      <EmptyState icon="person-circle-outline" title="Coming in the next build step" body="Your campaigns, backed and saved campaigns, payment history and settings will appear here." />
    </View>
  );
}
