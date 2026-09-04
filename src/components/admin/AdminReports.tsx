import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import { BarChart3, TrendingUp, Users, BookOpen, Download, ShieldCheck } from 'lucide-react';

export const AdminReports: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getOverview()
      .then((res) => setOverview(res))
      .catch((err) => console.error('Error fetching overview for reports:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div id="admin-reports-page" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-400/30">
            Institutional Analytics
          </span>
          <h1 className="text-2xl font-black text-white mt-1">Platform Reports & Performance Insights</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluate batch accuracy benchmarks, revenue growth, and student test completion trends.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Generating performance reports...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metric Report Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Enrolled</span>
              <p className="text-2xl font-black text-slate-900">{overview?.totalStudents || 0}</p>
              <p className="text-xs text-slate-500">Active RGUKT aspirants</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Premium Subscribers</span>
              <p className="text-2xl font-black text-indigo-600">{overview?.premiumStudents || 0}</p>
              <p className="text-xs text-emerald-600 font-semibold">Full Test Series Unlocked</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Exam Papers</span>
              <p className="text-2xl font-black text-slate-900">{overview?.totalTests || 0}</p>
              <p className="text-xs text-slate-500">Live mock tests</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Attempts</span>
              <p className="text-2xl font-black text-amber-600">{overview?.totalAttempts || 0}</p>
              <p className="text-xs text-slate-500">Submitted answer sheets</p>
            </div>
          </div>

          {/* Subject Weakness & Performance Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Mathematics Module Accuracy Benchmarks</h3>

            <div className="space-y-4">
              {[
                { name: 'Algebra & Polynomials', accuracy: 82, color: 'bg-indigo-600', note: 'Strong performance in Quadratic Equations & Progressions' },
                { name: 'Trigonometry & Applications', accuracy: 68, color: 'bg-blue-600', note: 'Practice needed on Trigonometric Identities & Heights/Distances' },
                { name: 'Coordinate Geometry', accuracy: 76, color: 'bg-purple-600', note: 'Good accuracy in Distance & Section Formula problems' },
                { name: 'Statistics & Probability', accuracy: 88, color: 'bg-emerald-600', note: 'High accuracy retention across Mean/Median/Mode problems' },
              ].map((subject) => (
                <div key={subject.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>{subject.name}</span>
                    <span className="font-extrabold">{subject.accuracy}% Avg Accuracy</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${subject.color} rounded-full transition-all`} style={{ width: `${subject.accuracy}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">{subject.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
