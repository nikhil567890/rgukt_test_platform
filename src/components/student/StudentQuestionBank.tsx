import React, { useState, useEffect } from 'react';
import { testApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { MathText } from '../common/MathText';
import { QuestionAudioButton } from '../common/QuestionAudioButton';
import { cleanDisplayQuestionText } from '../../utils/csvParser';
import { HelpCircle, Search, Filter, Eye, EyeOff, Sparkles, BookOpen, Loader2, Check, Lock } from 'lucide-react';

const SUBJECT_OPTIONS = ['ALL', 'Mathematics', 'Algebra', 'Trigonometry', 'Coordinate Geometry', 'Statistics & Probability'];

interface StudentQuestionBankProps {
  onOpenPaywall?: () => void;
}

export const StudentQuestionBank: React.FC<StudentQuestionBankProps> = ({ onOpenPaywall }) => {
  const { isPremium, isAdmin } = useAuth();
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  // Track revealed answers map { [questionId]: boolean }
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

  const fetchQuestionBank = async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    setError('');
    try {
      const res = await testApi.getQuestionBank({
        subject: selectedSubject !== 'ALL' ? selectedSubject : undefined,
      });
      setQuestions(res.questions || []);
    } catch (err: any) {
      console.error('Failed to fetch question bank:', err);
      if (err.message?.includes('PREMIUM_REQUIRED') || err.message?.includes('Premium subscription')) {
        setError('PREMIUM_REQUIRED');
      } else {
        setError('Failed to load question bank data.');
      }
    } finally {
      if (showLoadingState) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isPremium || isAdmin) {
      fetchQuestionBank(true);
    } else {
      setIsLoading(false);
    }

    const handleSync = () => {
      if (isPremium || isAdmin) {
        fetchQuestionBank(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (isPremium || isAdmin)) {
        fetchQuestionBank(false);
      }
    };

    window.addEventListener('testSeriesUpdated', handleSync);
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const pollInterval = setInterval(() => {
      if (isPremium || isAdmin) {
        fetchQuestionBank(false);
      }
    }, 10000);

    return () => {
      window.removeEventListener('testSeriesUpdated', handleSync);
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [selectedSubject, isPremium, isAdmin]);

  const toggleRevealAnswer = (qId: string) => {
    setRevealedAnswers((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const filteredQuestions = questions.filter((q) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      q.questionText.toLowerCase().includes(term) ||
      q.optionA.toLowerCase().includes(term) ||
      q.optionB.toLowerCase().includes(term) ||
      q.optionC.toLowerCase().includes(term) ||
      q.optionD.toLowerCase().includes(term) ||
      (q.explanation && q.explanation.toLowerCase().includes(term)) ||
      (q.test?.title && q.test.title.toLowerCase().includes(term))
    );
  });

  return (
    <div id="student-question-bank-page" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-400/30">
            Self-Practice Repository
          </span>
          <h1 className="text-2xl font-black text-white mt-1">Uploaded Question Bank</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Browse through all official RGUKT practice questions uploaded to the platform with step-by-step solutions.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Subject Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {SUBJECT_OPTIONS.map((subj) => (
            <button
              key={subj}
              onClick={() => setSelectedSubject(subj)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                selectedSubject === subj
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {subj === 'ALL' ? 'All Subjects' : subj}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search questions or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-900">{filteredQuestions.length}</strong> questions
        </span>
        {selectedSubject !== 'ALL' && (
          <span className="font-semibold text-indigo-600">
            Filtered by: {selectedSubject}
          </span>
        )}
      </div>

      {/* Questions Feed */}
      {!isPremium && !isAdmin ? (
        <div id="question-bank-locked-card" className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4 max-w-xl mx-auto my-6">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-2xs">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-900">Question Bank Locked</h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
              The chapter-wise practice repository is unlocked exclusively for <strong className="text-slate-900">Premium Members</strong>. Complete the ₹3000 annual subscription payment for 365 days of full access to step-by-step solutions, explanations, and audio questions.
            </p>
          </div>
          <button
            id="btn-unlock-qb-paywall"
            onClick={onOpenPaywall}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer inline-flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Unlock Question Bank (₹3000)</span>
          </button>
        </div>
      ) : isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading uploaded questions...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold text-center">
          {error === 'PREMIUM_REQUIRED' ? 'Premium subscription required to access the Question Bank.' : error}
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Questions Found</h3>
          <p className="text-xs text-slate-500 mt-1">
            No questions matching your search criteria have been uploaded yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => {
            const isRevealed = !!revealedAnswers[q.id];

            return (
              <div
                key={q.id || idx}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 hover:border-slate-300 transition-all"
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                      Q{idx + 1}
                    </span>
                    <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                      {q.test?.subject || 'General'}
                    </span>
                    {q.test?.title && (
                      <span className="text-slate-500 text-[11px] font-medium hidden sm:inline">
                        • {q.test.title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 text-[11px] font-bold">
                      {q.marks || 1} Mark{(q.marks || 1) > 1 ? 's' : ''}
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
                </div>

                {/* Question Text */}
                <div className="text-sm font-bold text-slate-900 leading-relaxed">
                  <MathText text={cleanDisplayQuestionText(q.questionText)} />
                </div>

                {/* Options List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {[
                    { key: 'A', text: q.optionA },
                    { key: 'B', text: q.optionB },
                    { key: 'C', text: q.optionC },
                    { key: 'D', text: q.optionD },
                  ].map((opt) => {
                    const isCorrect = isRevealed && q.correctOption?.toUpperCase() === opt.key;
                    return (
                      <div
                        key={opt.key}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold ring-1 ring-emerald-400'
                            : 'bg-slate-50/70 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2 flex-1">
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center font-extrabold text-[10px] shrink-0 ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200/80 text-slate-700'
                            }`}
                          >
                            {opt.key}
                          </span>
                          <div className="flex-1">
                            <MathText text={opt.text || ''} inline />
                          </div>
                        </div>
                        {isCorrect && (
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-200/60 px-1.5 py-0.5 rounded shrink-0 ml-1">
                            Correct Answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Actions & Explanation */}
                <div className="pt-2 border-t border-slate-100 flex flex-col space-y-3">
                  <button
                    onClick={() => toggleRevealAnswer(q.id)}
                    className="self-start px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isRevealed ? 'Hide Answer & Explanation' : 'View Correct Answer & Explanation'}</span>
                  </button>

                  {isRevealed && (
                    <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-950 space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-bold text-indigo-900">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Explanation & Solution:</span>
                      </div>
                      <div className="leading-relaxed pl-5 whitespace-pre-line text-slate-800">
                        <MathText text={q.explanation || 'No step-by-step explanation provided.'} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
