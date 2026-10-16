import { router } from 'expo-router';
import { View } from 'react-native';
import { Header } from './Screen';
import { Button, EmptyState } from './ui';
import { useTheme } from '@/theme';

/** Placeholder for screens built in a later step, so no link is a dead end. */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={title} />
      <EmptyState icon="construct-outline" title="Coming in the next build step" body={body} action={<Button label="Go back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />} />
    </View>
  );
}
