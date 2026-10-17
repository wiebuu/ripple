import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useSession } from './session';

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

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any,
  ) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; auth?: boolean; form?: FormData; retried?: boolean };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const token = opts.auth === false ? null : await useSession.getState().ensureToken();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
      // Always ask the server: a refresh must show current data, never an HTTP-cached copy.
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
        ...(opts.form ? {} : { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your connection and try again.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token && !opts.retried && !path.startsWith('/auth')) {
      // The saved session is no longer valid: start a fresh guest session and retry once.
      useSession.getState().reset();
      return api<T>(path, { ...opts, retried: true });
    }
    if (res.status === 401) useSession.getState().reset();
    throw new ApiError(res.status, json?.error ?? 'Something went wrong', json?.details);
  }
  return json as T;
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong';
}
