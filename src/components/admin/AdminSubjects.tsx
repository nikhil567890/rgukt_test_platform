import React, { useState } from 'react';
import { BookOpen, Plus, CheckCircle2, Award, ChevronRight, Hash } from 'lucide-react';

interface SubjectTopic {
  id: string;
  name: string;
  questionCount: number;
  weightagePct: number;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  color: string;
  totalQuestions: number;
  topics: SubjectTopic[];
}

const DEFAULT_SUBJECTS: SubjectItem[] = [
  {
    id: 'sub-1',
    name: 'Mathematics - Algebra',
    code: 'ALG',
    color: 'bg-indigo-600',
    totalQuestions: 180,
    topics: [
      { id: 't1', name: 'Real Numbers & Polynomials', questionCount: 45, weightagePct: 25 },
      { id: 't2', name: 'Pair of Linear Equations in Two Variables', questionCount: 40, weightagePct: 22 },
      { id: 't3', name: 'Quadratic Equations', questionCount: 50, weightagePct: 28 },
      { id: 't4', name: 'Arithmetic Progressions', questionCount: 45, weightagePct: 25 },
    ],
  },
  {
    id: 'sub-2',
    name: 'Mathematics - Trigonometry',
    code: 'TRIG',
    color: 'bg-blue-600',
    totalQuestions: 140,
    topics: [
      { id: 't5', name: 'Trigonometric Ratios & Values', questionCount: 40, weightagePct: 30 },
      { id: 't6', name: 'Trigonometric Identities', questionCount: 50, weightagePct: 35 },
      { id: 't7', name: 'Applications of Trigonometry (Heights & Distances)', questionCount: 50, weightagePct: 35 },
    ],
  },
  {
    id: 'sub-3',
    name: 'Mathematics - Geometry & Mensuration',
    code: 'GEOM',
    color: 'bg-purple-600',
    totalQuestions: 160,
    topics: [
      { id: 't8', name: 'Similar Triangles & Tangents to Circles', questionCount: 45, weightagePct: 28 },
      { id: 't9', name: 'Coordinate Geometry (Distance & Section Formulas)', questionCount: 55, weightagePct: 34 },
      { id: 't10', name: 'Surface Areas & Volumes', questionCount: 60, weightagePct: 38 },
    ],
  },
  {
    id: 'sub-4',
    name: 'Mathematics - Statistics & Probability',
    code: 'STAT',
    color: 'bg-emerald-600',
    totalQuestions: 120,
    topics: [
      { id: 't11', name: 'Mean, Median & Mode of Grouped Data', questionCount: 60, weightagePct: 50 },
      { id: 't12', name: 'Theoretical & Empirical Probability', questionCount: 60, weightagePct: 50 },
    ],
  },
];

export const AdminSubjects: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectItem[]>(DEFAULT_SUBJECTS);
  const [activeSubjectId, setActiveSubjectId] = useState<string>('sub-1');
  const [newTopicName, setNewTopicName] = useState('');
  const [msg, setMsg] = useState('');

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) || subjects[0];

  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    const updated = subjects.map((sub) => {
      if (sub.id === activeSubjectId) {
        return {
          ...sub,
          topics: [
            ...sub.topics,
            {
              id: `t-${Date.now()}`,
              name: newTopicName.trim(),
              questionCount: 0,
              weightagePct: 10,
            },
          ],
        };
      }
      return sub;
    });

    setSubjects(updated);
    setNewTopicName('');
    setMsg('New topic added successfully!');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div id="admin-subjects-page" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-400/30">
            Curriculum Hierarchy
          </span>
          <h1 className="text-2xl font-black text-white mt-1">Subjects & Exam Topics</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure RGUKT entrance syllabus structure, subject question weightage, and topic categorization.
          </p>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject Selector Sidebar */}
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
            Core Subjects ({subjects.length})
          </h3>
          <div className="space-y-2">
            {subjects.map((sub) => {
              const isActive = sub.id === activeSubjectId;
              return (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubjectId(sub.id)}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-800 shadow-md ring-2 ring-indigo-500/30'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-10 rounded-md ${sub.color}`} />
                    <div>
                      <h4 className="font-extrabold text-sm">{sub.name}</h4>
                      <p className={`text-[11px] ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                        {sub.topics.length} Topics • {sub.totalQuestions} Questions
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Subject Details & Topic Breakdown */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider border border-indigo-100">
                  {activeSubject.code}
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">{activeSubject.name}</h2>
              </div>
              <div className="text-right text-xs text-slate-500">
                Total Repository Questions:{' '}
                <span className="font-extrabold text-slate-900 text-sm">{activeSubject.totalQuestions}</span>
              </div>
            </div>

            {/* Topics List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Syllabus Chapters / Sub-Topics
              </h4>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {activeSubject.topics.map((topic, idx) => (
                  <div
                    key={topic.id}
                    className="p-3.5 bg-white hover:bg-slate-50/80 flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 rounded-md bg-slate-100 font-bold text-slate-600 flex items-center justify-center text-[11px]">
                        0{idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{topic.name}</p>
                        <p className="text-[10px] text-slate-400">RGUKT Entrance Syllabus Standard</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700 text-[11px]">
                        {topic.questionCount} Questions
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-extrabold text-[11px]">
                        {topic.weightagePct}% Weightage
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form: Add New Sub-Topic */}
            <form onSubmit={handleAddTopic} className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Add New Sub-Topic to {activeSubject.name}</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="e.g. Chapter 5: Trigonometric Identities..."
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Chapter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
