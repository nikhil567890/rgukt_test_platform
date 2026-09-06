import React, { useEffect, useState } from 'react';
import { testApi } from '../../services/api';
import { TestPaper } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen,
  Clock,
  Award,
  Lock,
  Sparkles,
  PlayCircle,
  RotateCcw,
  CheckCircle,
  HelpCircle,
  Search,
} from 'lucide-react';

interface TestListProps {
  onStartExam: (testId: string) => void;
  onOpenPaywall: () => void;
}

export const TestList: React.FC<TestListProps> = ({ onStartExam, onOpenPaywall }) => {
  const { isPremium, isAdmin } = useAuth();
  const [tests, setTests] = useState<TestPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTests = async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    setError(null);
    try {
      const res = await testApi.getAvailableTests();
      setTests(res.tests);
    } catch (err: any) {
      if (err.code === 'PREMIUM_REQUIRED' || err.status === 402) {
        setError('PREMIUM_REQUIRED');
      } else {
        setError(err.message || 'Failed to fetch test papers');
      }
    } finally {
      if (showLoadingState) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTests(true);

    const handleSync = () => {
      fetchTests(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTests(false);
      }
    };

    window.addEventListener('testSeriesUpdated', handleSync);
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Silent background polling every 8s for live admin updates
    const pollInterval = setInterval(() => {
      fetchTests(false);
    }, 8000);

    return () => {
      window.removeEventListener('testSeriesUpdated', handleSync);
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, []);

  const filteredTests = tests.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="test-list-page" className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-extrabold mb-1.5 inline-block">
            VSMC • Vinodh Sir RGUKT Testprep
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Vinodh Sir Test Series
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Practice with the Vinodh Sir Test Series and prepare effectively for RGUKT CET with online tests, timed mock exams, and instant performance analysis.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject or title..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Paywall Banner if Free Student */}
      {!isPremium && !isAdmin && (
        <div id="paywall-banner-card" className="bg-slate-900 rounded-xl p-5 text-white shadow-sm border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Test Papers Locked (Premium Subscription Required)</span>
            </h3>
            <p className="text-xs text-slate-300">
              Complete payment of ₹3000 to unlock 365 days of full access to all mock exams, countdown timers, and detailed solutions.
            </p>
          </div>

          <button
            onClick={onOpenPaywall}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-2xs transition-all cursor-pointer shrink-0 inline-flex items-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Unlock All Papers (₹3000)</span>
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Fetching test papers...</p>
        </div>
      ) : error === 'PREMIUM_REQUIRED' ? (
        <div className="text-center py-10 px-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 max-w-lg mx-auto">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto border border-amber-100">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-900">Access Restricted</h3>
          <p className="text-xs text-slate-600">
            You must upgrade to Premium to view and attempt RGUKT test papers.
          </p>
          <button
            onClick={onOpenPaywall}
            className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs shadow-2xs"
          >
            Pay ₹3000 to Unlock
          </button>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700 text-xs">No Published Tests Found</p>
          <p className="text-xs text-slate-400">Please check back later or contact admin.</p>
        </div>
      ) : (
        <div id="test-papers-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTests.map((test) => {
            const isLocked = !isPremium && !isAdmin;

            return (
              <div
                key={test.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs hover:border-indigo-300 transition-all p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                {/* Subject Badge */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-extrabold uppercase tracking-wider border border-indigo-100">
                      {test.subject}
                    </span>
                    {test.isAttempted && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle className="w-3 h-3" />
                        <span>Attempted</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                    {test.title}
                  </h3>
                </div>

                {/* Test Meta Specs */}
                <div className="grid grid-cols-3 gap-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                  <div>
                    <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Duration</p>
                    <p className="text-xs font-bold text-slate-800 flex items-center justify-center gap-0.5 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{test.durationMin}m</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Questions</p>
                    <p className="text-xs font-bold text-slate-800 flex items-center justify-center gap-0.5 mt-0.5">
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                      <span>{test.questionCount || 0}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Total Marks</p>
                    <p className="text-xs font-bold text-slate-800 flex items-center justify-center gap-0.5 mt-0.5">
                      <Award className="w-3 h-3 text-slate-400" />
                      <span>{test.totalMarks}</span>
                    </p>
                  </div>
                </div>

                {/* Score Status if attempted */}
                {test.isAttempted && test.userLastScore !== null && (
                  <div className="p-2 rounded-md bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs flex items-center justify-between font-semibold">
                    <span className="text-[11px] text-indigo-700">Last Score:</span>
                    <span className="font-bold text-indigo-900 text-xs">
                      {test.userLastScore} / {test.totalMarks} ({test.userLastPercentage}%)
                    </span>
                  </div>
                )}

                {/* Action Button */}
                {isLocked ? (
                  <button
                    onClick={onOpenPaywall}
                    className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold rounded-lg text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer shadow-2xs"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Unlock Test (₹3000)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onStartExam(test.id)}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {test.isAttempted ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retake Test Paper</span>
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Start Test Paper</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
