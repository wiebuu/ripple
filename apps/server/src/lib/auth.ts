import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { env } from './env';
import { HttpError } from './http';

export type AuthUser = { id: string; name: string; role: 'USER' | 'REVIEWER'; isGuest: boolean };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '30d' });
}

/** Attaches req.user when a valid bearer token is present. Never rejects. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const { sub } = jwt.verify(header.slice(7), env.jwtSecret) as { sub: string };
      const u = await db.user.findUnique({ where: { id: sub } });
      if (u) req.user = { id: u.id, name: u.name, role: u.role as AuthUser['role'], isGuest: u.isGuest };
    } catch {
      // Invalid/expired token: treat as anonymous.
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
  next();
}

export function requireRole(role: AuthUser['role']) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
    if (req.user.role !== role) return next(new HttpError(403, 'Reviewer access only'));
    next();
  };
}
