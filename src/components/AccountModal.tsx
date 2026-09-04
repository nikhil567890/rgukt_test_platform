import React, { useState, useEffect } from 'react';
import { authApi, testApi } from '../services/api';
import { generatePdfReport } from '../utils/generatePdfReport';
import {
  User as UserIcon,
  X,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Flame,
  Check,
  RefreshCw,
  ExternalLink,
  Download,
  FileText,
} from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPaywall?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onOpenPaywall,
}) => {
  const [data, setData] = useState<{
    user: any;
    subscription: any;
    payments: any[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAccountDetails();
    }
  }, [isOpen]);

  const fetchAccountDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.getAccountDetails();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load account details:', err);
      setError(err.message || 'Failed to fetch user account & payment details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!data?.user) return;
    setIsExportingPdf(true);
    try {
      let dashboardData;
      try {
        dashboardData = await testApi.getStudentDashboard();
      } catch (e) {
        console.warn('Dashboard fetch error during PDF export:', e);
        dashboardData = null;
      }

      generatePdfReport({
        user: data.user,
        stats: dashboardData?.stats || {
          avgScorePercentage: 0,
          totalAttemptsCount: 0,
          totalAvailableTests: 0,
          currentStreak: data.user.currentStreak || 0,
          longestStreak: data.user.longestStreak || 0,
        },
        attemptsHistory: dashboardData?.attemptsHistory || [],
        subscription: data.subscription,
        payments: data.payments,
      });
    } catch (err) {
      console.error('Failed to generate PDF report from AccountModal:', err);
    } finally {
      setTimeout(() => setIsExportingPdf(false), 600);
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const user = data?.user;
  const sub = data?.subscription;
  const payments = data?.payments || [];

  const validityDays = sub?.validityDays || 365;
  const daysRemaining = sub?.daysRemaining ?? 0;
  const progressPct = sub?.isPremium && validityDays > 0 ? Math.min(100, Math.max(0, Math.round((daysRemaining / validityDays) * 100))) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="account-details-modal"
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white">Account & Subscription Details</h2>
              <p className="text-xs text-slate-400">Membership details, validity dates, and payment history</p>
            </div>
          </div>
          <button
            id="btn-close-account-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-500">Loading profile & payment records...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium text-center">
              {error}
            </div>
          ) : (
            <>
              {/* Account Profile Card */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                      {(user?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-base text-slate-900">{user?.name}</h3>
                        {user?.role === 'ADMIN' ? (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold">
                            ADMIN
                          </span>
                        ) : sub?.isPremium ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>365-DAY PREMIUM</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                            FREE TIER
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">{user?.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>Member Since: <strong className="text-slate-800">{formatDate(user?.createdAt).split(',')[0]}</strong></span>
                    </div>

                    <button
                      id="btn-download-pdf-account-profile"
                      onClick={handleDownloadPdf}
                      disabled={isExportingPdf}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 transition-all cursor-pointer flex items-center space-x-1.5 text-xs shadow-2xs ml-auto disabled:opacity-50"
                    >
                      {isExportingPdf ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          <span>Generating PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Download Summary PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* User Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Account Status</p>
                    <p className="text-xs font-black text-slate-900 mt-0.5">
                      {user?.role === 'ADMIN' ? 'Admin Access' : sub?.isPremium ? 'Premium Active' : 'Free Tier'}
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Current Streak</p>
                    <p className="text-xs font-black text-amber-600 mt-0.5 flex items-center space-x-1">
                      <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{user?.currentStreak || 0} Days</span>
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs col-span-2 sm:col-span-1">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Longest Streak</p>
                    <p className="text-xs font-black text-indigo-600 mt-0.5">{user?.longestStreak || 0} Days</p>
                  </div>
                </div>
              </div>

              {/* 365 Days Subscription Status Card */}
              <div className={`p-5 rounded-2xl border ${sub?.isPremium ? 'bg-indigo-50/60 border-indigo-200' : 'bg-amber-50/60 border-amber-200'} space-y-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${sub?.isPremium ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'}`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">365-Day Subscription Validity</h4>
                      <p className="text-[11px] text-slate-500">Full access to RGUKT CET Mathematics Mock Tests & Question Bank</p>
                    </div>
                  </div>

                  {sub?.isPremium ? (
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold shadow-2xs flex items-center space-x-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Active Plan</span>
                      </span>
                      {daysRemaining <= 30 && user?.role !== 'ADMIN' && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenPaywall?.();
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] shadow-2xs transition-all cursor-pointer"
                        >
                          Renew Early
                        </button>
                      )}
                    </div>
                  ) : sub?.status === 'EXPIRED' ? (
                    <button
                      id="btn-account-renew-now"
                      onClick={() => {
                        onClose();
                        onOpenPaywall?.();
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Renew Plan (₹3000)</span>
                    </button>
                  ) : (
                    <button
                      id="btn-account-upgrade-now"
                      onClick={() => {
                        onClose();
                        onOpenPaywall?.();
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Activate 365 Days (₹3000)</span>
                    </button>
                  )}
                </div>

                {/* Date Breakdown */}
                {sub?.isPremium ? (
                  <div className="space-y-3 bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-indigo-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-start space-x-2">
                        <Clock className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subscription Activated On</p>
                          <p className="font-bold text-slate-900 mt-0.5">{formatDate(sub?.premiumSince)}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-2">
                        <Calendar className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subscription Expiration Date (365 Days)</p>
                          <p className="font-bold text-indigo-700 mt-0.5">{formatDate(sub?.premiumExpiresAt)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {user?.role !== 'ADMIN' && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>365-Day Validity Countdown</span>
                          <span className="text-indigo-600">{daysRemaining} / 365 Days Remaining</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : sub?.status === 'EXPIRED' ? (
                  <div className="p-3.5 bg-rose-50/80 rounded-xl border border-rose-200 text-xs text-rose-800 space-y-1">
                    <p className="font-extrabold text-rose-900">Your 365-Day Premium Subscription Has Expired.</p>
                    <p>Your access has reverted to the Free Tier. Please renew for ₹3000 to instantly reactivate your 365-day access to full mock papers, complete question bank solutions, and topper benchmarks.</p>
                  </div>
                ) : (
                  <div className="p-3 bg-white/80 rounded-xl border border-amber-200 text-xs text-slate-600 space-y-1">
                    <p className="font-bold text-amber-900">Your account is currently on the Free Plan.</p>
                    <p>Upgrade for ₹3000 to get instant 365-day access to all published full mock papers, chapter tests, LaTeX solutions, and analytics.</p>
                  </div>
                )}
              </div>

              {/* Payment History Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-slate-600" />
                    <h4 className="font-extrabold text-sm text-slate-900">Payment & Transaction Receipts</h4>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{payments.length} Transaction(s)</span>
                </div>

                {payments.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 font-medium">
                    No payment transactions found for this account.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CreditCard className="w-4 h-4 text-indigo-600" />
                            <span className="font-extrabold text-slate-900">₹{p.amountINR || p.amount / 100} INR</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500 font-medium">{p.purpose}</span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              p.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-700'
                                : p.status === 'CREATED'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {p.status === 'PAID' ? 'PAID / VERIFIED' : p.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl">
                          <div>
                            <span className="font-bold text-slate-700">Razorpay Order ID: </span>
                            <code className="text-indigo-600 font-mono text-[10px]">{p.razorpayOrderId}</code>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">Payment ID: </span>
                            <code className="text-indigo-600 font-mono text-[10px]">{p.razorpayPaymentId || 'N/A'}</code>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">Payment Method: </span>
                            <span>{p.paymentMethod}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">Paid Date: </span>
                            <span>{formatDate(p.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            id="btn-download-pdf-account-footer"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf || !data?.user}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center space-x-2 shadow-xs disabled:opacity-50"
          >
            {isExportingPdf ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Generating Report...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-white" />
                <span>Download Performance & Subscription PDF Report</span>
              </>
            )}
          </button>

          <button
            id="btn-close-account-modal-bottom"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
