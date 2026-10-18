import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { API_URL } from './config';
import { patchCampaignEverywhere } from './queries';

/** Sent by the API when a backing settles. `name` is set only for backers who chose to be shown. */
export type LiveBacked = { type: 'backed'; campaignId: string; raised: number; backerCount: number; name: string | null };

/**
 * One shared WebSocket to the API's `/live` endpoint. Screens subscribe to the
 * campaigns they show; new totals are written straight into the query cache,
 * so every card and page showing that campaign updates at once. The socket
 * reconnects with backoff, closes in the background and when nothing is
 * watched, and resubscribes after every reconnect.
 */
const listeners = new Map<string, Set<(e: LiveBacked) => void>>();
const statusListeners = new Set<(connected: boolean) => void>();
let socket: WebSocket | null = null;
let connected = false;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

const liveUrl = () => `${API_URL.replace(/^http/, 'ws')}/live`;

function setConnected(v: boolean) {
  connected = v;
  statusListeners.forEach((f) => f(v));
}

function send(msg: { type: 'sub' | 'unsub'; campaignId: string }) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function connect() {
  clearTimeout(retryTimer);
  if (socket || !listeners.size || AppState.currentState === 'background') return;
  const ws = new WebSocket(liveUrl());
  socket = ws;
  ws.onopen = () => {
    attempt = 0;
    setConnected(true);
    for (const id of listeners.keys()) send({ type: 'sub', campaignId: id });
  };
  ws.onmessage = (m) => {
    let e: LiveBacked;
    try {
      e = JSON.parse(String(m.data));
    } catch {
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
    if (listeners.size) retryTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt++));
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
    if (!listeners.size) idleTimer = setTimeout(() => !listeners.size && socket?.close(), 10_000);
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
