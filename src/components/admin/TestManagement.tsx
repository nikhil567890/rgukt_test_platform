import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/api';
import { TestPaper } from '../../types';
import {
  BookOpen,
  PlusCircle,
  Edit,
  Trash2,
  BarChart2,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  FileSpreadsheet,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';

interface TestManagementProps {
  onCreateTest: () => void;
  onEditTest: (testId: string) => void;
  onViewAnalytics: (testId: string) => void;
}

export const TestManagement: React.FC<TestManagementProps> = ({
  onCreateTest,
  onEditTest,
  onViewAnalytics,
}) => {
  const [tests, setTests] = useState<TestPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Deletion modal state
  const [deletingTest, setDeletingTest] = useState<{ id: string; title: string; questions?: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const fetchTests = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getTests();
      setTests(res.tests || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load test papers');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTests(true);

    const handleSync = () => {
      fetchTests(false);
    };

    window.addEventListener('testSeriesUpdated', handleSync);
    return () => {
      window.removeEventListener('testSeriesUpdated', handleSync);
    };
  }, []);

  const handleTogglePublish = async (test: TestPaper) => {
    try {
      await adminApi.updateTest(test.id, { isPublished: !test.isPublished });
      window.dispatchEvent(new Event('testSeriesUpdated'));
      showToast(`Test paper "${test.title}" is now ${!test.isPublished ? 'Published' : 'saved as Draft'}.`);
      fetchTests(false);
    } catch (err: any) {
      showToast('Failed to update publish status', 'error');
    }
  };

  const confirmDeleteTest = async () => {
    if (!deletingTest) return;
    setIsDeleting(true);
    try {
      await adminApi.deleteTest(deletingTest.id);
      window.dispatchEvent(new Event('testSeriesUpdated'));
      showToast(`Test paper "${deletingTest.title}" deleted successfully.`);
      setDeletingTest(null);
      fetchTests(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete test paper', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="admin-test-management-page" className="space-y-6 pb-12 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold transition-all animate-bounce-short ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-extrabold mb-1.5 inline-block">
            Exam Administration
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Test Paper Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Create, publish, edit, and monitor entrance test papers and MCQ questions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <button
            onClick={onCreateTest}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Bulk Import CSV</span>
          </button>

          <button
            onClick={onCreateTest}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Test Paper</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Fetching test papers list...</p>
        </div>
      ) : error ? (
        <div className="p-5 bg-red-50 border border-red-200 rounded-xl text-center text-red-700 text-xs space-y-2">
          <p className="font-bold">{error}</p>
          <button onClick={() => fetchTests(true)} className="px-3 py-1 bg-red-600 text-white font-bold rounded">
            Retry
          </button>
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700 text-xs">No Test Papers Created Yet</p>
          <p className="text-xs text-slate-400">Click "Create New Test Paper" to add your first mock exam.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Test Title & Subject</th>
                  <th className="p-3.5">Specs</th>
                  <th className="p-3.5">Questions</th>
                  <th className="p-3.5">Attempts</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tests.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="p-3.5">
                      <p className="font-extrabold text-slate-900 text-xs">{t.title}</p>
                      <p className="text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider mt-0.5">
                        {t.subject}
                      </p>
                    </td>

                    <td className="p-3.5 text-slate-600 space-y-0.5">
                      <p className="flex items-center gap-1 font-semibold text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{t.durationMin} mins</span>
                      </p>
                      <p className="flex items-center gap-1 font-semibold text-[11px]">
                        <Award className="w-3 h-3 text-slate-400" />
                        <span>{t.totalMarks} Marks</span>
                      </p>
                    </td>

                    <td className="p-3.5 font-bold text-slate-800">
                      {t.questionCount || 0} MCQs
                    </td>

                    <td className="p-3.5 font-bold text-indigo-700">
                      {t.attemptCount || 0} Submissions
                    </td>

                    <td className="p-3.5">
                      <button
                        onClick={() => handleTogglePublish(t)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          t.isPublished
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {t.isPublished ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Published</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Draft</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => onViewAnalytics(t.id)}
                        className="px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                        title="Test Analytics & Leaderboard"
                      >
                        <BarChart2 className="w-3 h-3" />
                        <span>Analytics</span>
                      </button>

                      <button
                        onClick={() => onEditTest(t.id)}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                        title="Edit Test Paper"
                      >
                        <Edit className="w-3 h-3 text-indigo-600" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => setDeletingTest({ id: t.id, title: t.title, questions: t.questionCount })}
                        className="px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 font-bold border border-red-200 text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                        title="Delete Test Paper"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Custom In-App Delete Confirmation Modal */}
      {deletingTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 relative">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 text-center">
              Delete Test Paper?
            </h3>
            <p className="text-xs text-slate-600 text-center mt-1.5 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900">"{deletingTest.title}"</strong>?
              This will remove all associated MCQs and student submission records.
            </p>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingTest(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteTest}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-2xs cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
