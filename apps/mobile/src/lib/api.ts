import { API_URL } from './config';
import { useSession } from './session';

export { API_URL };

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
