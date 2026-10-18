import { router } from 'expo-router';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Body, Header } from '@/components/Screen';
import { Card, Divider, Icon, ListRow, T, haptic, type IconName } from '@/components/ui';
import { useAppearance, type AppearanceMode } from '@/lib/appearance';
import { googleSignOut } from '@/lib/google';
import { queryClient, useBacked, useFollowing, useMyContributions, useSaved } from '@/lib/queries';
import { unregisterPush } from '@/lib/push';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type Item = { icon: IconName; title: string; subtitle?: string; onPress: () => void; danger?: boolean };

function Section({ title, items }: { title?: string; items: Item[] }) {
  return (
    <View style={{ gap: space.sm }}>
      {!!title && (
        <T variant="overline" color="textMuted">
          {title}
        </T>
      )}
      <Card padded={false} style={{ paddingHorizontal: space.lg }}>
        {items.map((it, i) => (
          <View key={it.title}>
            <ListRow icon={it.icon} title={it.title} subtitle={it.subtitle} onPress={it.onPress} danger={it.danger} />
            {i < items.length - 1 && <Divider />}
          </View>
        ))}
      </Card>
    </View>
  );
}

/** Light / dark / system switch. Applies instantly and is remembered on this device. */
function AppearanceSwitch() {
  const { c, dark } = useTheme();
  const mode = useAppearance((s) => s.mode);
  const setMode = useAppearance((s) => s.setMode);
  const options: { key: AppearanceMode; label: string; icon: IconName }[] = [
    { key: 'system', label: 'System', icon: 'contrast-outline' },
    { key: 'light', label: 'Light', icon: 'sun-outline' },
    { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];
  return (
    <View style={{ gap: space.sm }}>
      <T variant="overline" color="textMuted">
        Appearance
      </T>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
          {options.map((o) => {
            const sel = mode === o.key;
            return (
              <Pressable
                key={o.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`${o.label} appearance`}
                onPress={() => {
                  haptic.light();
                  setMode(o.key);
                }}
                style={({ pressed }) => ({ flex: 1, paddingVertical: space.md, borderRadius: radius.md, borderWidth: sel ? 1.5 : 1, borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primarySoft : c.surface, alignItems: 'center', gap: 6, opacity: pressed ? 0.8 : 1 })}>
                <Icon name={o.icon} size={22} color={sel ? c.primary : c.textMuted} weight={sel ? 'fill' : 'regular'} />
                <T variant="smallStrong" color={sel ? 'primary' : 'text'}>
                  {o.label}
                </T>
              </Pressable>
            );
          })}
        </View>
        <T variant="small" color="textMuted">
          {mode === 'system' ? `Following your phone (currently ${dark ? 'dark' : 'light'}).` : `Always ${mode}.`}
        </T>
      </Card>
    </View>
  );
}

/** Everything that used to be a long list on Profile: activity, settings, help and account actions. */
export default function Menu() {
  const user = useSession((s) => s.user);
  const reset = useSession((s) => s.reset);
  const backed = useBacked();
  const following = useFollowing();
  const saved = useSaved();
  const payments = useMyContributions();
  const guest = !user || user.isGuest;
  const info = (page: string) => () => router.push({ pathname: '/info/[page]', params: { page } });

  const signOut = () => {
    const go = async () => {
      await unregisterPush();
      googleSignOut();
      reset();
      queryClient.clear();
      toast('Signed out');
      router.back();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Sign out?', 'You can keep browsing as a guest.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: go }]);
  };

  const paymentCount = payments.data?.pages[0]?.total;

  return (
    <View style={{ flex: 1 }}>
      <Header title="Menu" />
      <Body>
        <AppearanceSwitch />
        <Section
          title="Your activity"
          items={[
            { icon: 'eye-outline', title: 'Following', subtitle: following.data ? `${plural(following.data.items.length, 'campaign')} · updates in Activity` : undefined, onPress: () => router.push('/following') },
            { icon: 'megaphone-outline', title: 'Backed campaigns', subtitle: backed.data ? plural(backed.data.items.length, 'campaign') : undefined, onPress: () => router.push('/backed') },
            { icon: 'bookmark-outline', title: 'Saved campaigns', subtitle: saved.data ? `${saved.data.items.length} saved` : undefined, onPress: () => router.push('/saved') },
            { icon: 'receipt-outline', title: 'Payment history', subtitle: paymentCount != null ? plural(paymentCount, 'payment') : undefined, onPress: () => router.push('/payments') },
          ]}
        />
        <Section
          title="Settings"
          items={[
            { icon: 'notifications-outline', title: 'Notifications', onPress: () => router.push('/settings/notifications') },
            { icon: 'shield-outline', title: 'Privacy', subtitle: 'Your backer name is private by default', onPress: info('privacy') },
          ]}
        />
        <Section
          title="Help & about"
          items={[
            { icon: 'help-circle-outline', title: 'Help', onPress: info('help') },
            { icon: 'book-outline', title: 'How Ripple works', onPress: info('how-it-works') },
            { icon: 'chatbubbles-outline', title: 'FAQs', onPress: info('faq') },
            { icon: 'information-circle-outline', title: 'About', onPress: info('about') },
            { icon: 'git-network-outline', title: 'Partners', onPress: info('partners') },
            { icon: 'people-outline', title: 'Community guidelines', onPress: info('guidelines') },
            { icon: 'document-text-outline', title: 'Terms & funding policy', onPress: info('terms') },
            { icon: 'mail-outline', title: 'Contact', onPress: info('contact') },
          ]}
        />
        <Section items={guest ? [{ icon: 'log-in-outline', title: 'Sign in', onPress: () => router.push('/sign-in') }] : [{ icon: 'log-out-outline', title: 'Sign out', danger: true, onPress: signOut }]} />
        <T variant="small" color="textSubtle" center>
          Ripple prototype · sample data · Razorpay test-mode payments
        </T>
      </Body>
    </View>
  );
}
