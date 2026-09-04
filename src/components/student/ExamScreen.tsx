import React, { useState, useEffect, useRef } from 'react';
import { testApi } from '../../services/api';
import { TestPaper, Question } from '../../types';
import { db, auth } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { MathText } from '../common/MathText';
import { QuestionAudioButton } from '../common/QuestionAudioButton';
import { cleanDisplayQuestionText } from '../../utils/csvParser';
import {
  Clock,
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  HelpCircle,
  X,
  CheckCircle2,
} from 'lucide-react';

interface ExamScreenProps {
  testId: string;
  onExamSubmitted: (attemptId: string) => void;
  onCancelExam: () => void;
}

export const ExamScreen: React.FC<ExamScreenProps> = ({
  testId,
  onExamSubmitted,
  onCancelExam,
}) => {
  const { user } = useAuth();
  const [test, setTest] = useState<TestPaper | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answers record: { [questionId]: "A" | "B" | "C" | "D" }
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Marked for review: Set of questionIds
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());

  // Timer state
  const [totalDurationSec, setTotalDurationSec] = useState<number>(900);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);
  const [timeTakenSec, setTimeTakenSec] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [show5MinBanner, setShow5MinBanner] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submit confirmation modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch test details & questions
  useEffect(() => {
    let isMounted = true;
    const loadTest = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await testApi.getTestPaper(testId);
        if (isMounted) {
          setTest(res.test);
          setQuestions(res.test.questions || []);
          const durationSeconds = (res.test.durationMin || 15) * 60;
          setTotalDurationSec(durationSeconds);
          setTimeLeftSec(durationSeconds);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load test paper questions');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadTest();
    return () => {
      isMounted = false;
    };
  }, [testId]);

  // Countdown timer effect
  useEffect(() => {
    if (isLoading || !test || timeLeftSec <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current as NodeJS.Timeout);
          // Auto-submit when time expires!
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });

      setTimeTakenSec((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading, test]);

  const handleAutoSubmit = () => {
    console.log('Time expired! Auto submitting test attempt...');
    setIsAutoSubmitting(true);
    submitTestAttempt();
  };

  const submitTestAttempt = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitModal(false);

    try {
      const res = await testApi.submitTestAttempt(testId, answers, timeTakenSec);
      if (res.success && res.attemptId) {
        // Sync attempt record to Firestore for live TopperComparison benchmarking
        if (auth.currentUser) {
          try {
            const score = res.score || 0;
            const total = res.totalMarks || 50;
            const pct = Math.round((score / total) * 100);
            await setDoc(doc(db, 'attempts', res.attemptId), {
              id: res.attemptId,
              studentId: auth.currentUser.uid,
              studentName: user?.name || 'Student',
              studentEmail: user?.email || auth.currentUser.email || '',
              testId,
              testTitle: test?.title || 'Mock Test',
              subject: test?.subject || 'General',
              score,
              totalMarks: total,
              percentage: pct,
              timeTakenSec,
              submittedAt: new Date().toISOString(),
            }, { merge: true });
          } catch (fsErr) {
            console.warn('Non-blocking Firestore sync notice:', fsErr);
          }
        }

        onExamSubmitted(res.attemptId);
      } else {
        setError('Failed to record attempt. Please check network.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      console.error('Error submitting exam:', err);
      setError(err.message || 'Failed to submit test attempt');
      setIsSubmitting(false);
    }
  };

  const handleOptionSelect = (questionId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleClearAnswer = (questionId: string) => {
    setAnswers((prev) => {
      const updated = { ...prev };
      delete updated[questionId];
      return updated;
    });
  };

  const toggleMarkForReview = (questionId: string) => {
    setMarkedForReview((prev) => {
      const updated = new Set(prev);
      if (updated.has(questionId)) updated.delete(questionId);
      else updated.add(questionId);
      return updated;
    });
  };

  if (isLoading) {
    return (
      <div id="exam-loading" className="flex flex-col items-center justify-center min-h-[500px] space-y-3">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-700">Loading RGUKT CET Question Paper...</p>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
        <h3 className="font-bold text-red-800 text-base">Failed to Start Exam</h3>
        <p className="text-xs text-red-600">{error || 'Test not found'}</p>
        <button
          onClick={onCancelExam}
          className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl text-xs"
        >
          Return to Test Papers
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;

  // Timer status thresholds
  const isWarning5Min = timeLeftSec <= 300 && timeLeftSec > 0; // <= 5 mins
  const isCritical1Min = timeLeftSec <= 60 && timeLeftSec > 0;  // <= 1 min
  const timeProgressPct = totalDurationSec > 0 ? (timeLeftSec / totalDurationSec) * 100 : 0;

  const answeredCount = Object.keys(answers).length;
  const totalQCount = questions.length;
  const unansweredCount = totalQCount - answeredCount;

  return (
    <div id="exam-taking-page" className="space-y-5 pb-12">
      {/* Top Sticky Header & Timer Bar */}
      <div
        id="exam-header-bar"
        className="bg-slate-900 text-white rounded-xl shadow-md sticky top-16 z-30 border border-slate-800 overflow-hidden"
      >
        <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-400/30">
              {test.subject}
            </span>
            <h2 className="text-base font-extrabold text-white mt-0.5">{test.title}</h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* Countdown Timer Display Box */}
            <div
              id="countdown-timer-box"
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg border font-mono font-black text-sm sm:text-base transition-all ${
                isCritical1Min
                  ? 'bg-red-600/30 border-red-500 text-red-300 animate-bounce shadow-lg shadow-red-900/40'
                  : isWarning5Min
                  ? 'bg-amber-500/25 border-amber-400/60 text-amber-300 animate-pulse'
                  : 'bg-white/10 border-white/20 text-indigo-300'
              }`}
            >
              <Clock className={`w-4 h-4 ${isWarning5Min ? 'text-amber-400' : ''}`} />
              <div className="flex flex-col text-right leading-none">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold">
                  Time Left
                </span>
                <span>
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>
            </div>

            <button
              id="btn-trigger-submit-modal"
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Exam</span>
            </button>
          </div>
        </div>

        {/* Visual Progress Line showing time remaining */}
        <div className="w-full bg-slate-800 h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              isCritical1Min ? 'bg-red-500' : isWarning5Min ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, timeProgressPct))}%` }}
          />
        </div>
      </div>

      {/* 5-Minute Warning Alert Banner */}
      {isWarning5Min && show5MinBanner && (
        <div
          id="five-minute-warning-banner"
          className={`p-3.5 sm:p-4 rounded-xl border flex items-center justify-between gap-3 shadow-md transition-all ${
            isCritical1Min
              ? 'bg-red-900/90 border-red-500 text-white animate-pulse'
              : 'bg-amber-500/10 border-amber-400 text-amber-950 dark:text-amber-200'
          }`}
        >
          <div className="flex items-start space-x-3">
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${isCritical1Min ? 'text-white' : 'text-amber-600'}`} />
            <div>
              <p className="font-extrabold text-xs sm:text-sm">
                {isCritical1Min
                  ? '⚡ Final Minute Warning! Test auto-submitting in less than 60 seconds!'
                  : '⚠️ 5 Minutes Remaining Warning!'}
              </p>
              <p className="text-[11px] sm:text-xs opacity-90 mt-0.5">
                You have {minutes} minute{minutes !== 1 ? 's' : ''} and {seconds} second{seconds !== 1 ? 's' : ''} remaining. Please review your answers before the time expires. When the clock hits 00:00, your test paper will be automatically submitted.
              </p>
            </div>
          </div>

          {!isCritical1Min && (
            <button
              onClick={() => setShow5MinBanner(false)}
              className="text-amber-700 hover:text-amber-900 p-1 rounded-lg hover:bg-amber-200/50 cursor-pointer shrink-0"
              title="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Main Layout Grid (Question View + Question Palette) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Main Question Card (3 cols on desktop) */}
        <div className="lg:col-span-3 space-y-5">
          <div id="current-question-card" className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-5">
            {/* Question Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-xs flex items-center justify-center">
                  Q{currentIndex + 1}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  out of {totalQCount} questions
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  +{currentQ?.marks || 1} Mark
                </span>

                {currentQ && (
                  <QuestionAudioButton
                    questionText={cleanDisplayQuestionText(currentQ.questionText)}
                    options={[
                      { label: 'A', text: currentQ.optionA },
                      { label: 'B', text: currentQ.optionB },
                      { label: 'C', text: currentQ.optionC },
                      { label: 'D', text: currentQ.optionD },
                    ]}
                  />
                )}

                <button
                  type="button"
                  onClick={() => currentQ && toggleMarkForReview(currentQ.id)}
                  className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center space-x-1 cursor-pointer ${
                    currentQ && markedForReview.has(currentQ.id)
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${currentQ && markedForReview.has(currentQ.id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                  <span className="hidden sm:inline">
                    {currentQ && markedForReview.has(currentQ.id) ? 'Marked' : 'Mark Review'}
                  </span>
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
              <MathText text={cleanDisplayQuestionText(currentQ?.questionText || '')} />
            </div>

            {/* Options List A, B, C, D */}
            <div className="space-y-2.5 pt-1">
              {[
                { label: 'A', text: currentQ?.optionA },
                { label: 'B', text: currentQ?.optionB },
                { label: 'C', text: currentQ?.optionC },
                { label: 'D', text: currentQ?.optionD },
              ].map(({ label, text }) => {
                const isSelected = currentQ && answers[currentQ.id] === label;

                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => currentQ && handleOptionSelect(currentQ.id, label)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center space-x-3 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-500 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {label}
                    </div>

                    <div className={`text-xs sm:text-sm font-semibold flex-1 ${isSelected ? 'text-indigo-950 font-bold' : 'text-slate-800'}`}>
                      <MathText text={text || ''} inline />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Action Bar Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => currentQ && handleClearAnswer(currentQ.id)}
                disabled={!currentQ || !answers[currentQ.id]}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
              >
                Clear Selected Answer
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 font-bold rounded-lg text-xs text-slate-700 flex items-center space-x-1 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(totalQCount - 1, prev + 1))}
                  disabled={currentIndex === totalQCount - 1}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center space-x-1 disabled:opacity-40 cursor-pointer"
                >
                  <span>Next Question</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Question Palette */}
        <div id="question-palette-sidebar" className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 h-fit shadow-2xs">
          <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span>Question Palette</span>
          </h3>

          {/* Palette Legend */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <span>Answered ({answeredCount})</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Review ({markedForReview.size})</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300" />
              <span>Unanswered ({unansweredCount})</span>
            </div>
          </div>

          {/* Question Grid Buttons */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isMarked = markedForReview.has(q.id);
              const isCurrent = idx === currentIndex;

              let btnClasses = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
              if (isMarked) {
                btnClasses = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
              } else if (isAnswered) {
                btnClasses = 'bg-indigo-600 text-white border-indigo-600 font-bold';
              }

              if (isCurrent) {
                btnClasses += ' ring-2 ring-indigo-500 ring-offset-1';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-9 h-9 rounded-lg text-xs font-bold border flex items-center justify-center transition-all cursor-pointer ${btnClasses}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
            <p className="flex justify-between font-semibold text-[11px]">
              <span>Total Questions:</span>
              <span className="text-slate-900 font-bold">{totalQCount}</span>
            </p>
            <p className="flex justify-between font-semibold text-[11px]">
              <span>Answered:</span>
              <span className="text-indigo-600 font-bold">{answeredCount}</span>
            </p>
            <p className="flex justify-between font-semibold text-[11px]">
              <span>Unanswered:</span>
              <span className="text-amber-600 font-bold">{unansweredCount}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div id="submit-confirm-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-100 space-y-5 relative">
            <button
              onClick={() => setShowSubmitModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1.5">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center mx-auto border border-indigo-100">
                <Send className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Submit Test Paper?
              </h3>
              <p className="text-xs text-slate-500">
                Review your exam summary before final submission.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-600">Total Questions:</span>
                <span className="text-slate-900 font-bold">{totalQCount}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-indigo-700">Answered Questions:</span>
                <span className="text-indigo-700 font-bold">{answeredCount}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-amber-700">Unanswered Questions:</span>
                <span className="text-amber-700 font-bold">{unansweredCount}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-600">Time Remaining:</span>
                <span className="font-mono text-slate-900 font-bold">{minutes}m {seconds}s</span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 text-[11px] font-semibold text-center">
                ⚠️ You still have {unansweredCount} unanswered questions!
              </p>
            )}

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="w-1/2 py-2 rounded-lg border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Continue Test
              </button>
              <button
                type="button"
                onClick={submitTestAttempt}
                disabled={isSubmitting}
                className="w-1/2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Evaluating...' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Auto-Submit Time Expired Modal Overlay */}
      {isAutoSubmitting && (
        <div id="auto-submit-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-red-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-200">
              <Clock className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Time Has Expired!</h3>
              <p className="text-xs text-slate-600 mt-1">
                Your exam duration has ended. We are automatically recording your answers and submitting your test attempt.
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-xs font-semibold text-red-800 flex items-center justify-center space-x-2">
              <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              <span>Auto-submitting test responses...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
