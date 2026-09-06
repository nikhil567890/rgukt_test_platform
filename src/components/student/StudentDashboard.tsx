import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { testApi } from '../../services/api';
import { StudentDashboardData } from '../../types';
import { TopperComparison } from './TopperComparison';
import { ScoreTrendChart } from './ScoreTrendChart';
import { generatePdfReport } from '../../utils/generatePdfReport';
import { ExamAnalyticsView } from '../common/ExamAnalyticsView';
import { AttemptInspectorModal } from '../common/AttemptInspectorModal';
import {
  Flame,
  Award,
  BookOpen,
  TrendingUp,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  FileDown,
  Loader2,
  GraduationCap,
  PieChart,
} from 'lucide-react';

interface StudentDashboardProps {
  onNavigateToTests: () => void;
  onViewSolution: (attemptId: string) => void;
  onOpenPaywall: () => void;
  onOpenAccountModal?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onNavigateToTests,
  onViewSolution,
  onOpenPaywall,
  onOpenAccountModal,
}) => {
  const { isLoggedIn } = useAuth();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');
  const [inspectingAttemptId, setInspectingAttemptId] = useState<string | null>(null);

  const handleDownloadReport = () => {
    if (!data) return;
    setIsExportingPdf(true);
    try {
      generatePdfReport({
        user: data.user,
        stats: data.stats,
        attemptsHistory: data.attemptsHistory,
      });
    } catch (err) {
      console.error('Error generating PDF report:', err);
    } finally {
      setTimeout(() => setIsExportingPdf(false), 800);
    }
  };

  const fetchDashboardData = async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    setError(null);
    try {
      const res = await testApi.getStudentDashboard();
      setData(res);
    } catch (err: any) {
      if (err.code === 'PREMIUM_REQUIRED' || err.status === 402) {
        setError('PREMIUM_REQUIRED');
      } else {
        setError(err.message || 'Failed to load dashboard data');
      }
    } finally {
      if (showLoadingState) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchDashboardData(true);
    } else {
      setIsLoading(false);
    }

    const handleSync = () => {
      if (isLoggedIn) {
        fetchDashboardData(false);
      }
    };

    window.addEventListener('testSeriesUpdated', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      window.removeEventListener('testSeriesUpdated', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div id="student-guest-welcome" className="max-w-2xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center space-y-5">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-2xs">
          <GraduationCap className="w-8 h-8" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">VSMC RGUKT Test Preparation</h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Prepare for RGUKT CET with VSMC's online test series and practice tests. Vinodh Sir Maths Classes provides focused RGUKT preparation resources to help students practice and evaluate their performance.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigateToTests()}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>View Test Papers</span>
          </button>
          <button
            onClick={onOpenPaywall}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Unlock Premium Access</span>
          </button>
        </div>

        {/* Small natural SEO-focused section */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-left grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>RGUKT Preparation & Test Series</span>
            </h2>
            <p className="text-[11px] text-slate-500 leading-normal">
              Structured mathematics practice tests covering key topics for effective RGUKT CET entrance preparation.
            </p>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>Vinodh Sir Test Series</span>
            </h2>
            <p className="text-[11px] text-slate-500 leading-normal">
              Timed mock tests by Vinodh Sir RGUKT Testprep with instant score evaluation, streak tracking, and step-by-step solutions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div id="dashboard-loading" className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading student dashboard...</p>
      </div>
    );
  }

  if (error === 'PREMIUM_REQUIRED') {
    return (
      <div id="dashboard-paywall-locked" className="max-w-2xl mx-auto my-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm text-center space-y-5">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto border border-indigo-100">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-slate-900">Student Panel Premium Paywall</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Access to RGUKT Entrance test papers, streak tracking, and topper analysis requires an active Premium Subscription (₹3000 for 365-day access).
          </p>
        </div>
        <button
          onClick={onOpenPaywall}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer inline-flex items-center space-x-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Pay ₹3000 to Unlock Access</span>
        </button>
      </div>
    );
  }

  if (error || !data) {
    const isAuthError = error && (error.includes('token') || error.includes('Session expired') || error.includes('Unauthorized'));
    return (
      <div className="max-w-2xl mx-auto my-8 p-5 bg-amber-50 border border-amber-200 rounded-xl text-center text-amber-900 space-y-3">
        <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
        <p className="font-semibold text-xs">
          {isAuthError
            ? 'Your login session has expired. Please sign in again to access your dashboard.'
            : (error || 'Failed to load dashboard')}
        </p>
        <button
          onClick={() => {
            if (isAuthError) {
              window.dispatchEvent(new CustomEvent('auth:open_modal'));
            } else {
              fetchDashboardData();
            }
          }}
          className="px-3.5 py-1.5 bg-indigo-600 text-white font-bold rounded-md text-xs cursor-pointer hover:bg-indigo-700"
        >
          {isAuthError ? 'Sign In Again' : 'Retry Loading'}
        </button>
      </div>
    );
  }

  const { user, stats, attemptsHistory } = data;

  return (
    <div id="student-dashboard-container" className="space-y-6 pb-12">
      {/* Welcome & Streak Banner */}
      <div id="streak-banner" className="bg-slate-900 rounded-2xl p-5 sm:p-6 text-white border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                VSMC Student Portal
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Vinodh Sir Maths Classes • RGUKT CET 2026</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Welcome back, {user.name}!
            </h1>
            <p className="text-xs text-slate-300 max-w-xl">
              Consistent practice is the key to top RGUKT CET ranks. Attempt the Vinodh Sir Test Series daily to build your study streak.
            </p>
          </div>

          {/* Streak Counter Card & Download PDF Report */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div id="streak-counter-box" className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 flex items-center space-x-3.5 min-w-[190px]">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <Flame className="w-6 h-6 fill-amber-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-amber-300">
                  Daily Study Streak
                </p>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl font-black text-white">{stats.currentStreak}</span>
                  <span className="text-xs font-semibold text-slate-400">Days</span>
                </div>
                <p className="text-[10px] text-slate-400">Longest: {stats.longestStreak} Days</p>
              </div>
            </div>

            <button
              onClick={handleDownloadReport}
              disabled={isExportingPdf}
              className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl border border-indigo-400/30 shadow-2xs transition-all cursor-pointer flex items-center justify-center space-x-2 shrink-0 disabled:opacity-50"
              title="Export complete progress and exam history report as PDF"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 365-Day Subscription Status Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${user.isPremium ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm text-slate-900">Subscription Status:</span>
              {user.role === 'ADMIN' ? (
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-black text-[10px]">ADMIN UNLIMITED</span>
              ) : user.isPremium ? (
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-black text-[10px] flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>365-DAY ACTIVE PREMIUM</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-black text-[10px]">FREE TIER (LOCKED)</span>
              )}
            </div>

            {user.isPremium && user.premiumSince ? (
              <p className="text-xs text-slate-500 mt-0.5">
                Activated: <strong className="text-slate-800">{new Date(user.premiumSince).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> • Valid for 365 days until <strong className="text-indigo-600">{new Date(new Date(user.premiumSince).getTime() + 365*24*60*60*1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">Unlock 365 days of unlimited access to RGUKT CET Mathematics Mock Tests & Question Bank for ₹3000.</p>
            )}
          </div>
        </div>

        <button
          onClick={onOpenAccountModal}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0"
        >
          <span>Account & Payment Details</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* View Switcher Tabs: Overview vs Detailed Exam Analytics */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Dashboard Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <PieChart className="w-4 h-4 text-emerald-400" />
          <span>Exams Analysis & Subject Matrix</span>
        </button>
      </div>

      {activeTab === 'analytics' ? (
        <ExamAnalyticsView
          attempts={attemptsHistory}
          analytics={data.analytics}
          onInspectAttempt={(id) => setInspectingAttemptId(id)}
        />
      ) : (
        <>
          {/* Stats Cards */}
          <div id="student-stats-grid" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Available Tests</p>
                <p className="text-lg font-black text-slate-900">{stats.totalAvailableTests}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tests Attempted</p>
                <p className="text-lg font-black text-slate-900">{stats.totalAttemptsCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Average Score %</p>
                <p className="text-lg font-black text-slate-900">{stats.avgScorePercentage}%</p>
              </div>
            </div>
          </div>

          {/* Score Trend Chart Over Last 5 Completed Mock Tests */}
          <ScoreTrendChart attemptsHistory={attemptsHistory} onNavigateToTests={onNavigateToTests} />

          {/* Topper Benchmark Comparison Chart */}
          <TopperComparison attemptsHistory={attemptsHistory} userAvgScore={stats.avgScorePercentage} />
        </>
      )}

      {/* Main Section: Topper Comparisons & Attempt History */}
      <div id="student-attempts-section" className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-600" />
              <span>Test Performance & Topper Benchmark</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Compare your score against the exam topper for each test paper
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              onClick={handleDownloadReport}
              disabled={isExportingPdf}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs flex items-center space-x-1.5 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>Export PDF Report</span>
            </button>

            <button
              onClick={onNavigateToTests}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center space-x-1 shadow-2xs transition-all cursor-pointer"
            >
              <span>Browse All Test Papers</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {attemptsHistory.length === 0 ? (
          <div className="text-center py-10 px-4 space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-sm">No Tests Attempted Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Start your RGUKT CET mock exam preparation by taking your first test paper.
              </p>
            </div>
            <button
              onClick={onNavigateToTests}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-2xs transition-all cursor-pointer inline-flex items-center space-x-1.5"
            >
              <span>Take a Mock Test Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {attemptsHistory.map((attempt) => {
              const studentPct = Math.round((attempt.score / attempt.totalMarks) * 100);
              const topperPct = Math.round((attempt.topperScore / attempt.totalMarks) * 100);
              const gap = attempt.gapToTopper;

              return (
                <div
                  key={attempt.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-200 bg-slate-50/50 hover:bg-indigo-50/10 transition-all space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {attempt.subject}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 mt-1">
                        {attempt.testTitle}
                      </h3>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Submitted on {new Date(attempt.submittedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Time taken: {Math.floor(attempt.timeTakenSec / 60)}m {attempt.timeTakenSec % 60}s</span>
                      </p>
                    </div>

                    <button
                      onClick={() => onViewSolution(attempt.id)}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-lg text-xs flex items-center space-x-1 shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
                    >
                      <span>View Solutions & Breakdown</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Topper Score Comparison Visual Bar */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">Your Score:</span>
                        <span className="text-indigo-700 font-extrabold text-xs">
                          {attempt.score} / {attempt.totalMarks} ({studentPct}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">Topper Score:</span>
                        <span className="text-amber-600 font-extrabold text-xs">
                          {attempt.topperScore} / {attempt.totalMarks} ({topperPct}%)
                        </span>
                      </div>
                    </div>

                    {/* Visual Progress Bar Stack */}
                    <div className="space-y-1.5">
                      {/* Your Score Bar */}
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="w-14 text-[10px] font-bold text-slate-500">You</span>
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${studentPct}%` }}
                          />
                        </div>
                        <span className="w-9 text-right font-mono text-[10px] text-slate-700 font-bold">{studentPct}%</span>
                      </div>

                      {/* Topper Score Bar */}
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="w-14 text-[10px] font-bold text-amber-600">Topper</span>
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${topperPct}%` }}
                          />
                        </div>
                        <span className="w-9 text-right font-mono text-[10px] text-amber-700 font-bold">{topperPct}%</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      {gap === 0 ? (
                        <span className="font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Matched Topper's highest score! Top Ranker 🎉</span>
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700">
                          Gap to Topper: -{gap} marks ({Math.round((gap / attempt.totalMarks) * 100)}% gap)
                        </span>
                      )}
                      <span className="text-slate-400 font-mono">RGUKT CET Benchmark</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attempt Detailed Solution Inspector Modal */}
      {inspectingAttemptId && (
        <AttemptInspectorModal
          attemptId={inspectingAttemptId}
          onClose={() => setInspectingAttemptId(null)}
        />
      )}
    </div>
  );
};
