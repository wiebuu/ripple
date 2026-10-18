import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { API_URL } from './config';
import type { AppNotification } from '@shared';
import { patchCampaignEverywhere, queryClient } from './queries';
import { useSession } from './session';

/** Sent by the API when a backing settles. `name` is set only for backers who chose to be shown. */
export type LiveBacked = { type: 'backed'; campaignId: string; raised: number; backerCount: number; name: string | null };
/** A notification for the signed-in user, sent the moment it's created. */
type LiveNotification = { type: 'notification'; notification: AppNotification };

/**
 * One shared WebSocket to the API's `/live` endpoint. Screens subscribe to the
 * campaigns they show; new totals are written straight into the query cache,
 * so every card and page showing that campaign updates at once. While someone
 * is signed in, the socket also carries their notifications as they happen.
 * It reconnects with backoff, closes in the background and when nothing needs
 * it, and re-authenticates and resubscribes after every reconnect.
 */
const listeners = new Map<string, Set<(e: LiveBacked) => void>>();
const statusListeners = new Set<(connected: boolean) => void>();
let socket: WebSocket | null = null;
let connected = false;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
/** The account's API token while the app wants personal events (see useLiveAccount). */
let authToken: string | null = null;
const notificationListeners = new Set<(n: AppNotification) => void>();
const wanted = () => listeners.size > 0 || !!authToken;

const liveUrl = () => `${API_URL.replace(/^http/, 'ws')}/live`;

function setConnected(v: boolean) {
  connected = v;
  statusListeners.forEach((f) => f(v));
}

function send(msg: { type: 'sub' | 'unsub'; campaignId: string } | { type: 'auth'; token: string | null }) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function connect() {
  clearTimeout(retryTimer);
  if (socket || !wanted() || AppState.currentState === 'background') return;
  const ws = new WebSocket(liveUrl());
  socket = ws;
  ws.onopen = () => {
    attempt = 0;
    setConnected(true);
    if (authToken) send({ type: 'auth', token: authToken });
    for (const id of listeners.keys()) send({ type: 'sub', campaignId: id });
  };
  ws.onmessage = (m) => {
    let e: LiveBacked | LiveNotification;
    try {
      e = JSON.parse(String(m.data));
    } catch {
      return;
    }
    if (e.type === 'notification') {
      // Refresh the Activity list and unread badge, then let the banner show it.
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      const n = e.notification;
      notificationListeners.forEach((f) => f(n));
      return;
    }
    if (e.type !== 'backed') return;
    patchCampaignEverywhere(e.campaignId, { raised: e.raised, backerCount: e.backerCount });
    listeners.get(e.campaignId)?.forEach((f) => f(e));
  };
  ws.onerror = () => ws.close();
  ws.onclose = () => {
    if (socket === ws) socket = null;
    setConnected(false);
    // Back off 1s, 2s, 4s … up to 30s while something is still being watched.
    if (wanted()) retryTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt++));
  };
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    attempt = 0;
    connect();
  } else if (state === 'background') socket?.close();
});

function subscribe(id: string, f: (e: LiveBacked) => void) {
  clearTimeout(idleTimer);
  const first = !listeners.has(id);
  if (first) listeners.set(id, new Set());
  listeners.get(id)!.add(f);
  if (!socket) connect();
  else if (first) send({ type: 'sub', campaignId: id });
  return () => {
    const set = listeners.get(id);
    set?.delete(f);
    if (set && !set.size) {
      listeners.delete(id);
      send({ type: 'unsub', campaignId: id });
    }
    // Keep the socket briefly so moving between screens doesn't reconnect each time.
    if (!wanted()) idleTimer = setTimeout(() => !wanted() && socket?.close(), 10_000);
  };
}

/** Watches one campaign live. Returns whether the live connection is up; `onBacked` runs for each new backing. */
export function useLiveCampaign(id: string | undefined, onBacked?: (e: LiveBacked) => void) {
  const [isLive, setLive] = useState(connected);
  const handler = useRef(onBacked);
  useEffect(() => {
    handler.current = onBacked;
  });
  useEffect(() => {
    if (!id) return;
    statusListeners.add(setLive);
    const off = subscribe(id, (e) => handler.current?.(e));
    return () => {
      statusListeners.delete(setLive);
      off();
    };
  }, [id]);
  return isLive;
}

/**
 * Keeps the live connection signed in as the current account, so its
 * notifications arrive the moment they're created. Mount once (tabs layout).
 */
export function useLiveAccount() {
  const token = useSession((s) => s.token);
  useEffect(() => {
    authToken = token;
    if (!token) {
      send({ type: 'auth', token: null });
      if (!wanted()) socket?.close();
      return;
    }
    if (socket) send({ type: 'auth', token });
    else connect();
  }, [token]);
}

/** Runs `f` for each notification that arrives live. */
export function useLiveNotifications(f: (n: AppNotification) => void) {
  const handler = useRef(f);
  useEffect(() => {
    handler.current = f;
  });
  useEffect(() => {
    const listener = (n: AppNotification) => handler.current(n);
    notificationListeners.add(listener);
    return () => {
      notificationListeners.delete(listener);
    };
  }, []);
}
