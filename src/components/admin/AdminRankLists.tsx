import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import { Award, Trophy, Medal, Download, Search, Sparkles, GraduationCap } from 'lucide-react';

export const AdminRankLists: React.FC = () => {
  const [tests, setTests] = useState<any[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getTests().then((res) => {
      const list = res.tests || [];
      setTests(list);
      if (list.length > 0) {
        setSelectedTestId(list[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedTestId) return;
    setLoading(true);
    adminApi
      .getTestAnalytics(selectedTestId)
      .then((res) => setAnalytics(res))
      .catch((err) => console.error('Error fetching analytics:', err))
      .finally(() => setLoading(false));
  }, [selectedTestId]);

  const handleExportCSV = () => {
    if (!analytics || !analytics.leaderboard) return;
    const headers = 'Rank,Student Name,Email,Score,Total Marks,Percentage,Time Taken (s)\n';
    const rows = analytics.leaderboard
      .map(
        (item: any) =>
          `${item.rank},"${item.studentName}","${item.studentEmail}",${item.score},${item.totalMarks},${item.percentage}%,${item.timeTakenSec}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RGUKT_Rank_List_${analytics.test?.title || 'Exam'}.csv`;
    a.click();
  };

  return (
    <div id="admin-rank-lists-page" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-400/30">
            Leaderboard Engine
          </span>
          <h1 className="text-2xl font-black text-white mt-1">Official RGUKT Entrance Rank Lists</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time state percentiles, campus selection predictors, and topper merit lists.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={!analytics || !analytics.leaderboard || analytics.leaderboard.length === 0}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2 shrink-0 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>Export Rank List (CSV)</span>
        </button>
      </div>

      {/* Test Selector Dropdown */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <label className="text-xs font-bold text-slate-700">Select Exam / Mock Paper:</label>
        <select
          value={selectedTestId}
          onChange={(e) => setSelectedTestId(e.target.value)}
          className="w-full sm:w-auto px-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {tests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.subject})
            </option>
          ))}
        </select>
      </div>

      {/* Leaderboard Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Computing rank percentiles...</p>
        </div>
      ) : !analytics || !analytics.leaderboard || analytics.leaderboard.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
          <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Attempts Recorded Yet</h3>
          <p className="text-xs text-slate-500">Ranks will automatically calculate as students complete this test.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top 3 Podium Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analytics.leaderboard.slice(0, 3).map((student: any, idx: number) => {
              const bgGradient =
                idx === 0
                  ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-300'
                  : idx === 1
                  ? 'bg-gradient-to-br from-slate-300/20 via-slate-100 to-transparent border-slate-300'
                  : 'bg-gradient-to-br from-amber-700/10 via-orange-100/5 to-transparent border-amber-700/30';

              const badgeColor =
                idx === 0
                  ? 'bg-amber-500 text-slate-950'
                  : idx === 1
                  ? 'bg-slate-400 text-slate-950'
                  : 'bg-amber-700 text-white';

              return (
                <div
                  key={student.rank}
                  className={`p-5 rounded-2xl border ${bgGradient} bg-white shadow-2xs space-y-3 relative overflow-hidden`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black shadow-xs ${badgeColor}`}>
                      RANK #{student.rank}
                    </span>
                    <Medal
                      className={`w-6 h-6 ${
                        idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : 'text-amber-700'
                      }`}
                    />
                  </div>

                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">{student.studentName}</h3>
                    <p className="text-[11px] text-slate-500">{student.studentEmail}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="font-black text-slate-900 text-lg">
                      {student.score} / {student.totalMarks}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded text-[11px]">
                      {student.percentage}% Score
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full Rank Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Full Merit & Rank Standing
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                Total Ranked Candidates: <strong className="text-slate-900">{analytics.leaderboard.length}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Score / Total</th>
                    <th className="px-4 py-3">Accuracy %</th>
                    <th className="px-4 py-3">RGUKT Selection Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {analytics.leaderboard.map((item: any) => (
                    <tr key={item.rank} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-black text-slate-900">#{item.rank}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{item.studentName}</p>
                        <p className="text-[10px] text-slate-400">{item.studentEmail}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {item.score} / {item.totalMarks}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">{item.percentage}%</td>
                      <td className="px-4 py-3">
                        {item.rank <= 3 ? (
                          <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold flex items-center space-x-1 w-fit">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Top Campus Selected</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold w-fit block">
                            High Probability
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
