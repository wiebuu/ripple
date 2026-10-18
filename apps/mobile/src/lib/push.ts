import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { api } from './api';
import { useSession } from './session';

type Notifications = typeof import('expo-notifications');

/**
 * Push notifications. The server sends every in-app notification (approved,
 * milestones, ads live …) to the user's phones too, through Expo's push
 * service. Expo Go on Android can't receive remote pushes (removed in SDK 53),
 * and neither can simulators or the web, so those skip it; the APK has it.
 */
const supported = Platform.OS !== 'web' && Device.isDevice && !(Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

let mod: Notifications | null = null;
// Loaded lazily so Expo Go never touches the module where it isn't available.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = () => (mod ??= require('expo-notifications') as Notifications);
let deviceToken: string | null = null;

if (supported) {
  load().setNotificationHandler({
    // Shown as a banner even while the app is open (Android needs sound on for the heads-up banner).
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

async function register() {
  if (!supported || !projectId) return;
  const N = load();
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('default', { name: 'Campaign updates', importance: N.AndroidImportance.HIGH, lightColor: '#3FCF8E' });
  }
  let { status } = await N.getPermissionsAsync();
  if (status !== 'granted') status = (await N.requestPermissionsAsync()).status;
  if (status !== 'granted') return;
  deviceToken = (await N.getExpoPushTokenAsync({ projectId })).data;
  await api('/me/push-token', { body: { token: deviceToken, platform: Platform.OS, on: true } });
}

/** Stops pushes to this phone for the current account (call before signing out). */
export async function unregisterPush() {
  if (!deviceToken) return;
  await api('/me/push-token', { body: { token: deviceToken, platform: Platform.OS, on: false } }).catch(() => {});
}

/** Opens the campaign a notification is about, or Activity for general ones. */
function openFrom(response: import('expo-notifications').NotificationResponse) {
  const id = response.notification.request.content.data?.campaignId;
  if (typeof id === 'string' && id) router.push({ pathname: '/campaign/[id]', params: { id } });
  else router.navigate('/activity');
}

/**
 * Mounted once inside the tabs (so navigation is ready): registers this phone
 * for the signed-in account whenever the account changes, and opens the right
 * screen when a notification is tapped, including one that launched the app.
 */
export function usePushNotifications() {
  const userId = useSession((s) => s.user?.id);
  useEffect(() => {
    if (!userId) return;
    // A short pause so the permission prompt doesn't land on top of the first screen as it appears.
    const t = setTimeout(() => register().catch((e) => console.warn('[push]', e?.message)), 1500);
    return () => clearTimeout(t);
  }, [userId]);
  useEffect(() => {
    if (!supported) return;
    const N = load();
    // A tap that launched the app: open its screen once, then clear it so it isn't replayed.
    N.getLastNotificationResponseAsync().then((r) => {
      if (!r) return;
      openFrom(r);
      N.clearLastNotificationResponseAsync();
    });
    const sub = N.addNotificationResponseReceivedListener(openFrom);
    return () => sub.remove();
  }, []);
}
