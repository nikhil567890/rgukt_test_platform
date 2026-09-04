import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import { Bell, Plus, Pin, Trash2, AlertTriangle, CheckCircle2, Megaphone } from 'lucide-react';

export const AdminAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'NORMAL',
    isPinned: false,
    targetBatch: 'ALL',
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getAnnouncements();
      setAnnouncements(res.announcements || []);
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) return;
    try {
      setSubmitting(true);
      await adminApi.createAnnouncement(form);
      setMsg('Notice broadcasted to students successfully!');
      setForm({ title: '', content: '', priority: 'NORMAL', isPinned: false, targetBatch: 'ALL' });
      setIsModalOpen(false);
      fetchAnnouncements();
      setTimeout(() => setMsg(''), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to broadcast announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      await adminApi.deleteAnnouncement(id);
      fetchAnnouncements();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete announcement');
    }
  };

  return (
    <div id="admin-announcements-page" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-400/30">
            Student Broadcast
          </span>
          <h1 className="text-2xl font-black text-white mt-1">Announcements & Notices</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Post exam alerts, live seminar updates, and important instructions to student dashboards.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Post New Announcement</span>
        </button>
      </div>

      {msg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {/* Announcements List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading notices...</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
          <Bell className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Announcements Posted</h3>
          <p className="text-xs text-slate-500">Post your first notice to broadcast messages to RGUKT aspirants.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border bg-white shadow-2xs space-y-3 relative transition-all ${
                item.isPinned ? 'border-amber-300 ring-2 ring-amber-400/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {item.isPinned && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold flex items-center space-x-1">
                      <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>PINNED NOTICE</span>
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                      item.priority === 'EXAM_ALERT'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : item.priority === 'URGENT'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.priority}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Target: {item.targetBatch}</span>
                </div>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Delete notice"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-base font-extrabold text-slate-900">{item.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{item.content}</p>

              <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-100">
                Posted on {new Date(item.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Announcement */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center space-x-2">
                <Megaphone className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Broadcast Student Notice</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notice Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RGUKT CET Mock Test #3 Instructions"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority Level</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                    <option value="EXAM_ALERT">Exam Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pin to Top?</label>
                  <select
                    value={form.isPinned ? 'true' : 'false'}
                    onChange={(e) => setForm({ ...form, isPinned: e.target.value === 'true' })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes, Pin to Top</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notice Message Content *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write notice instructions or announcement details here..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Broadcasting...' : 'Broadcast Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
