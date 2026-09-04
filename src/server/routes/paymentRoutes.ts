import { Router, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { prisma } from '../db';
import { authenticateToken, AuthRequest, generateToken } from '../auth';
import { evaluateSubscription } from '../subscription';

const router = Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_sampleKey123';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'sampleSecretKey456';
const PREMIUM_AMOUNT = parseInt(process.env.PREMIUM_AMOUNT_PAISE || '300000', 10); // 3000 INR = 300000 paise

let razorpayInstance: Razorpay | null = null;
try {
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && !RAZORPAY_KEY_ID.includes('sampleKey')) {
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }
} catch (e) {
  console.log('Razorpay initialization fallback to simulation mode');
}

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

    let orderId = `order_sim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    if (razorpayInstance) {
      try {
        const order = await razorpayInstance.orders.create({
          amount: PREMIUM_AMOUNT,
          currency: 'INR',
          receipt: `rcpt_${req.user.id.substring(0, 8)}_${Date.now()}`,
          notes: {
            userId: req.user.id,
            purpose: 'RGUKT TestPrep Premium Membership',
          },
        });
        orderId = order.id;
      } catch (err) {
        console.warn('Razorpay live order creation failed, falling back to local simulation order:', err);
      }
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
      amount: PREMIUM_AMOUNT,
      currency: 'INR',
      keyId: RAZORPAY_KEY_ID,
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
    const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

    if (isProduction) {
      if (!RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET.includes('sampleSecret')) {
        res.status(500).json({ error: 'Razorpay payment gateway secret is not configured on production server' });
        return;
      }
      if (!razorpaySignature) {
        res.status(400).json({ error: 'Missing payment signature' });
        return;
      }
      const generatedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      const generatedBuf = Buffer.from(generatedSignature, 'utf8');
      const signatureBuf = Buffer.from(razorpaySignature, 'utf8');
      isSignatureValid =
        generatedBuf.length === signatureBuf.length &&
        crypto.timingSafeEqual(generatedBuf, signatureBuf);
    } else {
      // Local development mode
      if (razorpaySignature && RAZORPAY_KEY_SECRET && !RAZORPAY_KEY_SECRET.includes('sampleSecret')) {
        const generatedSignature = crypto
          .createHmac('sha256', RAZORPAY_KEY_SECRET)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest('hex');
        isSignatureValid = generatedSignature === razorpaySignature;
      } else {
        // In local dev test simulation
        isSignatureValid = true;
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
