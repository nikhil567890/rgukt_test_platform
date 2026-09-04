import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { paymentApi } from '../services/api';
import {
  X,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Lock,
  Award,
  BookOpen,
  Flame,
  BarChart3,
} from 'lucide-react';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { isLoggedIn, updateUserAndToken } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulation modal state for test mode fallback
  const [showSimulatedCheckout, setShowSimulatedCheckout] = useState(false);
  const [simOrderDetails, setSimOrderDetails] = useState<any>(null);

  if (!isOpen) return null;

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleStartPayment = async () => {
    if (!isLoggedIn) {
      setError('Please sign in or create an account first to upgrade to Premium.');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      // 1. Ensure Razorpay checkout script is loaded
      await loadRazorpayScript();

      // 2. Create order on backend
      const orderData = await paymentApi.createOrder();

      // 3. Initialize Razorpay SDK if available
      if (window.Razorpay && orderData.keyId) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'RGUKT TestPrep',
          description: 'Premium Entrance Exam Access (₹3000)',
          order_id: orderData.orderId,
          prefill: {
            name: orderData.user?.name || '',
            email: orderData.user?.email || '',
          },
          theme: {
            color: '#4f46e5',
          },
          handler: async (response: any) => {
            await verifyPaymentOnBackend({
              razorpayOrderId: response.razorpay_order_id || orderData.orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
            },
          },
        };

        try {
          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', function (resp: any) {
            console.error('Razorpay payment failed:', resp);
            setError(resp.error?.description || 'Payment failed via Razorpay gateway.');
            setIsProcessing(false);
          });
          rzp.open();
        } catch (openErr) {
          console.warn('Razorpay open failed, showing test mode modal:', openErr);
          setSimOrderDetails(orderData);
          setShowSimulatedCheckout(true);
          setIsProcessing(false);
        }
      } else {
        // Fallback: Open interactive test mode Razorpay Checkout modal
        setSimOrderDetails(orderData);
        setShowSimulatedCheckout(true);
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('Payment order creation error:', err);
      setError(err.message || 'Failed to initiate payment. Please try again.');
      setIsProcessing(false);
    }
  };

  const verifyPaymentOnBackend = async (paymentDetails: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
  }) => {
    setIsProcessing(true);
    try {
      const res = await paymentApi.verifyPayment(paymentDetails);
      updateUserAndToken(res.user, res.token);
      setShowSimulatedCheckout(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Payment verification failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulatedSuccess = async () => {
    if (!simOrderDetails) return;
    const simPaymentId = `pay_sim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await verifyPaymentOnBackend({
      razorpayOrderId: simOrderDetails.orderId,
      razorpayPaymentId: simPaymentId,
      razorpaySignature: 'simulated_test_signature_rgukt_2026',
    });
  };

  return (
    <div id="paywall-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div id="paywall-modal-card" className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 sm:p-6 relative overflow-hidden">
        <button
          id="btn-close-paywall-modal"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {!showSimulatedCheckout ? (
          <div>
            {/* Header Title */}
            <div className="text-center mb-5">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-extrabold mb-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>365-Day Subscription Access</span>
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Unlock RGUKT Premium
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Gain 365 days of full access to all entrance mock test papers, step-by-step solutions, and topper benchmarks.
              </p>
            </div>

            {/* Price Badge */}
            <div id="price-card" className="bg-slate-900 rounded-xl p-4 text-white text-center border border-slate-800 shadow-2xs mb-5">
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-300">
                Official Entrance Test Series (Annual Plan)
              </p>
              <div className="flex items-baseline justify-center space-x-1 my-0.5">
                <span className="text-base font-bold text-slate-300">₹</span>
                <span className="text-3xl font-black text-white">3,000</span>
                <span className="text-xs text-slate-400">/ 365 Days</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Full Access for 365 Days • Annual Renewal Required to Continue
              </p>
            </div>

            {/* Features List */}
            <div id="premium-features-list" className="space-y-2.5 mb-5 text-xs">
              <div className="flex items-start space-x-2.5 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-900 font-bold">Full Timed Exam Papers:</strong> Real exam interface with countdown timers and auto-submit.
                </span>
              </div>

              <div className="flex items-start space-x-2.5 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-900 font-bold">Step-by-Step Solutions:</strong> Complete question explanations after each attempt.
                </span>
              </div>

              <div className="flex items-start space-x-2.5 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-900 font-bold">Topper Score Comparisons:</strong> Measure your gap against top rankers for every test.
                </span>
              </div>

              <div className="flex items-start space-x-2.5 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-900 font-bold">Daily Study Streak Tracker:</strong> Build momentum and track improvement over time.
                </span>
              </div>
            </div>

            {error && (
              <div id="paywall-error" className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            {/* CTA Button */}
            <button
              id="btn-pay-now"
              onClick={handleStartPayment}
              disabled={isProcessing}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isProcessing ? 'Initiating Razorpay...' : 'Pay ₹3000 via Razorpay'}</span>
            </button>

            <div className="mt-3 text-center flex items-center justify-center space-x-1.5 text-[10px] text-slate-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Secured by Razorpay • Instant Auto-Activation</span>
            </div>
          </div>
        ) : (
          /* Simulated Razorpay Test Checkout Window */
          <div id="simulated-razorpay-checkout" className="space-y-4">
            <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center font-bold text-[10px]">
                  RZP
                </div>
                <div>
                  <p className="text-xs font-extrabold">Razorpay Test Gateway</p>
                  <p className="text-[10px] text-slate-400">Order ID: {simOrderDetails?.orderId}</p>
                </div>
              </div>
              <span className="text-xs font-mono font-extrabold bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded">
                ₹3,000.00
              </span>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-950 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Test Mode Simulation Active</span>
              </p>
              <p className="text-[11px] text-indigo-800">
                Click "Simulate Successful Payment" below to complete the test payment transaction and verify your signature.
              </p>
            </div>

            <button
              id="btn-simulate-payment-success"
              onClick={handleSimulatedSuccess}
              disabled={isProcessing}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-2xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Verifying Signature...' : 'Simulate Successful Payment (₹3000)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSimulatedCheckout(false)}
              className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-700 text-center font-semibold cursor-pointer"
            >
              Cancel Payment
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
