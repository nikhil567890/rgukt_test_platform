import React, { useState, useEffect } from 'react';
import { testApi } from '../../services/api';
import { MathText } from '../common/MathText';
import { BookOpen, Search, CheckCircle2, Award, Play, ChevronRight, Layers, HelpCircle, Loader2 } from 'lucide-react';

interface StudentSubjectsProps {
  onStartTest: (testId: string) => void;
}

export const StudentSubjects: React.FC<StudentSubjectsProps> = ({ onStartTest }) => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchSubjects = async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    try {
      const res = await testApi.getSubjectsAndTopics();
      setSubjects(res.subjects || []);
      if (res.subjects && res.subjects.length > 0) {
        setActiveSubjectId((prev) => prev || res.subjects[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load subjects & topics:', err);
      setError('Failed to load subjects and topics.');
    } finally {
      if (showLoadingState) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects(true);

    const handleSync = () => {
      fetchSubjects(false);
    };

    window.addEventListener('testSeriesUpdated', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      window.removeEventListener('testSeriesUpdated', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) || subjects[0];

  const filteredSubjects = subjects.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.topics && s.topics.some((t: any) => t.title.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div id="student-subjects-page" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-400/30">
            VSMC • RGUKT Preparation
          </span>
          <h1 className="text-2xl font-black text-white mt-1">RGUKT Preparation & Exam Topics</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Prepare for RGUKT CET with VSMC RGUKT Test Preparation, practice tests, and Vinodh Sir's test series.
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search subjects or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-xl text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading uploaded subjects & topics...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold text-center">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subjects Sidebar */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
              All Subjects ({filteredSubjects.length})
            </h3>
            <div className="space-y-2">
              {filteredSubjects.map((sub) => {
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
                      <div className={`w-3 h-10 rounded-md ${sub.color || 'bg-indigo-500'}`} />
                      <div>
                        <h4 className="font-extrabold text-sm">{sub.name}</h4>
                        <p className={`text-[11px] ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                          {sub.testCount || 0} Practice Tests • {sub.totalQuestions || 0} Questions
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Subject Topics & Practice Papers Details */}
          {activeSubject ? (
            <div className="lg:col-span-2 space-y-6">
              {/* Subject Details Header */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3.5 h-8 rounded-md ${activeSubject.color || 'bg-indigo-500'}`} />
                    <div>
                      <h2 className="text-lg font-black text-slate-900">{activeSubject.name}</h2>
                      <span className="text-xs font-semibold text-slate-500">
                        Code: {activeSubject.code}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-500 block">Uploaded Content</span>
                    <span className="text-sm font-extrabold text-indigo-600">
                      {activeSubject.totalQuestions} Questions Available
                    </span>
                  </div>
                </div>

                {/* Topics / Uploaded Tests List */}
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Uploaded Topics & Practice Papers ({activeSubject.topics?.length || 0})</span>
                  </h3>

                  {activeSubject.topics && activeSubject.topics.length > 0 ? (
                    <div className="space-y-3">
                      {activeSubject.topics.map((tp: any, index: number) => (
                        <div
                          key={tp.id || index}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 font-black text-[10px] flex items-center justify-center shrink-0">
                                #{index + 1}
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                                <MathText text={tp.title} inline />
                              </h4>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] text-slate-500 pl-7">
                              <span>{tp.questionCount} Questions</span>
                              <span>•</span>
                              <span>{tp.durationMin} Minutes</span>
                              <span>•</span>
                              <span>{tp.totalMarks} Marks</span>
                            </div>
                          </div>

                          <button
                            onClick={() => onStartTest(tp.id)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Practice Topic</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600">No specific tests uploaded under this subject yet.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Check back soon when new tests are published by administrators.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
              Select a subject from the left panel to view its topics and practice tests.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
