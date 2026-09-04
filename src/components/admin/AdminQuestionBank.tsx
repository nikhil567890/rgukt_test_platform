import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import { MathText } from '../common/MathText';
import { QuestionAudioButton } from '../common/QuestionAudioButton';
import { cleanDisplayQuestionText } from '../../utils/csvParser';
import { HelpCircle, Search, Filter, Plus, BookOpen, Check, Trash2, CheckCircle2 } from 'lucide-react';

export const AdminQuestionBank: React.FC = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ALL');

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getQuestionBank();
      setQuestions(res.questions || []);
    } catch (err: any) {
      console.error('Error fetching question bank:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const filteredQuestions = questions.filter((q) => {
    const matchesSubject = selectedSubject === 'ALL' || (q.test && q.test.subject === selectedSubject);
    const matchesSearch =
      q.questionText.toLowerCase().includes(search.toLowerCase()) ||
      q.optionA.toLowerCase().includes(search.toLowerCase()) ||
      q.optionB.toLowerCase().includes(search.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div id="admin-question-bank-page" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30">
            Repository
          </span>
          <h1 className="text-2xl font-black text-white mt-1">Central Question Bank</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Search, filter, and inspect MCQs across all RGUKT Entrance mock papers.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions or options..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
          >
            <option value="ALL">All Mathematics Topics</option>
            <option value="Mathematics">General Mathematics</option>
            <option value="Algebra">Algebra & Polynomials</option>
            <option value="Trigonometry">Trigonometry & Applications</option>
            <option value="Geometry">Geometry & Mensuration</option>
            <option value="Statistics">Statistics & Probability</option>
          </select>
        </div>
      </div>

      {/* Question Cards List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading questions from database...</p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Questions Found</h3>
          <p className="text-xs text-slate-500">Try adjusting your subject filter or search keyword.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                    Q{idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider">
                    {q.test?.subject || 'Mathematics'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium truncate max-w-xs">
                    Paper: {q.test?.title || 'Mock Test'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[10px]">
                    {q.marks || 1} Mark
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

              <div className="text-sm font-bold text-slate-900 leading-snug">
                <MathText text={cleanDisplayQuestionText(q.questionText)} />
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                  const optText = q[`option${optKey}`];
                  const isCorrect = q.correctOption === optKey;

                  return (
                    <div
                      key={optKey}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        isCorrect
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 flex-1">
                        <strong className="font-bold shrink-0">{optKey}.</strong>
                        <div className="flex-1">
                          <MathText text={optText || ''} inline />
                        </div>
                      </div>
                      {isCorrect && <Check className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />}
                    </div>
                  );
                })}
              </div>

              {q.explanation && (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                  <strong className="font-bold text-indigo-950 block mb-0.5">Explanation:</strong>
                  <MathText text={q.explanation} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
