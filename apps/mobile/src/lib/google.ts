import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Expo Go can't load the native Google Sign-In module; it works in the APK / development builds. */
export const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type GoogleAvailability = { ok: true } | { ok: false; reason: string };

export function googleAvailability(): GoogleAvailability {
  if (Platform.OS === 'web') return { ok: false, reason: 'Google sign-in is available in the mobile app.' };
  if (inExpoGo) return { ok: false, reason: 'Google sign-in works in the installed Ripple app (APK). Expo Go can’t open Google’s sign-in screen.' };
  if (!webClientId) return { ok: false, reason: 'Google sign-in isn’t configured for this build yet.' };
  return { ok: true };
}

/**
 * Opens the native Google account picker and returns a Google ID token.
 * The module is required lazily so Expo Go never tries to load it.
 * Returns null if the user cancels.
 */
export async function getGoogleIdToken(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the native module is absent in Expo Go
  const { GoogleSignin, isErrorWithCode, statusCodes } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId, iosClientId });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return null;
    if (!res.data.idToken) throw new Error('Google didn’t return an ID token. Check the web client ID.');
    return res.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) return null;
    if (isErrorWithCode(e) && e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play services is not available on this device.');
    throw e;
  }
}

export async function googleSignOut() {
  if (inExpoGo || Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the native module is absent in Expo Go
    const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google; nothing to do.
  }
}
