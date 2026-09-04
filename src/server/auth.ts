import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { prisma } from './db';
import { evaluateSubscription } from './subscription';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error(
        'CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET environment variable is missing in production. You must configure JWT_SECRET in your Vercel Environment Variables.'
      );
    }
    console.warn('[SECURITY NOTICE] JWT_SECRET is not set in environment. Running in local development mode with temporary fallback secret. Set JWT_SECRET in .env for production.');
    return 'dev-local-temporary-jwt-secret-not-for-production';
  }
  return secret.trim();
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    isPremium: boolean;
  };
}

export function generateToken(user: { id: string; email: string; role: string; isPremium: boolean }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, isPremium: user.isPremium },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

let cachedFirebaseConfig: { projectId: string; apiKey: string } | null = null;

function getFirebaseConfig(): { projectId: string; apiKey: string } {
  if (cachedFirebaseConfig) return cachedFirebaseConfig;

  let projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
  let apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!projectId && parsed.projectId) projectId = parsed.projectId;
      if (!apiKey && parsed.apiKey) apiKey = parsed.apiKey;
    }
  } catch (err) {
    console.warn('Notice reading firebase-applet-config.json:', err);
  }

  if (!projectId) projectId = 'gen-lang-client-0891492608';
  if (!apiKey) apiKey = 'AIzaSyBKwIQiz76hzF68XmMF2LyWVIWoDg-55So';

  cachedFirebaseConfig = { projectId, apiKey };
  return cachedFirebaseConfig;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  name?: string;
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseUser | null> {
  if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
    return null;
  }

  const { projectId, apiKey } = getFirebaseConfig();

  // Inspect decoded token header and payload
  const decoded = jwt.decode(token, { complete: true }) as any;
  if (!decoded || !decoded.payload) {
    return null;
  }

  const payload = decoded.payload;
  const nowInSeconds = Math.floor(Date.now() / 1000);

  // Expiration check
  if (payload.exp && payload.exp < nowInSeconds) {
    return null;
  }

  const isFirebaseIssuer = typeof payload.iss === 'string' && payload.iss.includes('securetoken.google.com');
  const isCorrectAudience = !projectId || payload.aud === projectId;

  if (!isFirebaseIssuer && !isCorrectAudience) {
    return null;
  }

  // Official verification against Google Identity Toolkit endpoint
  if (apiKey) {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
        }
      );

      if (response.ok) {
        const data = await response.json() as any;
        const fbUser = data?.users?.[0];
        if (fbUser && fbUser.email) {
          return {
            uid: fbUser.localId,
            email: fbUser.email.toLowerCase().trim(),
            name: fbUser.displayName || payload.name || fbUser.email.split('@')[0],
          };
        }
      }
    } catch (netErr) {
      console.warn('Google Identity Toolkit lookup notice:', netErr);
    }
  }

  // Fallback if network is unavailable but token is structurally valid and unexpired
  if (isFirebaseIssuer && isCorrectAudience && payload.email) {
    return {
      uid: payload.sub || payload.user_id || `fb_${Date.now()}`,
      email: String(payload.email).toLowerCase().trim(),
      name: payload.name || payload.email.split('@')[0],
    };
  }

  return null;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token missing' });
    return;
  }

  // 1. Primary: Verify application JWT signed with JWT_SECRET
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      role: string;
      isPremium: boolean;
    };
    req.user = decoded;
    return next();
  } catch (err) {
    // 2. Fallback: Check if client supplied a Firebase ID token
    try {
      const fbUser = await verifyFirebaseIdToken(token);
      if (fbUser && fbUser.email) {
        const normalizedEmail = fbUser.email.toLowerCase().trim();
        const isAdmin = ADMIN_EMAILS.includes(normalizedEmail);

        let dbUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!dbUser) {
          const randomPassword = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10);
          dbUser = await prisma.user.create({
            data: {
              name: fbUser.name || normalizedEmail.split('@')[0],
              email: normalizedEmail,
              password: randomPassword,
              role: isAdmin ? 'ADMIN' : 'STUDENT',
              isPremium: isAdmin,
              premiumSince: isAdmin ? new Date() : null,
            },
          });
        } else if (isAdmin && (dbUser.role !== 'ADMIN' || !dbUser.isPremium)) {
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: { role: 'ADMIN', isPremium: true, premiumSince: new Date() },
          });
        }

        const sub = evaluateSubscription(dbUser);
        const appPayload = {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
          isPremium: sub.isPremium,
        };

        req.user = appPayload;

        // Provide upgraded application JWT in header
        const upgradedToken = generateToken(appPayload);
        res.setHeader('x-application-token', upgradedToken);
        res.setHeader('Access-Control-Expose-Headers', 'x-application-token');

        return next();
      }
    } catch (fbErr) {
      console.warn('Firebase token verification error in authenticateToken:', fbErr);
    }

    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export const ADMIN_EMAILS = [
  'admin@rgukt.ac.in',
  'rvinodh45@gmail.com',
  'avinashinapakurthi31@gmail.com',
  'jaan546jaan@gmail.com',
];

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user || !req.user.id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true },
    });

    if (!dbUser) {
      res.status(401).json({ error: 'User account not found' });
      return;
    }

    const userEmail = dbUser.email?.toLowerCase().trim();
    const isAuthorizedEmail = userEmail ? ADMIN_EMAILS.includes(userEmail) : false;

    if (dbUser.role !== 'ADMIN' && !isAuthorizedEmail) {
      res.status(403).json({ error: 'Admin authorization required' });
      return;
    }

    // Reflect verified role on request
    req.user.role = 'ADMIN';
    next();
  } catch (err) {
    console.error('Database query error in requireAdmin:', err);
    res.status(500).json({ error: 'Failed to verify admin authorization' });
  }
}

export async function requirePremium(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Admins bypass premium check
  if (req.user.role === 'ADMIN') {
    next();
    return;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, isPremium: true, premiumSince: true, role: true },
    });

    if (!dbUser) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    if (dbUser.role === 'ADMIN') {
      req.user.role = 'ADMIN';
      req.user.isPremium = true;
      next();
      return;
    }

    const sub = evaluateSubscription(dbUser);

    if (sub.isPremium) {
      req.user.isPremium = true;
      next();
      return;
    }

    // If subscription was marked true in DB but has passed 365 days, sync DB
    if (dbUser.isPremium && sub.status === 'EXPIRED') {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { isPremium: false },
      });
      req.user.isPremium = false;
      res.status(402).json({
        code: 'PREMIUM_EXPIRED',
        error: 'Your 365-day Premium membership subscription has expired. Please renew your subscription to continue.',
      });
      return;
    }
  } catch (err) {
    console.error('Database query error in requirePremium:', err);
  }

  res.status(402).json({
    code: 'PREMIUM_REQUIRED',
    error: 'Premium subscription required. Please activate or renew your ₹3000 subscription for 365 days of full platform access.',
  });
}

