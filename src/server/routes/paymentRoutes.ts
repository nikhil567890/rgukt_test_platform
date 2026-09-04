import { Router, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { prisma } from '../db';
import { authenticateToken, AuthRequest, generateToken } from '../auth';
import { evaluateSubscription } from '../subscription';

const router = Router();

const PREMIUM_AMOUNT = parseInt(process.env.PREMIUM_AMOUNT_PAISE || '300000', 10); // 3000 INR = 300000 paise

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  isConfigured: boolean;
  isKeyConfigured: boolean;
  isSecretConfigured: boolean;
  isLive: boolean;
  isTest: boolean;
  mode: 'LIVE' | 'TEST' | 'SIMULATION';
}

/**
 * Robust helper to read and sanitize Razorpay configuration from environment variables.
 * Handles both server and client prefixes, strips surrounding whitespace/quotes.
 */
export function getRazorpayConfig(): RazorpayConfig {
  const rawKeyId = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  const rawKeySecret = (process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '')
    .trim()
    .replace(/^["']|["']$/g, '');

  const isKeyConfigured = Boolean(rawKeyId && !rawKeyId.includes('sampleKey'));
  const isSecretConfigured = Boolean(rawKeySecret && !rawKeySecret.includes('sampleSecret'));
  const isConfigured = isKeyConfigured && isSecretConfigured;
  const isLive = rawKeyId.startsWith('rzp_live');
  const isTest = rawKeyId.startsWith('rzp_test');

  return {
    keyId: rawKeyId,
    keySecret: rawKeySecret,
    isConfigured,
    isKeyConfigured,
    isSecretConfigured,
    isLive,
    isTest,
    mode: isLive ? 'LIVE' : isTest ? 'TEST' : 'SIMULATION',
  };
}

/**
 * Lazy client factory for Razorpay SDK.
 */
export function getRazorpayClient(): Razorpay | null {
  const config = getRazorpayConfig();
  if (!config.isConfigured) {
    return null;
  }
  try {
    return new Razorpay({
      key_id: config.keyId,
      key_secret: config.keySecret,
    });
  } catch (err) {
    console.error('[Razorpay] Failed to initialize SDK client:', err);
    return null;
  }
}

// Non-sensitive configuration / health inspection endpoint
router.get('/config', (_req, res) => {
  const config = getRazorpayConfig();
  res.json({
    configured: config.isConfigured,
    mode: config.mode,
    keyPrefix: config.keyId ? `${config.keyId.substring(0, 8)}...` : null,
    hasSecret: config.isSecretConfigured,
    amountPaise: PREMIUM_AMOUNT,
    amountINR: PREMIUM_AMOUNT / 100,
    currency: 'INR',
  });
});

// Create Razorpay Order
router.post('/create-order', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user is already an active premium user
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user?.role === 'ADMIN') {
      res.status(400).json({ error: 'Administrator accounts already have permanent full access.' });
      return;
    }

    if (user?.isPremium) {
      const sub = evaluateSubscription(user);
      if (sub.isPremium && (sub.daysRemaining ?? 0) > 30) {
        res.status(400).json({
          error: `You already have an active 365-day Premium subscription with ${sub.daysRemaining} days remaining. Early renewal is available within the final 30 days.`,
        });
        return;
      }
    }

    const config = getRazorpayConfig();
    const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

    console.log(
      `[Razorpay /create-order] User: ${req.user.id}, Mode: ${config.mode}, KeyPrefix: ${
        config.keyId ? `${config.keyId.substring(0, 8)}...` : 'NONE'
      }, HasSecret: ${config.isSecretConfigured}, IsProd: ${isProduction}`
    );

    // Enforce environment variable presence in production
    if (isProduction && !config.isConfigured) {
      if (!config.isKeyConfigured) {
        console.error('[Razorpay CRITICAL] RAZORPAY_KEY_ID is missing or set to placeholder in production');
        res.status(500).json({
          error: 'Razorpay configuration error: RAZORPAY_KEY_ID is not configured in production environment variables.',
        });
        return;
      }
      if (!config.isSecretConfigured) {
        console.error('[Razorpay CRITICAL] RAZORPAY_KEY_SECRET is missing or set to placeholder in production');
        res.status(500).json({
          error: 'Razorpay configuration error: RAZORPAY_KEY_SECRET is not configured in production environment variables.',
        });
        return;
      }
    }

    let orderId = '';
    const client = getRazorpayClient();

    if (client) {
      try {
        console.log(`[Razorpay] Requesting order creation from Razorpay API (${config.mode} mode)...`);
        const receiptId = `rcpt_${req.user.id.replace(/-/g, '').substring(0, 8)}_${Date.now()}`.substring(0, 40);
        const order = await client.orders.create({
          amount: PREMIUM_AMOUNT,
          currency: 'INR',
          receipt: receiptId,
          notes: {
            userId: req.user.id,
            userEmail: req.user.email || '',
            purpose: 'RGUKT TestPrep Premium Membership',
          },
        });
        orderId = order.id;
        console.log(`[Razorpay] Successfully created order on Razorpay gateway: ${orderId}, amount: ${order.amount}`);
      } catch (err: any) {
        const errorDesc = err?.error?.description || err?.message || 'Gateway order creation failure';
        const errorCode = err?.error?.code || 'GATEWAY_ORDER_CREATION_FAILED';
        console.error(`[Razorpay Order Error] Mode: ${config.mode}, KeyPrefix: ${config.keyId.substring(0, 8)}..., Details:`, err);

        // In production or when using live credentials, NEVER return a fake order_sim_ ID with HTTP 200.
        // Doing so causes Razorpay Checkout in the browser to crash with "Oops! Something went wrong."
        if (isProduction || config.isLive) {
          res.status(502).json({
            error: `Razorpay order creation failed: ${errorDesc}`,
            code: errorCode,
            description: errorDesc,
            source: err?.error?.source || 'gateway',
            step: err?.error?.step || 'order_creation',
            reason: err?.error?.reason || 'order_failed',
          });
          return;
        }

        // Only in local development fallback to simulation
        console.warn('[Razorpay] Non-production local fallback to simulated order');
        orderId = `order_sim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      }
    } else {
      if (isProduction) {
        res.status(500).json({
          error: 'Razorpay client could not be initialized in production. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
        });
        return;
      }
      orderId = `order_sim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    }

    // Save payment record in DB
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        razorpayOrderId: orderId,
        amount: PREMIUM_AMOUNT,
        status: 'CREATED',
      },
    });

    res.json({
      orderId,
      id: orderId,
      amount: PREMIUM_AMOUNT,
      currency: 'INR',
      keyId: config.keyId,
      key: config.keyId,
      user: {
        name: user?.name,
        email: user?.email,
      },
    });
  } catch (err: any) {
    console.error('Error creating payment order:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Verify Payment Signature
router.post('/verify', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      res.status(400).json({ error: 'Missing payment details for verification' });
      return;
    }

    let isSignatureValid = false;
    const config = getRazorpayConfig();
    const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

    console.log(`[Razorpay /verify] Verifying payment for order ${razorpayOrderId}, payment ${razorpayPaymentId}. Mode: ${config.mode}`);

    if (isProduction || config.isConfigured) {
      if (!config.isSecretConfigured) {
        console.error('[Razorpay CRITICAL] Secret missing during signature verification in production');
        res.status(500).json({ error: 'Razorpay payment gateway secret is not configured on production server' });
        return;
      }
      if (!razorpaySignature) {
        res.status(400).json({ error: 'Missing payment signature from gateway response' });
        return;
      }
      const generatedSignature = crypto
        .createHmac('sha256', config.keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      const generatedBuf = Buffer.from(generatedSignature, 'utf8');
      const signatureBuf = Buffer.from(razorpaySignature, 'utf8');
      isSignatureValid =
        generatedBuf.length === signatureBuf.length &&
        crypto.timingSafeEqual(generatedBuf, signatureBuf);
    } else {
      // Non-production local simulation mode
      if (razorpaySignature && config.isSecretConfigured) {
        const generatedSignature = crypto
          .createHmac('sha256', config.keySecret)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest('hex');
        isSignatureValid = generatedSignature === razorpaySignature;
      } else {
        // Fallback for simulated checkout in local dev without keys
        isSignatureValid = Boolean(
          razorpayOrderId.startsWith('order_sim_') ||
          razorpayPaymentId.startsWith('pay_sim_') ||
          razorpaySignature === 'simulated_test_signature_rgukt_2026'
        );
      }
    }

    if (!isSignatureValid) {
      res.status(400).json({ error: 'Invalid payment signature' });
      return;
    }

    // Update payment record in database
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId,
          status: 'PAID',
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          userId: req.user.id,
          razorpayOrderId,
          razorpayPaymentId,
          amount: PREMIUM_AMOUNT,
          status: 'PAID',
        },
      });
    }

    // Update user to premium
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isPremium: true,
        premiumSince: new Date(),
      },
    });

    // Generate fresh token with updated premium status
    const newToken = generateToken({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isPremium: true,
    });

    res.json({
      success: true,
      message: 'Payment verified successfully! Welcome to RGUKT TestPrep Premium.',
      isPremium: true,
      token: newToken,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isPremium: updatedUser.isPremium,
        premiumSince: updatedUser.premiumSince,
      },
    });
  } catch (err: any) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Check Payment Status
router.get('/status', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, isPremium: true, premiumSince: true },
    });

    const sub = user
      ? evaluateSubscription(user)
      : {
          isPremium: false,
          status: 'FREE',
          premiumSince: null,
          premiumExpiresAt: null,
          daysRemaining: 0,
          validityDays: 365,
        };

    res.json({
      isPremium: sub.isPremium,
      premiumSince: sub.premiumSince,
      subscription: sub,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error checking payment status' });
  }
});

export default router;
