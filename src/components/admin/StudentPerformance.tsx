import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/api';
import { ExamAnalyticsView } from '../common/ExamAnalyticsView';
import { AttemptInspectorModal } from '../common/AttemptInspectorModal';
import {
  ArrowLeft,
  User,
  Flame,
  Award,
  Clock,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  UserCheck,
  UserX,
  ShieldCheck,
} from 'lucide-react';

interface StudentPerformanceProps {
  studentId: string;
  onBack: () => void;
}

export const StudentPerformance: React.FC<StudentPerformanceProps> = ({
  studentId,
  onBack,
}) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingPermission, setIsUpdatingPermission] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspectingAttemptId, setInspectingAttemptId] = useState<string | null>(null);

  const fetchPerformance = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getStudentPerformance(studentId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load student performance details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [studentId]);

  const handleGrantPremium = async () => {
    if (!data?.student) return;
    if (!confirm(`Grant administrator premium permission to student "${data.student.name}"? This will instantly activate their 365-day Premium account with full access to Mock Tests, Question Bank, and Analytics.`)) return;

    setIsUpdatingPermission(true);
    setFeedbackMsg(null);
    try {
      const res = await adminApi.grantPremium(studentId);
      setFeedbackMsg({ type: 'success', text: res.message || 'Premium permission successfully granted!' });
      setData((prev: any) => ({
        ...prev,
        student: {
          ...prev.student,
          isPremium: true,
        },
      }));
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to grant premium permission.' });
    } finally {
      setIsUpdatingPermission(false);
    }
  };

  const handleRevokePremium = async () => {
    if (!data?.student) return;
    if (!confirm(`Revoke premium permission for student "${data.student.name}"? Account will revert to Free Tier.`)) return;

    setIsUpdatingPermission(true);
    setFeedbackMsg(null);
    try {
      const res = await adminApi.revokePremium(studentId);
      setFeedbackMsg({ type: 'success', text: res.message || 'Premium permission revoked. Account reverted to Free Tier.' });
      setData((prev: any) => ({
        ...prev,
        student: {
          ...prev.student,
          isPremium: false,
        },
      }));
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to revoke premium permission.' });
    } finally {
      setIsUpdatingPermission(false);
    }
  };

  if (isLoading) {
    return (
      <div id="student-perf-loading" className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Fetching student performance records...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
        <p className="font-bold text-red-800 text-sm">{error || 'Data not found'}</p>
        <button onClick={onBack} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer">
          Back to Students
        </button>
      </div>
    );
  }

  const { student, performanceHistory, analytics } = data;

  return (
    <div id="student-performance-page" className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Students List</span>
        </button>

        {/* Permission Grant / Revoke Action Button in Header */}
        <div>
          {student.isPremium ? (
            <button
              onClick={handleRevokePremium}
              disabled={isUpdatingPermission}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 text-xs inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              title="Revoke student premium permission"
            >
              <UserX className="w-3.5 h-3.5 text-rose-600" />
              <span>Revoke Premium</span>
            </button>
          ) : (
            <button
              onClick={handleGrantPremium}
              disabled={isUpdatingPermission}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black border border-amber-400 text-xs inline-flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50"
              title="Grant 365-day premium permission"
            >
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>Grant Premium Permission</span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <UserX className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-[10px] text-slate-500 hover:text-slate-900 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Student Profile Card */}
      <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 text-white border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <span className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center font-bold text-base text-indigo-300">
              {(student?.name || student?.email || 'S').charAt(0).toUpperCase()}
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-extrabold text-white">{student?.name || 'Student'}</h1>
                {student.isPremium && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold flex items-center space-x-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Premium Active</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{student?.email || ''}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
          <div className="text-center px-2.5 border-r border-white/10">
            <p className="text-[9px] text-indigo-300 uppercase font-extrabold">Account Tier</p>
            <p className="text-xs font-extrabold text-emerald-400">
              {student.isPremium ? 'Premium ⭐' : 'Free Tier'}
            </p>
          </div>

          <div className="text-center px-2.5 border-r border-white/10">
            <p className="text-[9px] text-amber-300 uppercase font-extrabold">Current Streak</p>
            <p className="text-xs font-extrabold text-amber-400 flex items-center justify-center gap-1">
              <Flame className="w-3 h-3 fill-amber-400" />
              <span>{student.currentStreak} Days</span>
            </p>
          </div>

          <div className="text-center px-2.5">
            <p className="text-[9px] text-slate-300 uppercase font-extrabold">Exams Written</p>
            <p className="text-xs font-extrabold text-white">{performanceHistory.length}</p>
          </div>
        </div>
      </div>

      {/* Comprehensive Exam Analytics for Admin */}
      <ExamAnalyticsView
        attempts={performanceHistory}
        analytics={analytics}
        studentName={student?.name}
        onInspectAttempt={(id) => setInspectingAttemptId(id)}
      />

      {/* Attempt Inspector Modal */}
      {inspectingAttemptId && (
        <AttemptInspectorModal
          attemptId={inspectingAttemptId}
          onClose={() => setInspectingAttemptId(null)}
        />
      )}
    </div>
  );
};
