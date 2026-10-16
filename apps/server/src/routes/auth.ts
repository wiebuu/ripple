import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, signToken } from '../lib/auth';
import { db } from '../lib/db';
import { ah, HttpError } from '../lib/http';
import { notify } from '../lib/notify';
import { env } from '../lib/env';

/**
 * Demo authentication. Browsing needs no account; the app silently creates a
 * guest identity so guests can back campaigns and keep receipts. "Sign in"
 * attaches a name and email to that identity (no passwords in this prototype).
 */
export const auth = Router();

const publicUser = (u: { id: string; name: string; email: string | null; role: string; isGuest: boolean }) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, isGuest: u.isGuest,
});

auth.post(
  '/guest',
  ah(async (_req, res) => {
    const u = await db.user.create({ data: { name: 'Guest', isGuest: true } });
    res.status(201).json({ token: signToken(u.id), user: publicUser(u) });
  }),
);

auth.post(
  '/sign-in',
  ah(async (req, res) => {
    const { name, email } = z.object({ name: z.string().trim().min(1).max(60), email: z.email().toLowerCase() }).parse(req.body);
    const existing = await db.user.findFirst({ where: { email } });
    if (existing) {
      if (existing.role === 'REVIEWER') throw new HttpError(403, 'Reviewer accounts use the reviewer demo sign-in');
      await notify(existing.id, { kind: 'SECURITY', title: 'New sign-in', body: 'Your account was signed in on a new device. If this was not you, contact support.' });
      return res.json({ token: signToken(existing.id), user: publicUser(existing) });
    }
    // Upgrade the current guest identity so their drafts and receipts carry over.
    const guestId = req.user?.isGuest ? req.user.id : null;
    const u = guestId
      ? await db.user.update({ where: { id: guestId }, data: { name, email, isGuest: false } })
      : await db.user.create({ data: { name, email, isGuest: false } });
    res.json({ token: signToken(u.id), user: publicUser(u) });
  }),
);

/**
 * Google sign-in through Firebase Authentication. The app sends the Google ID
 * token it received; Firebase verifies it and returns the Firebase user, which
 * we link to (or create as) a Ripple account.
 */
auth.post(
  '/google',
  ah(async (req, res) => {
    const { idToken } = z.object({ idToken: z.string().min(20).max(4096) }).parse(req.body);
    if (!env.firebaseWebApiKey) throw new HttpError(503, 'Google sign-in is not configured on the server');
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${env.firebaseWebApiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postBody: `id_token=${encodeURIComponent(idToken)}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true, returnIdpCredential: true }),
    });
    const fb = (await r.json()) as { localId?: string; email?: string; displayName?: string; photoUrl?: string; emailVerified?: boolean; error?: { message: string } };
    if (!r.ok || !fb.localId) throw new HttpError(401, 'Google sign-in failed. Please try again.', fb.error?.message);
    if (!fb.email || fb.emailVerified === false) throw new HttpError(401, 'Your Google account email is not verified');
    const email = fb.email.toLowerCase();
    const name = fb.displayName?.trim() || email.split('@')[0];

    let user = (await db.user.findFirst({ where: { firebaseUid: fb.localId } })) ?? (await db.user.findFirst({ where: { email } }));
    if (user?.role === 'REVIEWER') throw new HttpError(403, 'Reviewer accounts use the reviewer sign-in');
    const guestId = req.user?.isGuest ? req.user.id : null;
    if (user) {
      user = await db.user.update({ where: { id: user.id }, data: { firebaseUid: fb.localId, avatarUrl: fb.photoUrl ?? user.avatarUrl, isGuest: false } });
      await notify(user.id, { kind: 'SECURITY', title: 'New sign-in with Google', body: 'Your account was signed in on a new device. If this was not you, contact support.' });
    } else if (guestId) {
      // Keep the guest's drafts and receipts.
      user = await db.user.update({ where: { id: guestId }, data: { name, email, firebaseUid: fb.localId, avatarUrl: fb.photoUrl ?? null, isGuest: false } });
    } else {
      user = await db.user.create({ data: { name, email, firebaseUid: fb.localId, avatarUrl: fb.photoUrl ?? null, isGuest: false } });
    }
    res.json({ token: signToken(user.id), user: publicUser(user) });
  }),
);

/** One-tap demo personas for the walkthrough video. */
auth.post(
  '/demo',
  ah(async (req, res) => {
    const { as } = z.object({ as: z.enum(['creator', 'reviewer']) }).parse(req.body);
    const u = await db.user.findFirst({ where: { email: as === 'creator' ? 'alex@demo.campaigns' : 'review@demo.campaigns' } });
    if (!u) throw new HttpError(500, 'Demo data is missing. Run the seed script.');
    res.json({ token: signToken(u.id), user: publicUser(u) });
  }),
);

auth.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const u = await db.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json(publicUser(u));
  }),
);

auth.patch(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(req.body);
    const u = await db.user.update({ where: { id: req.user!.id }, data: { name } });
    res.json(publicUser(u));
  }),
);
