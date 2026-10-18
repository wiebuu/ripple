import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { WebSocket, WebSocketServer } from 'ws';
import type { AppNotification } from '../../../../shared';
import { db } from './db';
import { env } from './env';

/**
 * Live campaign updates over WebSockets.
 *
 * Clients connect to `/live` and send `{ "type": "sub", "campaignId": "…" }`
 * (or `unsub`). When a backing settles, everyone watching that campaign gets
 * `{ type: 'backed', campaignId, raised, backerCount, name }` straight away.
 * `name` is only set for backers who chose to be shown publicly; amounts are
 * never sent.
 */
export type LiveEvent = { type: 'backed'; campaignId: string; raised: number; backerCount: number; name: string | null };
/** Sent only to the signed-in user it belongs to, the moment it's created. */
export type UserEvent = { type: 'notification'; notification: AppNotification };

const rooms = new Map<string, Set<WebSocket>>();
/** Each user's open connections (phone, tablet …), after they send `{ type: 'auth', token }`. */
const users = new Map<string, Set<WebSocket>>();
const userOf = new WeakMap<WebSocket, string>();
const alive = new WeakMap<WebSocket, boolean>();

function signOut(ws: WebSocket) {
  const id = userOf.get(ws);
  if (!id) return;
  users.get(id)?.delete(ws);
  if (!users.get(id)?.size) users.delete(id);
  userOf.delete(ws);
}

function leaveAll(ws: WebSocket) {
  for (const [id, room] of rooms) {
    room.delete(ws);
    if (!room.size) rooms.delete(id);
  }
  signOut(ws);
}

export function attachLive(server: Server) {
  const wss = new WebSocketServer({ server, path: '/live', maxPayload: 4 * 1024 });
  wss.on('connection', (ws) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('message', (raw) => {
      let msg: { type?: string; campaignId?: unknown; token?: unknown };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      // The same bearer token the API uses; a bad or missing one just means no personal events.
      if (msg.type === 'auth') {
        signOut(ws);
        if (typeof msg.token !== 'string') return;
        try {
          const { sub } = jwt.verify(msg.token, env.jwtSecret) as { sub: string };
          userOf.set(ws, sub);
          if (!users.has(sub)) users.set(sub, new Set());
          users.get(sub)!.add(ws);
        } catch {
          // Invalid or expired token.
        }
        return;
      }
      if (typeof msg.campaignId !== 'string' || !/^[a-f0-9]{24}$/.test(msg.campaignId)) return;
      if (msg.type === 'sub') {
        // One connection watches a handful of screens at most; cap it so a client can't hog memory.
        let count = 0;
        for (const room of rooms.values()) if (room.has(ws)) count++;
        if (count >= 20) return;
        if (!rooms.has(msg.campaignId)) rooms.set(msg.campaignId, new Set());
        rooms.get(msg.campaignId)!.add(ws);
      } else if (msg.type === 'unsub') {
        rooms.get(msg.campaignId)?.delete(ws);
      }
    });
    ws.on('close', () => leaveAll(ws));
    ws.on('error', () => leaveAll(ws));
  });
  // Drop connections that stopped answering (phone went offline, app killed) so rooms stay accurate.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        leaveAll(ws);
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, 30_000);
  wss.on('close', () => clearInterval(heartbeat));
  if (env.liveDemo) startDemoActivity();
  return wss;
}

export function publishToUser(userId: string, event: UserEvent) {
  const data = JSON.stringify(event);
  for (const ws of users.get(userId) ?? []) if (ws.readyState === WebSocket.OPEN) ws.send(data);
}

export function publish(event: LiveEvent) {
  const room = rooms.get(event.campaignId);
  if (!room) return;
  const data = JSON.stringify(event);
  for (const ws of room) if (ws.readyState === WebSocket.OPEN) ws.send(data);
}

const DEMO_NAMES = ['Priya', 'Arjun', 'Meera', 'Rohan', 'Ananya', 'Kabir', 'Isha', 'Dev', 'Sara', 'Vikram', 'Nisha', 'Aditya'];
const DEMO_AMOUNTS = [100, 250, 500, 500, 1000];

/**
 * Sample campaigns get an occasional simulated backer while someone is
 * watching them, so the live updates can be seen with a single phone. Only
 * campaigns flagged `isDemo` (already labelled as demonstration data in the
 * app) are touched, and never pushed past their goal.
 */
function startDemoActivity() {
  const tick = async () => {
    const watched = [...rooms.entries()].filter(([, room]) => room.size > 0).map(([id]) => id);
    if (!watched.length) return;
    const id = watched[Math.floor(Math.random() * watched.length)];
    const c = await db.campaign.findUnique({ where: { id }, select: { isDemo: true, status: true, raised: true, goal: true } });
    const amount = DEMO_AMOUNTS[Math.floor(Math.random() * DEMO_AMOUNTS.length)];
    if (!c?.isDemo || c.status !== 'FUNDING' || !c.goal || c.raised + amount >= c.goal) return;
    const updated = await db.campaign.update({ where: { id }, data: { raised: { increment: amount }, backerCount: { increment: 1 } }, select: { raised: true, backerCount: true } });
    // Most backers stay private, as in real campaigns.
    const name = Math.random() < 0.6 ? DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)] : null;
    publish({ type: 'backed', campaignId: id, raised: updated.raised, backerCount: updated.backerCount, name });
  };
  const loop = () => {
    setTimeout(() => {
      tick()
        .catch((e) => console.error('[live demo]', e.message))
        .finally(loop);
    }, 12_000 + Math.random() * 18_000);
  };
  loop();
}
