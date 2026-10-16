import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import type { User } from '@shared';
import { Field } from '@/components/Field';
import { Body, Header } from '@/components/Screen';
import { Banner, Button, Card, Divider, T } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { getGoogleIdToken, googleAvailability } from '@/lib/google';
import { queryClient } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { space } from '@/theme';

/**
 * Demo sign-in: attaches a name and email to the current guest identity so
 * drafts and receipts carry over. No passwords in this prototype.
 */
export default function SignIn() {
  const setSession = useSession((s) => s.setSession);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  const done = (r: { token: string; user: User }, msg: string) => {
    setSession(r.token, r.user);
    queryClient.clear();
    toast(msg);
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  const signIn = async () => {
    setTried(true);
    if (!name.trim() || !emailOk) return;
    setBusy('email');
    try {
      done(await api('/auth/sign-in', { body: { name, email } }), `Signed in as ${name.trim()}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const google = googleAvailability();
  const withGoogle = async () => {
    setBusy('google');
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return; // cancelled
      const r = await api<{ token: string; user: User }>('/auth/google', { body: { idToken } });
      done(r, `Signed in as ${r.user.name}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const demo = async (as: 'creator' | 'reviewer') => {
    setBusy(as);
    try {
      const r = await api<{ token: string; user: User }>('/auth/demo', { body: { as }, auth: false });
      done(r, `Signed in as ${r.user.name}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Sign in" />
      <Body>
        <View style={{ gap: space.sm }}>
          <T variant="title">Keep your campaigns and receipts</T>
          <T color="textMuted">You can browse and back campaigns without an account. Signing in keeps your drafts, campaigns and payment history in one place.</T>
        </View>
        <View style={{ gap: space.sm }}>
          <Button label="Continue with Google" icon="logo-google" variant="secondary" size="lg" loading={busy === 'google'} disabled={!google.ok || !!busy} onPress={withGoogle} />
          {!google.ok && (
            <T variant="small" color="textMuted" center>
              {google.reason}
            </T>
          )}
        </View>
        <T variant="small" color="textSubtle" center>
          or continue with email
        </T>
        <Card style={{ gap: space.lg }}>
          <Field label="Your name" required value={name} onChangeText={setName} autoComplete="name" error={tried && !name.trim() ? 'Enter your name.' : undefined} />
          <Field label="Email" required value={email} onChangeText={(t) => setEmail(t.trim())} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={tried && !emailOk ? 'Enter a valid email address.' : undefined} />
          <Button label="Continue" size="lg" loading={busy === 'email'} disabled={!!busy} onPress={signIn} />
          <T variant="small" color="textMuted">
            Demo sign-in: no password or email verification in this prototype. Anything you did as a guest moves to this account.
          </T>
        </Card>
        <Divider />
        <View style={{ gap: space.sm }}>
          <T variant="overline" color="textMuted">
            Demo accounts
          </T>
          <Button label="Continue as Alex (creator with campaigns)" icon="person-outline" variant="secondary" loading={busy === 'creator'} disabled={!!busy} onPress={() => demo('creator')} />
          <Button label="Continue as Sam (review team)" icon="shield-checkmark-outline" variant="secondary" loading={busy === 'reviewer'} disabled={!!busy} onPress={() => demo('reviewer')} />
        </View>
        <Banner tone="neutral" icon="lock-closed-outline" body="Reviewer tools are only available to review-team accounts." />
      </Body>
    </View>
  );
}
