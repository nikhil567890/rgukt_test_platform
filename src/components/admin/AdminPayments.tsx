import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/api';
import {
  CreditCard,
  DollarSign,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  X,
  UserCheck,
} from 'lucide-react';

interface PaymentRecord {
  id: string;
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  amount: number; // paise
  status: string; // PAID, CREATED, FAILED
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    isPremium: boolean;
  };
}

export const AdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'CREATED' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual payment modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [amountINR, setAmountINR] = useState('3000');
  const [notes, setNotes] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const fetchPayments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getPayments({
        status: statusFilter,
        search: searchQuery,
      });
      setPayments(res.payments || []);
      setTotalRevenue(res.totalRevenueINR || 0);
    } catch (err: any) {
      console.error('Failed to load payment records:', err);
      setError(err.message || 'Failed to load payment records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments();
  };

  const handleApprovePayment = async (paymentId: string) => {
    if (!confirm('Approve this payment and grant premium subscription to the student?')) return;
    try {
      await adminApi.approvePayment(paymentId);
      fetchPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to approve payment');
    }
  };

  const handleRecordManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentEmail.trim()) {
      setModalError('Please enter the student email address');
      return;
    }

    setModalError(null);
    setModalSuccess(null);
    setIsSubmittingManual(true);

    try {
      const res = await adminApi.createManualPayment({
        studentEmail: studentEmail.trim(),
        amountINR: parseInt(amountINR, 10) || 3000,
        notes: notes.trim(),
      });
      setModalSuccess(res.message);
      setStudentEmail('');
      setNotes('');
      fetchPayments();
      setTimeout(() => {
        setShowManualModal(false);
        setModalSuccess(null);
      }, 1800);
    } catch (err: any) {
      setModalError(err.message || 'Failed to record manual payment');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // Metrics calculation
  const paidCount = payments.filter((p) => p.status === 'PAID').length;
  const pendingCount = payments.filter((p) => p.status === 'CREATED').length;
  const totalAmountPaidINR = payments
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + Math.round(p.amount / 100), 0);

  return (
    <div id="admin-payments-page" className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-400/30">
            Financial Management
          </span>
          <h1 className="text-2xl font-black text-white mt-1">Payment Transactions & Revenue</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor Razorpay online orders, verified student subscriptions, and record manual offline fee approvals.
          </p>
        </div>

        <button
          id="btn-record-manual-payment"
          onClick={() => {
            setModalError(null);
            setModalSuccess(null);
            setShowManualModal(true);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Record Offline Payment</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div id="metric-total-revenue" className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              ₹
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">₹{totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 mt-1">Verified Razorpay + Offline Payments</p>
        </div>

        <div id="metric-paid-transactions" className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Verified Paid Orders</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-900">{paidCount}</p>
          <p className="text-[10px] text-slate-500 mt-1">Active Premium Student Accounts</p>
        </div>

        <div id="metric-pending-transactions" className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Pending Orders</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-900">{pendingCount}</p>
          <p className="text-[10px] text-slate-500 mt-1">Orders Initiated / Awaiting Verification</p>
        </div>

        <div id="metric-fee-tier" className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Standard Entrance Pass</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-900">₹3,000</p>
          <p className="text-[10px] text-slate-500 mt-1">One-Time Premium Unlock Fee</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {(['ALL', 'PAID', 'CREATED', 'FAILED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' && 'All Payments'}
              {st === 'PAID' && 'Verified Paid'}
              {st === 'CREATED' && 'Pending Created'}
              {st === 'FAILED' && 'Failed Orders'}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student, order ID, payment ID..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none w-60 sm:w-72"
            />
          </div>

          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Search
          </button>

          <button
            type="button"
            onClick={fetchPayments}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Transactions Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading payment records...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-700 text-xs space-y-3">
          <AlertCircle className="w-6 h-6 mx-auto text-red-600" />
          <p className="font-bold">{error}</p>
          <button onClick={fetchPayments} className="px-4 py-1.5 bg-red-600 text-white font-bold rounded-lg">
            Retry Loading
          </button>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-800 text-sm">No Payment Transactions Found</p>
          <p className="text-xs text-slate-500">
            {searchQuery
              ? 'No matching payment records found for your search query.'
              : 'No payment transactions recorded yet in this category.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Student Details</th>
                  <th className="p-3.5">Order & Payment Ref</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="p-3.5">
                      <p className="font-extrabold text-slate-900 text-xs">{p.user?.name || 'Unknown Student'}</p>
                      <p className="text-[11px] text-slate-400">{p.user?.email || p.userId}</p>
                    </td>

                    <td className="p-3.5 font-mono text-[11px]">
                      <p className="text-slate-800 font-bold">{p.razorpayOrderId}</p>
                      {p.razorpayPaymentId ? (
                        <p className="text-indigo-600 text-[10px]">{p.razorpayPaymentId}</p>
                      ) : (
                        <p className="text-slate-400 text-[10px] italic">No payment ID yet</p>
                      )}
                    </td>

                    <td className="p-3.5 font-extrabold text-slate-900 text-sm">
                      ₹{Math.round(p.amount / 100).toLocaleString()}
                    </td>

                    <td className="p-3.5">
                      {p.status === 'PAID' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>VERIFIED PAID</span>
                        </span>
                      )}
                      {p.status === 'CREATED' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[10px] inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>PENDING</span>
                        </span>
                      )}
                      {p.status === 'FAILED' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-800 font-bold text-[10px] inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-600" />
                          <span>FAILED</span>
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-slate-500 text-[11px]">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>

                    <td className="p-3.5 text-right space-x-2">
                      {p.status !== 'PAID' && (
                        <button
                          onClick={() => handleApprovePayment(p.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px] inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <UserCheck className="w-3 h-3 text-emerald-600" />
                          <span>Approve & Grant</span>
                        </button>
                      )}
                      {p.status === 'PAID' && (
                        <span className="text-[10px] font-bold text-slate-400 flex items-center justify-end gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Premium Active</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowManualModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Record Offline Fee Payment</h3>
                <p className="text-[11px] text-slate-500">Approve student offline cash or UPI payment manually.</p>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {modalError}
              </div>
            )}

            {modalSuccess && (
              <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRecordManualPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Student Registered Email *</label>
                <input
                  type="email"
                  required
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="e.g. student@rgukt.ac.in"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount Collected (INR)</label>
                <input
                  type="number"
                  required
                  value={amountINR}
                  onChange={(e) => setAmountINR(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Receipt / Payment Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Received ₹3000 via Cash / GPay at campus admin desk"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingManual ? 'Processing...' : 'Approve & Unlock Premium'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
