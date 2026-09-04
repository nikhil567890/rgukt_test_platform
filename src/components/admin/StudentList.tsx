import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/api';
import { StudentListItem } from '../../types';
import { db, auth } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  Users,
  Sparkles,
  Flame,
  Search,
  UserCheck,
  UserX,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Clock,
  RefreshCw,
} from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
  return errInfo;
}

interface StudentListProps {
  onSelectStudent: (studentId: string) => void;
}

export const StudentList: React.FC<StudentListProps> = ({ onSelectStudent }) => {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getStudents();
      setStudents(res.students);
    } catch (err: any) {
      setError(err.message || 'Failed to load students list');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  /**
   * Toggles the 'isPremium' status of a student in Firestore & Backend database
   * with immediate optimistic UI updates.
   */
  const toggleStudentPremium = async (studentId: string, currentStatus: boolean, studentName?: string) => {
    const nextStatus = !currentStatus;
    const name = studentName || 'Student';
    
    setProcessingId(studentId);
    setActionNotice(null);

    // 1. Immediate UI update (Optimistic)
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, isPremium: nextStatus } : s))
    );

    try {
      // 2. Synchronize status directly to Firestore
      const studentDocRef = doc(db, 'users', studentId);
      await setDoc(
        studentDocRef,
        {
          isPremium: nextStatus,
          premiumSince: nextStatus ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 3. Synchronize with backend API for persistent backend sessions & audit logging
      if (nextStatus) {
        await adminApi.grantPremium(studentId);
        setActionNotice({
          type: 'success',
          text: `Premium status granted in Firestore to "${name}". Account is now Premium Active.`,
        });
      } else {
        await adminApi.revokePremium(studentId);
        setActionNotice({
          type: 'success',
          text: `Premium status revoked in Firestore for "${name}". Account is now Free Tier.`,
        });
      }
    } catch (err: any) {
      // Rollback optimistic state change if failed
      handleFirestoreError(err, OperationType.UPDATE, `users/${studentId}`);
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, isPremium: currentStatus } : s))
      );
      setActionNotice({
        type: 'error',
        text: err.message || `Failed to update premium status for "${name}".`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  const [isCheckingExpiry, setIsCheckingExpiry] = useState(false);

  const handleRunDailyExpiryCheck = async () => {
    setIsCheckingExpiry(true);
    setActionNotice(null);
    try {
      const res = await adminApi.runDailySubscriptionCheck();
      setActionNotice({
        type: 'success',
        text: res.message || 'Daily 365-day subscription expiration check completed successfully.',
      });
      fetchStudents();
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: err.message || 'Failed to run 365-day subscription check.',
      });
    } finally {
      setIsCheckingExpiry(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="admin-students-page" className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-extrabold mb-1.5 inline-block">
            Student Management & 365-Day Expiry Engine
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Registered Students Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Monitor student enrollments, toggle live Firestore premium access, and execute 365-day daily expiration sweeps.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            id="btn-run-expiry-check"
            onClick={handleRunDailyExpiryCheck}
            disabled={isCheckingExpiry}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title="Daily background daemon also runs every 24h automatically"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingExpiry ? 'animate-spin text-indigo-400' : 'text-slate-300'}`} />
            <span>{isCheckingExpiry ? 'Checking Expirations...' : 'Run 365-Day Check'}</span>
          </button>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name or email..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionNotice.text}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-[10px] text-slate-500 hover:text-slate-900 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading students directory...</p>
        </div>
      ) : error ? (
        <div className="p-5 bg-red-50 border border-red-200 rounded-xl text-center text-red-700 text-xs space-y-2">
          <p className="font-bold">{error}</p>
          <button onClick={fetchStudents} className="px-3 py-1 bg-red-600 text-white font-bold rounded">
            Retry
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700 text-xs">No Students Found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Student Info</th>
                  <th className="p-3.5">Membership & Firestore Toggle</th>
                  <th className="p-3.5">Streak</th>
                  <th className="p-3.5">Attempts</th>
                  <th className="p-3.5">Avg Score</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5">
                      <p className="font-extrabold text-slate-900 text-xs">{s.name}</p>
                      <p className="text-[11px] text-slate-400">{s.email}</p>
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center space-x-2.5">
                        {/* Interactive Toggle Switch */}
                        <button
                          type="button"
                          id={`toggle-premium-${s.id}`}
                          onClick={() => toggleStudentPremium(s.id, s.isPremium, s.name)}
                          disabled={processingId === s.id}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            s.isPremium ? 'bg-emerald-600' : 'bg-slate-300'
                          } ${processingId === s.id ? 'opacity-50 cursor-wait' : ''}`}
                          title={`Click to ${s.isPremium ? 'Revoke' : 'Grant'} Premium status in Firestore`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              s.isPremium ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        {/* Status Label Badge */}
                        {s.isPremium ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>Premium Active</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-[10px]">
                            Free Tier
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className="font-bold text-amber-700 inline-flex items-center gap-1 text-[11px]">
                        <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span>{s.currentStreak} Days</span>
                      </span>
                    </td>

                    <td className="p-3.5 font-bold text-slate-800">
                      {s.attemptsCount} Tests
                    </td>

                    <td className="p-3.5 font-extrabold text-indigo-700">
                      {s.avgPercentage}%
                    </td>

                    <td className="p-3.5 text-right space-x-1.5">
                      {/* Direct Toggle Action Button */}
                      {!s.isPremium ? (
                        <button
                          onClick={() => toggleStudentPremium(s.id, false, s.name)}
                          disabled={processingId === s.id}
                          className="px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold border border-amber-300 text-[10px] inline-flex items-center space-x-1 cursor-pointer transition-all disabled:opacity-50"
                          title="Grant 365-day premium permission in Firestore"
                        >
                          <ShieldCheck className="w-3 h-3 text-amber-600" />
                          <span>Grant Premium</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleStudentPremium(s.id, true, s.name)}
                          disabled={processingId === s.id}
                          className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 text-[10px] inline-flex items-center space-x-1 cursor-pointer transition-all disabled:opacity-50"
                          title="Revoke premium permission in Firestore"
                        >
                          <UserX className="w-3 h-3 text-rose-600" />
                          <span>Revoke</span>
                        </button>
                      )}

                      <button
                        onClick={() => onSelectStudent(s.id)}
                        className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold border border-indigo-200 text-[10px] inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <span>View Performance</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
