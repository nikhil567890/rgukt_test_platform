import React, { useEffect, useState } from 'react';
import { testApi } from '../../services/api';
import { AttemptResult } from '../../types';
import { MathText } from './MathText';
import {
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Award,
  Sparkles,
  BookOpen,
  Loader2,
  User,
} from 'lucide-react';

interface AttemptInspectorModalProps {
  attemptId: string | null;
  onClose: () => void;
}

export const AttemptInspectorModal: React.FC<AttemptInspectorModalProps> = ({
  attemptId,
  onClose,
}) => {
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'CORRECT' | 'WRONG' | 'SKIPPED'>('ALL');

  useEffect(() => {
    if (!attemptId) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await testApi.getAttemptResult(attemptId);
        setResult(res);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch detailed attempt analysis');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [attemptId]);

  if (!attemptId) return null;

  const filteredQuestions = result
    ? result.questions.filter((q) => {
        if (filter === 'CORRECT') return q.isCorrect;
        if (filter === 'WRONG') return q.studentAnswer && !q.isCorrect;
        if (filter === 'SKIPPED') return !q.studentAnswer;
        return true;
      })
    : [];

  const correctCount = result?.questions.filter((q) => q.isCorrect).length || 0;
  const wrongCount = result?.questions.filter((q) => q.studentAnswer && !q.isCorrect).length || 0;
  const skippedCount = result?.questions.filter((q) => !q.studentAnswer).length || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase border border-indigo-400/30">
              Exam Response Breakdown
            </span>
            <h2 className="text-lg font-black text-white mt-1">
              {result ? result.testTitle : 'Loading Exam Detailed Analysis...'}
            </h2>
            {result?.studentName && (
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>Student: <strong className="text-white">{result.studentName}</strong></span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading exam questions & answers...</p>
            </div>
          ) : error || !result ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-2">
              <XCircle className="w-8 h-8 text-red-600 mx-auto" />
              <p className="font-bold text-red-800 text-sm">{error || 'Attempt result unavailable'}</p>
            </div>
          ) : (
            <>
              {/* Overview Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-900 text-white rounded-xl border border-slate-800 text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Score Obtained</p>
                  <p className="text-xl font-black text-white mt-0.5">
                    {result.score} / {result.totalMarks}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-400">
                    {Math.round((result.score / result.totalMarks) * 100)}% Marks
                  </p>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-[10px] uppercase font-bold text-emerald-800">Correct</p>
                  <p className="text-xl font-black text-emerald-700 mt-0.5">{correctCount}</p>
                  <p className="text-[10px] font-medium text-emerald-600">Questions</p>
                </div>

                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-center">
                  <p className="text-[10px] uppercase font-bold text-red-800">Incorrect</p>
                  <p className="text-xl font-black text-red-700 mt-0.5">{wrongCount}</p>
                  <p className="text-[10px] font-medium text-red-600">Questions</p>
                </div>

                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-[10px] uppercase font-bold text-amber-800">Time Taken</p>
                  <p className="text-xl font-black text-amber-700 mt-0.5">
                    {Math.floor(result.timeTakenSec / 60)}m {result.timeTakenSec % 60}s
                  </p>
                  <p className="text-[10px] font-medium text-amber-600">
                    ~{Math.round(result.timeTakenSec / Math.max(1, result.questions.length))}s / Question
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between pt-2 border-b border-slate-200 pb-3">
                <p className="text-xs font-black text-slate-800">Detailed Question Audit</p>
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  {(['ALL', 'CORRECT', 'WRONG', 'SKIPPED'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                        filter === f
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f === 'ALL'
                        ? `All (${result.questions.length})`
                        : f === 'CORRECT'
                        ? `Correct (${correctCount})`
                        : f === 'WRONG'
                        ? `Wrong (${wrongCount})`
                        : `Skipped (${skippedCount})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {filteredQuestions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No questions matching this filter.</p>
                ) : (
                  filteredQuestions.map((q, idx) => {
                    const originalIndex = result.questions.findIndex((item) => item.id === q.id) + 1;
                    return (
                      <div
                        key={q.id}
                        className={`p-4 rounded-xl border space-y-3 transition-all ${
                          q.isCorrect
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : q.studentAnswer
                            ? 'bg-red-50/40 border-red-200'
                            : 'bg-amber-50/30 border-amber-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center space-x-2 flex-1">
                            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                              Q{originalIndex}
                            </span>
                            <div className="text-xs font-bold text-slate-900 flex-1">
                              <MathText text={q.questionText} />
                            </div>
                          </div>

                          <div className="shrink-0">
                            {q.isCorrect ? (
                              <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Correct (+{q.marks})</span>
                              </span>
                            ) : q.studentAnswer ? (
                              <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-800 text-[10px] font-black border border-red-200 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5 text-red-600" />
                                <span>Incorrect (0)</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200 flex items-center gap-1">
                                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Skipped (0)</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Options Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                          {[
                            { key: 'A', text: q.optionA },
                            { key: 'B', text: q.optionB },
                            { key: 'C', text: q.optionC },
                            { key: 'D', text: q.optionD },
                          ].map((opt) => {
                            const isCorrectOpt = q.correctOption?.toUpperCase() === opt.key;
                            const isSelectedOpt = q.studentAnswer?.toUpperCase() === opt.key;

                            let optStyle = 'bg-white border-slate-200 text-slate-700';
                            if (isCorrectOpt) {
                              optStyle = 'bg-emerald-100 border-emerald-400 font-bold text-emerald-900';
                            } else if (isSelectedOpt && !isCorrectOpt) {
                              optStyle = 'bg-red-100 border-red-300 font-bold text-red-900 line-through';
                            }

                            return (
                              <div
                                key={opt.key}
                                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${optStyle}`}
                              >
                                <div className="flex items-center space-x-2 flex-1">
                                  <span className="font-extrabold text-[10px] w-5 h-5 rounded bg-slate-200/60 flex items-center justify-center shrink-0">
                                    {opt.key}
                                  </span>
                                  <div className="flex-1">
                                    <MathText text={opt.text} inline />
                                  </div>
                                </div>
                                {isCorrectOpt && (
                                  <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded uppercase shrink-0">
                                    Correct
                                  </span>
                                )}
                                {isSelectedOpt && !isCorrectOpt && (
                                  <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded uppercase shrink-0">
                                    Your Pick
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation Box */}
                        {q.explanation && (
                          <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1">
                            <p className="font-extrabold text-[10px] text-indigo-800 flex items-center gap-1 uppercase">
                              <Sparkles className="w-3 h-3 text-indigo-600" />
                              <span>Step-by-step Explanation:</span>
                            </p>
                            <div className="leading-relaxed text-[11px] font-medium">
                              <MathText text={q.explanation} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};
