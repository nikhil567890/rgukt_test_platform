import React, { useState } from 'react';
import { Attempt, StudentExamAnalytics } from '../../types';
import {
  Award,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Search,
  Filter,
  Eye,
  Zap,
  Sparkles,
  BookOpen,
  Target,
  FileCheck,
} from 'lucide-react';

interface ExamAnalyticsViewProps {
  attempts: Attempt[];
  analytics?: StudentExamAnalytics;
  studentName?: string;
  onInspectAttempt: (attemptId: string) => void;
}

export const ExamAnalyticsView: React.FC<ExamAnalyticsViewProps> = ({
  attempts,
  analytics,
  studentName,
  onInspectAttempt,
}) => {
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');

  // Fallback computation if analytics prop not directly passed
  const totalExams = attempts.length;
  const avgPct =
    totalExams > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / totalExams)
      : 0;
  const maxPct = totalExams > 0 ? Math.max(...attempts.map((a) => a.percentage)) : 0;
  const totalTimeSpent = attempts.reduce((sum, a) => sum + (a.timeTakenSec || 0), 0);
  const totalMarksSum = attempts.reduce((sum, a) => sum + a.totalMarks, 0);

  // Filter attempts
  const filteredAttempts = attempts.filter((a) => {
    const matchesSearch =
      a.testTitle.toLowerCase().includes(search.toLowerCase()) ||
      a.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'ALL' || a.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  // Extract unique subjects
  const subjectsList = Array.from(new Set(attempts.map((a) => a.subject)));

  return (
    <div className="space-y-6">
      {/* Overview Analytics Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase border border-indigo-400/30">
              Exam Performance Analytics
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              {studentName ? `${studentName}'s Exam Analysis` : 'My Exam Performance Analysis'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive analysis of written test papers, speed, accuracy, and subject strengths.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border ${
                avgPct >= 75
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : avgPct >= 50
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-red-500/20 text-red-300 border-red-500/40'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>{analytics?.accuracyRating || (avgPct >= 75 ? 'Excellent' : avgPct >= 50 ? 'Average' : 'Needs Focus')}</span>
            </span>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl">
            <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Exams Written</span>
            </p>
            <p className="text-2xl font-black text-white mt-1">{totalExams}</p>
            <p className="text-[10px] text-indigo-300 font-semibold mt-0.5">Mock & Grand Tests</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl">
            <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Average Score</span>
            </p>
            <p className="text-2xl font-black text-white mt-1">{avgPct}%</p>
            <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Overall Accuracy</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl">
            <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Highest Score</span>
            </p>
            <p className="text-2xl font-black text-white mt-1">{maxPct}%</p>
            <p className="text-[10px] text-amber-300 font-semibold mt-0.5">Best Test Attempt</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl">
            <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Time Spent</span>
            </p>
            <p className="text-2xl font-black text-white mt-1">
              {Math.floor(totalTimeSpent / 60)}m
            </p>
            <p className="text-[10px] text-purple-300 font-semibold mt-0.5">
              ~{totalMarksSum > 0 ? Math.round(totalTimeSpent / totalMarksSum) : 0}s / question
            </p>
          </div>
        </div>
      </div>

      {/* Subject Mastery Analysis Matrix */}
      {analytics?.subjectBreakdown && analytics.subjectBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Subject Strength & Mastery Matrix</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-bold">
              {analytics.subjectBreakdown.length} Subjects Evaluated
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.subjectBreakdown.map((sb) => {
              const isStrong = sb.avgPercentage >= 70;
              const isWeak = sb.avgPercentage < 50;

              return (
                <div
                  key={sb.subject}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                      {sb.subject}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded ${
                        isStrong
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : isWeak
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isStrong ? 'Strong' : isWeak ? 'Needs Focus' : 'Moderate'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-lg font-black text-slate-900">{sb.avgPercentage}%</p>
                      <p className="text-[10px] text-slate-500 font-medium">Avg Percentage Score</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700">{sb.attemptCount} Tests</p>
                      <p className="text-[10px] text-slate-400">Peak: {sb.highestPercentage}%</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isStrong ? 'bg-emerald-500' : isWeak ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${sb.avgPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Written Exams Log & Filtered Attempt Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Written Exams History & Solution Inspector</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Select any exam to inspect exact question choices, correct keys, and explanations.
            </p>
          </div>

          {/* Search & Subject filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search exams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {subjectsList.length > 0 && (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="py-1 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Subjects</option>
                {subjectsList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Attempts List */}
        {filteredAttempts.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">No written exams found</p>
            <p className="text-[11px] text-slate-400">
              Attempt tests to generate detailed analysis and response logs.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAttempts.map((a) => {
              const topperPct = Math.round((a.topperScore / a.totalMarks) * 100);
              const minutes = Math.floor((a.timeTakenSec || 0) / 60);
              const seconds = (a.timeTakenSec || 0) % 60;

              return (
                <div
                  key={a.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-white transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-100">
                          {a.subject}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" />
                          <span>Submitted {new Date(a.submittedAt).toLocaleDateString()}</span>
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900 mt-1">{a.testTitle}</h4>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400">Score</p>
                        <p className="text-base font-black text-indigo-700">
                          {a.score} / {a.totalMarks}{' '}
                          <span className="text-xs text-emerald-600 font-bold">({a.percentage}%)</span>
                        </p>
                      </div>

                      <button
                        onClick={() => onInspectAttempt(a.id)}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Solution</span>
                      </button>
                    </div>
                  </div>

                  {/* Score & Topper Comparison Bar */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-600">Student Score Bar</span>
                        <span className="text-indigo-700">{a.percentage}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${a.percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-amber-700">Topper Score Bar</span>
                        <span className="text-amber-700">{topperPct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${topperPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Speed & Gap Footer */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Time: {minutes}m {seconds}s</span>
                    </span>
                    <span className="text-amber-800 font-bold">
                      Gap to Topper: {a.gapToTopper} marks
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
