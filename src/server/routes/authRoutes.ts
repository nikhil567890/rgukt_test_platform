import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { generateToken, authenticateToken, verifyFirebaseIdToken, AuthRequest, ADMIN_EMAILS } from '../auth';
import { evaluateSubscription } from '../subscription';

const router = Router();

// Helper to check if email is admin email
function isKnownAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

// Register new user
router.post('/register', async (req, res): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const isAdminEmail = isKnownAdminEmail(normalizedEmail);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: isAdminEmail ? 'ADMIN' : 'STUDENT',
        isPremium: isAdminEmail ? true : false,
        premiumSince: isAdminEmail ? new Date() : null,
      },
    });

    const sub = evaluateSubscription(user);

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isPremium: sub.isPremium,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isPremium: sub.isPremium,
        premiumSince: user.premiumSince,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
        subscription: sub,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login user
router.post('/login', async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Ensure admin role if listed in ADMIN_EMAILS
    if (isKnownAdminEmail(normalizedEmail) && (user.role !== 'ADMIN' || !user.isPremium)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN', isPremium: true, premiumSince: new Date() },
      });
    }

    let sub = evaluateSubscription(user);
    if (user.isPremium && sub.status === 'EXPIRED') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: false },
      });
      sub = evaluateSubscription(user);
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isPremium: sub.isPremium,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isPremium: sub.isPremium,
        premiumSince: user.premiumSince,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
        subscription: sub,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Google Sign-In Handler (supports both POST and GET for cross-origin/proxy compatibility)
const handleGoogleAuth = async (req: any, res: Response): Promise<void> => {
  try {
    const idToken = req.body?.idToken;
    let email = req.body?.email || req.query?.email;
    let name = req.body?.name || req.query?.name;

    // Check Authorization header for Bearer Firebase ID token if not in body
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.split(' ')[1];
    const candidateIdToken = idToken || (bearerToken && bearerToken.split('.').length === 3 ? bearerToken : null);

    if (candidateIdToken && typeof candidateIdToken === 'string') {
      const verifiedFb = await verifyFirebaseIdToken(candidateIdToken);
      if (verifiedFb && verifiedFb.email) {
        email = verifiedFb.email;
        if (!name || name === 'Google Student') {
          name = verifiedFb.name || email.split('@')[0];
        }
      } else if (idToken) {
        res.status(401).json({ error: 'Invalid or expired Firebase authentication token' });
        return;
      }
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ error: 'Valid email address is required for Google Sign-In' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isAdminEmail = isKnownAdminEmail(normalizedEmail);

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Create account for Google user automatically
      const displayName = typeof name === 'string' && name.trim() ? name.trim() : normalizedEmail.split('@')[0];
      const randomPassword = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10);
      
      user = await prisma.user.create({
        data: {
          name: displayName,
          email: normalizedEmail,
          password: randomPassword,
          role: isAdminEmail ? 'ADMIN' : 'STUDENT',
          isPremium: isAdminEmail ? true : false,
          premiumSince: isAdminEmail ? new Date() : null,
        },
      });
    } else if (isAdminEmail && (user.role !== 'ADMIN' || !user.isPremium)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN', isPremium: true, premiumSince: new Date() },
      });
    }

    let sub = evaluateSubscription(user);
    if (user.isPremium && sub.status === 'EXPIRED') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: false },
      });
      sub = evaluateSubscription(user);
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isPremium: sub.isPremium,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isPremium: sub.isPremium,
        premiumSince: user.premiumSince,
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        createdAt: user.createdAt,
        subscription: sub,
      },
    });
  } catch (err: any) {
    console.error('Google Sign-In Error:', err);
    res.status(500).json({ error: err?.message || 'Server error during Google Sign-In' });
  }
};

router.post('/google', handleGoogleAuth);
router.get('/google', handleGoogleAuth);
router.all('/google', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  if (req.method === 'POST' || req.method === 'GET') {
    return handleGoogleAuth(req, res);
  }
  next();
});

// Get current user info
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isPremium: true,
        premiumSince: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Auto-promote if admin email
    if (user.email && isKnownAdminEmail(user.email) && (user.role !== 'ADMIN' || !user.isPremium)) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN', isPremium: true, premiumSince: new Date() },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isPremium: true,
          premiumSince: true,
          currentStreak: true,
          longestStreak: true,
          createdAt: true,
        },
      });
      user = updated;
    }

    let sub = evaluateSubscription(user);
    if (user.isPremium && sub.status === 'EXPIRED') {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: false },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isPremium: true,
          premiumSince: true,
          currentStreak: true,
          longestStreak: true,
          createdAt: true,
        },
      });
      user = updated;
      sub = evaluateSubscription(user);
    }

    res.json({ user: { ...user, isPremium: sub.isPremium, subscription: sub } });
  } catch (err: any) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Server error fetching user details' });
  }
});

// Get comprehensive user Account & Payment Details
router.get('/account-details', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isPremium: true,
        premiumSince: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let sub = evaluateSubscription(user);
    if (user.isPremium && sub.status === 'EXPIRED') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: false },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isPremium: true,
          premiumSince: true,
          currentStreak: true,
          longestStreak: true,
          createdAt: true,
        },
      });
      sub = evaluateSubscription(user);
    }

    // Fetch user payment history
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        amount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const formattedPayments = payments.map((p) => ({
      ...p,
      amountINR: p.amount / 100, // convert paise to INR
      paymentMethod: p.razorpayPaymentId ? 'Razorpay Gateway' : 'Manual / Offline Verification',
      purpose: 'RGUKT CET Mathematics TestPrep 365-Day Subscription',
    }));

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
      },
      subscription: sub,
      payments: formattedPayments,
    });
  } catch (err: any) {
    console.error('Account details error:', err);
    res.status(500).json({ error: 'Failed to retrieve account and payment details' });
  }
});

export default router;

