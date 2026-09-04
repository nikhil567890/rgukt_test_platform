import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import { Clock, Calendar, Play, Pause, AlertCircle, CheckCircle2, ShieldAlert, Plus } from 'lucide-react';

export const AdminScheduling: React.FC = () => {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getTests();
      setTests(res.tests || []);
    } catch (err: any) {
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleTogglePublish = async (testId: string, currentStatus: boolean) => {
    try {
      await adminApi.updateTest(testId, { isPublished: !currentStatus });
      window.dispatchEvent(new Event('testSeriesUpdated'));
      setMsg(`Test paper status updated successfully!`);
      fetchTests();
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to update schedule status');
    }
  };

  return (
    <div id="admin-scheduling-page" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-400/30">
            Live Schedule & Window
          </span>
          <h1 className="text-2xl font-black text-white mt-1">Exam Scheduling & Timer Control</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure live exam windows, active test releases, and exam duration limits.
          </p>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {/* Schedule List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading schedule data...</p>
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
          <Clock className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Tests Scheduled</h3>
          <p className="text-xs text-slate-500">Create a test paper in the Test Builder to configure schedules.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => (
            <div
              key={test.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                      test.isPublished
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {test.isPublished ? 'Live & Published' : 'Draft Schedule'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                    {test.subject}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900">{test.title}</h3>

                <div className="flex items-center space-x-4 text-xs text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Duration: {test.durationMin} mins</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Total Marks: {test.totalMarks}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <button
                  onClick={() => handleTogglePublish(test.id, test.isPublished)}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                    test.isPublished
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                  }`}
                >
                  {test.isPublished ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{test.isPublished ? 'Pause / Unpublish' : 'Publish Live Now'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
