import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/api';
import { AdminOverviewStats } from '../../types';
import {
  Users,
  Award,
  BookOpen,
  IndianRupee,
  PlusCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface AdminOverviewProps {
  onNavigateToManageTests: () => void;
  onNavigateToStudents: () => void;
  onCreateNewTest: () => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  onNavigateToManageTests,
  onNavigateToStudents,
  onCreateNewTest,
}) => {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getOverview();
      setStats(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin overview stats');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (isLoading) {
    return (
      <div id="admin-overview-loading" className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading admin overview dashboard...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
        <p className="font-bold text-red-800 text-sm">{error || 'Failed to load stats'}</p>
        <button
          onClick={fetchOverview}
          className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div id="admin-overview-page" className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 text-white border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider mb-1.5 inline-block">
            RGUKT Admin Console
          </span>
          <h1 className="text-xl sm:text-2xl font-black">
            Platform Operations & Revenue Overview
          </h1>
          <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
            Monitor student enrollments, Razorpay premium revenue, test attempts, and overall entrance exam preparation.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={onCreateNewTest}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Test Paper</span>
          </button>
        </div>
      </div>

      {/* 5 Key Metric Cards */}
      <div id="admin-metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Total Students</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xl font-black text-slate-900">{stats.totalStudents}</p>
          <p className="text-[10px] text-slate-400">Registered on platform</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Premium Members</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-700">{stats.premiumStudents}</p>
          <p className="text-[10px] text-emerald-600 font-bold">
            {stats.totalStudents > 0
              ? `${Math.round((stats.premiumStudents / stats.totalStudents) * 100)}% Conversion`
              : '0%'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Total Test Papers</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xl font-black text-slate-900">{stats.totalTests}</p>
          <p className="text-[10px] text-slate-400">Published & Draft</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Total Exam Attempts</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-black text-slate-900">{stats.totalAttempts}</p>
          <p className="text-[10px] text-slate-400">Student submissions</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Total Revenue Collected</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-700">₹{stats.totalRevenueINR.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">Razorpay Verified Payments</p>
        </div>
      </div>

      {/* Quick Navigation Cards & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quick Nav Links */}
        <div className="lg:col-span-1 space-y-3.5">
          <div
            onClick={onNavigateToManageTests}
            className="p-5 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer space-y-2"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Test & Question Management</h3>
            <p className="text-xs text-slate-500">
              Create, edit, publish test papers, and build MCQ question banks with solutions.
            </p>
            <div className="flex items-center text-xs font-bold text-indigo-700 pt-1">
              <span>Manage Test Papers</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          <div
            onClick={onNavigateToStudents}
            className="p-5 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer space-y-2"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Students Directory</h3>
            <p className="text-xs text-slate-500">
              View registered students, check streak history, performance, and grant manual premium access.
            </p>
            <div className="flex items-center text-xs font-bold text-emerald-700 pt-1">
              <span>View All Students</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>

        {/* Recent Exam Submissions Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Recent Exam Attempts Feed</span>
          </h2>

          {stats.recentAttempts.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No exam attempts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="pb-2.5">Student</th>
                    <th className="pb-2.5">Test Paper</th>
                    <th className="pb-2.5">Score</th>
                    <th className="pb-2.5">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recentAttempts.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5">
                        <p className="font-bold text-slate-900">{attempt.studentName}</p>
                        <p className="text-[10px] text-slate-400">{attempt.studentEmail}</p>
                      </td>
                      <td className="py-2.5 font-semibold text-slate-800">{attempt.testTitle}</td>
                      <td className="py-2.5 font-bold text-indigo-700">
                        {attempt.score} / {attempt.totalMarks} (
                        {Math.round((attempt.score / attempt.totalMarks) * 100)}%)
                      </td>
                      <td className="py-2.5 text-slate-400 text-[11px]">
                        {new Date(attempt.submittedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
