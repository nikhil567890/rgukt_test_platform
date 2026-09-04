import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/api';
import { TestAnalyticsData } from '../../types';
import {
  ArrowLeft,
  Award,
  Clock,
  Users,
  BarChart2,
  Trophy,
  CheckCircle2,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface TestAnalyticsProps {
  testId: string;
  onBack: () => void;
}

export const TestAnalytics: React.FC<TestAnalyticsProps> = ({ testId, onBack }) => {
  const [data, setData] = useState<TestAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApi.getTestAnalytics(testId);
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to load test analytics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [testId]);

  if (isLoading) {
    return (
      <div id="analytics-loading" className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Computing test analytics & leaderboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
        <p className="font-bold text-red-800 text-sm">{error || 'Analytics not found'}</p>
        <button onClick={onBack} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs">
          Back to Tests
        </button>
      </div>
    );
  }

  const { test, analytics, leaderboard, questions } = data;
  const { totalAttempts, avgScore, avgTimeSec, scoreBuckets, topper } = analytics;

  const maxBucketCount = Math.max(...(Object.values(scoreBuckets || {}) as number[]), 1);

  return (
    <div id="test-analytics-page" className="space-y-6 pb-12">
      <button
        onClick={onBack}
        className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-all cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Test Papers</span>
      </button>

      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 text-white border border-slate-800 shadow-sm space-y-3">
        <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider inline-block">
          {test.subject} Analytics
        </span>
        <h1 className="text-xl sm:text-2xl font-black">{test.title}</h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10 text-xs">
          <div>
            <p className="text-slate-400 font-medium text-[11px]">Total Attempts</p>
            <p className="text-lg font-extrabold text-white">{totalAttempts}</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium text-[11px]">Average Score</p>
            <p className="text-lg font-extrabold text-emerald-400">
              {avgScore} / {test.totalMarks}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-medium text-[11px]">Average Time</p>
            <p className="text-lg font-extrabold text-white">
              {Math.floor(avgTimeSec / 60)}m {avgTimeSec % 60}s
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-medium text-[11px]">Test Topper</p>
            <p className="text-lg font-extrabold text-amber-300">
              {topper ? `${topper.score}/${test.totalMarks}` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Score Distribution & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Score Distribution Buckets */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-indigo-600" />
            <span>Score Distribution Buckets</span>
          </h2>

          <div className="space-y-2.5 pt-1">
            {Object.entries(scoreBuckets || {}).map(([bucket, count]) => {
              const countNum = Number(count);
              const pct = Math.round((countNum / maxBucketCount) * 100);

              return (
                <div key={bucket} className="space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-slate-700 text-[11px]">
                    <span>{bucket}</span>
                    <span>{count} Students</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard Top 10 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Top 10 Leaderboard</span>
          </h2>

          {leaderboard.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No submissions yet.</p>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.map((item) => (
                <div
                  key={item.rank}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <span
                      className={`w-5 h-5 rounded-full font-black flex items-center justify-center text-[10px] ${
                        item.rank === 1
                          ? 'bg-amber-400 text-slate-950'
                          : item.rank === 2
                          ? 'bg-slate-300 text-slate-900'
                          : item.rank === 3
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.rank}
                    </span>
                    <div>
                      <p className="font-extrabold text-slate-900 text-xs">{item.studentName}</p>
                      <p className="text-[10px] text-slate-400">{item.studentEmail}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-black text-indigo-700 text-xs">
                      {item.score} / {item.totalMarks} ({item.percentage}%)
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {Math.floor(item.timeTakenSec / 60)}m {item.timeTakenSec % 60}s
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Question Bank with Correct Options & Explanations */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <span>Question Papers & Solutions Keys</span>
        </h2>

        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q.id} className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                <span>Question #{idx + 1}</span>
                <span>+{q.marks} Mark</span>
              </div>
              <p className="font-bold text-slate-900 text-xs">{q.questionText}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p className={`p-2 rounded-lg border text-[11px] ${q.correctOption === 'A' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200'}`}>
                  A) {q.optionA}
                </p>
                <p className={`p-2 rounded-lg border text-[11px] ${q.correctOption === 'B' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200'}`}>
                  B) {q.optionB}
                </p>
                <p className={`p-2 rounded-lg border text-[11px] ${q.correctOption === 'C' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200'}`}>
                  C) {q.optionC}
                </p>
                <p className={`p-2 rounded-lg border text-[11px] ${q.correctOption === 'D' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200'}`}>
                  D) {q.optionD}
                </p>
              </div>
              {q.explanation && (
                <p className="text-[11px] text-emerald-900 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <strong>Solution:</strong> {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
