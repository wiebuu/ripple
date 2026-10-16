import { router } from 'expo-router';
import { View } from 'react-native';
import { Header } from '@/components/Screen';
import { Button, EmptyState } from '@/components/ui';
import { useTheme } from '@/theme';

export default function NotFound() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Not found" />
      <EmptyState icon="compass-outline" title="This page doesn’t exist" body="The link may be out of date." action={<Button label="Go to Home" onPress={() => router.replace('/')} />} />
    </View>
  );
}
