import React, { useEffect, useState } from 'react';
import { testApi } from '../../services/api';
import { AttemptResult } from '../../types';
import { MathText } from '../common/MathText';
import { QuestionAudioButton } from '../common/QuestionAudioButton';
import { cleanDisplayQuestionText } from '../../utils/csvParser';
import {
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft,
  Sparkles,
  BookOpen,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

interface SolutionViewProps {
  attemptId: string;
  onBackToDashboard: () => void;
  onRetakeTest?: (testId: string) => void;
}

export const SolutionView: React.FC<SolutionViewProps> = ({
  attemptId,
  onBackToDashboard,
  onRetakeTest,
}) => {
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResult = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await testApi.getAttemptResult(attemptId);
        setResult(res);
      } catch (err: any) {
        setError(err.message || 'Failed to load attempt solutions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResult();
  }, [attemptId]);

  if (isLoading) {
    return (
      <div id="solutions-loading" className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Generating detailed question breakdown & solutions...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
        <XCircle className="w-8 h-8 text-red-600 mx-auto" />
        <p className="font-bold text-red-800 text-sm">{error || 'Solutions not found'}</p>
        <button
          onClick={onBackToDashboard}
          className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { testTitle, subject, score, totalMarks, timeTakenSec, topperScore, questions } = result;
  const percentage = Math.round((score / totalMarks) * 100);
  const topperPct = Math.round((topperScore / totalMarks) * 100);
  const gap = topperScore - score;

  const correctCount = questions.filter((q) => q.isCorrect).length;
  const incorrectCount = questions.filter((q) => q.studentAnswer && !q.isCorrect).length;
  const unattemptedCount = questions.filter((q) => !q.studentAnswer).length;

  return (
    <div id="solution-view-page" className="space-y-6 pb-12">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToDashboard}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>

        <span className="text-[11px] text-slate-400 font-mono">
          Attempt ID: {attemptId.substring(0, 8)}
        </span>
      </div>

      {/* Result Scoreboard Banner */}
      <div id="score-summary-card" className="bg-slate-900 rounded-2xl p-5 sm:p-6 text-white border border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider">
              {subject}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              {testTitle}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Time taken: {Math.floor(timeTakenSec / 60)}m {timeTakenSec % 60}s</span>
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 text-center min-w-[150px] shrink-0">
            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
              Your Final Score
            </p>
            <p className="text-2xl font-black text-white my-0.5">
              {score} <span className="text-xs font-normal text-slate-400">/ {totalMarks}</span>
            </p>
            <p className="text-xs font-bold text-emerald-400">{percentage}% Marks</p>
          </div>
        </div>

        {/* Topper Gap Comparison Indicator */}
        <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-400 text-[11px] font-medium">Correct Answers</p>
              <p className="text-sm font-bold text-white">{correctCount} Questions</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-400 text-[11px] font-medium">Incorrect / Skipped</p>
              <p className="text-sm font-bold text-white">{incorrectCount + unattemptedCount} Questions</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-400 text-[11px] font-medium">Topper Benchmark</p>
              <p className="text-sm font-bold text-amber-300">
                {topperScore} / {totalMarks} ({topperPct}%)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Solutions Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Step-by-Step Solutions & Analysis</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Review your answers with complete explanations for every question
          </p>
        </div>
      </div>

      {/* Questions Breakdown List */}
      <div id="solutions-question-list" className="space-y-4">
        {questions.map((q, idx) => {
          const isCorrect = q.isCorrect;
          const isAttempted = !!q.studentAnswer;

          return (
            <div
              key={q.id}
              className={`bg-white rounded-2xl border p-5 sm:p-6 space-y-4 shadow-2xs ${
                isCorrect
                  ? 'border-emerald-200'
                  : isAttempted
                  ? 'border-red-200'
                  : 'border-slate-200'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className="w-7 h-7 rounded-md bg-slate-100 text-slate-900 font-extrabold text-xs flex items-center justify-center">
                    Q{idx + 1}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    +{q.marks} Mark
                  </span>
                  <QuestionAudioButton
                    questionText={cleanDisplayQuestionText(q.questionText)}
                    options={[
                      { label: 'A', text: q.optionA },
                      { label: 'B', text: q.optionB },
                      { label: 'C', text: q.optionC },
                      { label: 'D', text: q.optionD },
                    ]}
                  />
                </div>

                {isCorrect ? (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Correct (+{q.marks})</span>
                  </span>
                ) : isAttempted ? (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-800 border border-red-200 text-xs font-bold">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    <span>Incorrect (0)</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                    <span>Unattempted (0)</span>
                  </span>
                )}
              </div>

              {/* Question Text */}
              <div className="text-sm font-bold text-slate-900 leading-relaxed">
                <MathText text={cleanDisplayQuestionText(q.questionText)} />
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { label: 'A', text: q.optionA },
                  { label: 'B', text: q.optionB },
                  { label: 'C', text: q.optionC },
                  { label: 'D', text: q.optionD },
                ].map(({ label, text }) => {
                  const isCorrectOption = label.toUpperCase() === q.correctOption.toUpperCase();
                  const isUserAnswer = q.studentAnswer && q.studentAnswer.toUpperCase() === label.toUpperCase();

                  let styleClasses = 'bg-slate-50 border-slate-200 text-slate-800';

                  if (isCorrectOption) {
                    styleClasses = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500';
                  } else if (isUserAnswer && !isCorrectOption) {
                    styleClasses = 'bg-red-50 border-red-400 text-red-950 font-medium';
                  }

                  return (
                    <div
                      key={label}
                      className={`p-3 rounded-xl border text-xs flex items-center space-x-2.5 ${styleClasses}`}
                    >
                      <span
                        className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center shrink-0 border ${
                          isCorrectOption
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : isUserAnswer
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        {label}
                      </span>
                      <div className="flex-1 text-xs">
                        <MathText text={text} inline />
                      </div>
                      {isCorrectOption && (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-200/60 px-1.5 py-0.5 rounded shrink-0">
                          Correct
                        </span>
                      )}
                      {isUserAnswer && !isCorrectOption && (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-red-700 bg-red-200/60 px-1.5 py-0.5 rounded shrink-0">
                          Your Choice
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation Box */}
              {q.explanation && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <p className="font-extrabold text-slate-900 flex items-center gap-1.5 text-indigo-800">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Detailed Solution / Explanation:</span>
                  </p>
                  <div className="text-slate-700 leading-relaxed pl-5 whitespace-pre-line text-xs">
                    <MathText text={q.explanation} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
