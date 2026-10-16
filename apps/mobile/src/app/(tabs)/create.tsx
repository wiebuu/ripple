import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, T } from '@/components/ui';
import { space, useTheme } from '@/theme';

export default function CreateTab() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.md, paddingHorizontal: space.xl }}>
      <T variant="title" accessibilityRole="header">
        Create
      </T>
      <EmptyState icon="add-circle-outline" title="Coming in the next build step" body="Start a new campaign or resume a draft. The five-step creation flow is built in an upcoming step." />
    </View>
  );
}
