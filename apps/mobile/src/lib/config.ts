import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL: EXPO_PUBLIC_API_URL in builds; in development, the machine
 * running Metro on port 4000 (works for simulators and devices on the LAN).
 */
function resolveBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

/** Lives on its own so api.ts and session.ts can both use it without importing each other. */
export const API_URL = resolveBaseUrl();
