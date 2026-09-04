import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import { AttemptInspectorModal } from '../common/AttemptInspectorModal';
import { ClipboardCheck, Search, Filter, Clock, CheckCircle2, User, BookOpen, Eye } from 'lucide-react';

export const AdminAttempts: React.FC = () => {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inspectingAttemptId, setInspectingAttemptId] = useState<string | null>(null);

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getAttempts();
      setAttempts(res.attempts || []);
    } catch (err: any) {
      console.error('Error fetching attempts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, []);

  const filteredAttempts = attempts.filter(
    (a) =>
      a.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      a.test?.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div id="admin-attempts-page" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-400/30">
            Audit Submissions
          </span>
          <h1 className="text-2xl font-black text-white mt-1">Student Attempts & Exam Results</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor real-time student test submissions, time taken, score breakdowns, and answer responses.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name, email or test title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Total Attempts Submitted: <span className="font-extrabold text-slate-900">{attempts.length}</span>
        </div>
      </div>

      {/* Attempts Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading submission records...</p>
        </div>
      ) : filteredAttempts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
          <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Attempts Found</h3>
          <p className="text-xs text-slate-500">Student exam submissions will appear here once tests are attempted.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Test Paper</th>
                  <th className="px-4 py-3">Score / Marks</th>
                  <th className="px-4 py-3">Time Taken</th>
                  <th className="px-4 py-3">Submitted At</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredAttempts.map((attempt) => {
                  const pct = Math.round((attempt.score / (attempt.totalMarks || 1)) * 100);
                  const minutes = Math.floor((attempt.timeTakenSec || 0) / 60);
                  const seconds = (attempt.timeTakenSec || 0) % 60;

                  return (
                    <tr key={attempt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                            {(attempt.user?.name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{attempt.user?.name || 'Student'}</p>
                            <p className="text-[10px] text-slate-400">{attempt.user?.email || ''}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{attempt.test?.title || 'Mock Exam'}</p>
                        <span className="text-[10px] text-slate-400">{attempt.test?.subject || 'RGUKT CET'}</span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-slate-900 text-sm">
                            {attempt.score} / {attempt.totalMarks}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pct >= 70
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : pct >= 40
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {minutes}m {seconds}s
                      </td>

                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {new Date(attempt.submittedAt).toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setInspectingAttemptId(attempt.id)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg border border-indigo-200 transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Analysis</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attempt Inspector Modal */}
      {inspectingAttemptId && (
        <AttemptInspectorModal
          attemptId={inspectingAttemptId}
          onClose={() => setInspectingAttemptId(null)}
        />
      )}
    </div>
  );
};
