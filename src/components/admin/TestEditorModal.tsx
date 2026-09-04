import React, { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../services/api';
import {
  X,
  Plus,
  Trash2,
  Save,
  HelpCircle,
  FileSpreadsheet,
  Eye,
  Copy,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Upload,
  Download,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { CsvImportModal } from './CsvImportModal';
import {
  ParsedQuestion,
  extractQuestionOptionsAndMetadata,
  tokenizeQuestionBlock,
  getSampleCSVTemplate,
  STANDARDIZED_CSV_HEADERS,
} from '../../utils/csvParser';
import { MathText } from '../common/MathText';

interface QuestionDraft {
  id?: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  marks: number;
  explanation: string;
}

interface TestEditorModalProps {
  isOpen: boolean;
  testId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const TestEditorModal: React.FC<TestEditorModalProps> = ({
  isOpen,
  testId,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Mathematics & Physical Science');
  const [durationMin, setDurationMin] = useState(15);
  const [isPublished, setIsPublished] = useState(true);

  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: 'A',
      marks: 1,
      explanation: '',
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingTest, setIsDeletingTest] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvModalTab, setCsvModalTab] = useState<'upload' | 'paste'>('upload');
  const [csvModalFile, setCsvModalFile] = useState<File | null>(null);
  const [importNotification, setImportNotification] = useState<string | null>(null);

  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadStandardTemplate = () => {
    const csvData = getSampleCSVTemplate();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'rgukt_standard_questions_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDirectCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvModalFile(file);
      setCsvModalTab('upload');
      setIsCsvModalOpen(true);
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    }
  };

  const handleOpenUploadModal = () => {
    setCsvModalFile(null);
    setCsvModalTab('upload');
    setIsCsvModalOpen(true);
  };

  const handleOpenPasteModal = () => {
    setCsvModalFile(null);
    setCsvModalTab('paste');
    setIsCsvModalOpen(true);
  };

  const handleImportCsvQuestions = (imported: ParsedQuestion[], mode: 'append' | 'replace') => {
    console.group('📥 [TestEditorModal:handleImportCsvQuestions] Processing Imported Questions');
    console.log(`Import Mode: [${mode}], Count: ${imported.length}`);

    const formatted: QuestionDraft[] = imported.map((q, idx) => {
      const draft: QuestionDraft = {
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        marks: q.marks || 1,
        explanation: q.explanation || '',
      };

      if (idx < 5 || idx >= imported.length - 2) {
        console.log(`Question #${idx + 1} Draft Inspection:`, {
          statement: draft.questionText.slice(0, 60) + (draft.questionText.length > 60 ? '...' : ''),
          optionA: draft.optionA,
          optionB: draft.optionB,
          optionC: draft.optionC,
          optionD: draft.optionD,
          correct: draft.correctOption,
          valid: q.isValid,
          error: q.error,
        });
      }

      return draft;
    });

    if (mode === 'replace') {
      console.log('Replacing existing question list with', formatted.length, 'questions');
      setQuestions(formatted);
      setImportNotification(`Successfully replaced test with ${formatted.length} standardized questions.`);
    } else {
      setQuestions((prev) => {
        // If the current list has only 1 empty default question, replace it
        if (
          prev.length === 1 &&
          !prev[0].questionText &&
          !prev[0].optionA &&
          !prev[0].optionB
        ) {
          console.log('Overwriting single empty initial question with', formatted.length, 'questions');
          setImportNotification(`Successfully imported ${formatted.length} standardized questions.`);
          return formatted;
        }
        console.log(`Appending ${formatted.length} questions to existing ${prev.length} questions`);
        setImportNotification(`Successfully added ${formatted.length} questions (total: ${prev.length + formatted.length}).`);
        return [...prev, ...formatted];
      });
    }

    setTimeout(() => {
      setImportNotification(null);
    }, 4000);

    console.groupEnd();
  };

  useEffect(() => {
    if (!isOpen) return;

    setShowDeleteConfirm(false);

    if (testId) {
      // Load test details for editing
      const loadTest = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const res = await adminApi.getTestDetail(testId);
          const t = res.test;
          if (!t) {
            setError('Test paper could not be found.');
            return;
          }
          setTitle(t.title || '');
          setSubject(t.subject || 'Mathematics & Physical Science');
          setDurationMin(t.durationMin || 15);
          setIsPublished(Boolean(t.isPublished));

          if (t.questions && t.questions.length > 0) {
            setQuestions(
              t.questions.map((q: any) => ({
                id: q.id,
                questionText: q.questionText || '',
                optionA: q.optionA || '',
                optionB: q.optionB || '',
                optionC: q.optionC || '',
                optionD: q.optionD || '',
                correctOption: q.correctOption || 'A',
                marks: Number(q.marks) || 1,
                explanation: q.explanation || '',
              }))
            );
          } else {
            setQuestions([
              {
                questionText: '',
                optionA: '',
                optionB: '',
                optionC: '',
                optionD: '',
                correctOption: 'A',
                marks: 1,
                explanation: '',
              },
            ]);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load test details');
        } finally {
          setIsLoading(false);
        }
      };

      loadTest();
    } else {
      // Reset form for creation
      setTitle('');
      setSubject('Mathematics & Physical Science');
      setDurationMin(15);
      setIsPublished(true);
      setQuestions([
        {
          questionText: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correctOption: 'A',
          marks: 1,
          explanation: '',
        },
      ]);
      setError(null);
    }
  }, [isOpen, testId]);

  if (!isOpen) return null;

  const handleAddQuestion = () => {
    setError(null);
    setQuestions((prev) => [
      ...prev,
      {
        questionText: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctOption: 'A',
        marks: 1,
        explanation: '',
      },
    ]);
  };

  const handleDuplicateQuestion = (index: number) => {
    setError(null);
    const target = questions[index];
    const duplicated: QuestionDraft = {
      ...target,
      id: undefined,
      questionText: `${target.questionText} (Copy)`,
    };
    setQuestions((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, duplicated);
      return next;
    });
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    setQuestions((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length === 1) {
      setError('Test paper must contain at least 1 question.');
      return;
    }
    setError(null);
    setQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAutoSplitQuestion = (index: number) => {
    const target = questions[index];
    if (!target || !target.questionText) return;
    const extracted = tokenizeQuestionBlock(target.questionText);
    if (extracted.hasExtractedOptions) {
      setQuestions((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          questionText: extracted.questionText,
          optionA: extracted.optionA || next[index].optionA,
          optionB: extracted.optionB || next[index].optionB,
          optionC: extracted.optionC || next[index].optionC,
          optionD: extracted.optionD || next[index].optionD,
          correctOption: extracted.correctOption || next[index].correctOption,
          explanation: extracted.explanation || next[index].explanation,
          marks: extracted.marks || next[index].marks,
        };
        return next;
      });
    }
  };

  const updateQuestionField = (index: number, field: keyof QuestionDraft, value: any) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteTestPaper = async () => {
    if (!testId) return;
    setIsDeletingTest(true);
    setError(null);
    try {
      await adminApi.deleteTest(testId);
      window.dispatchEvent(new Event('testSeriesUpdated'));
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete test paper');
      setIsDeletingTest(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    console.group('💾 [TestEditorModal:handleSubmit] Validating & Submitting Test');
    console.log('Form State:', {
      title,
      subject,
      durationMin,
      isPublished,
      totalQuestions: questions.length,
    });

    // Validation
    if (!title.trim() || !subject.trim()) {
      console.warn('Validation Failed: Title or Subject is missing');
      setError('Title and Subject are required');
      console.groupEnd();
      return;
    }

    // Process and auto-extract only if options A or B are missing
    const processedQuestions = questions.map((q, idx) => {
      if (q.questionText.trim() && (!q.optionA.trim() || !q.optionB.trim())) {
        console.log(`Question #${idx + 1}: Options A or B missing. Attempting auto-extraction...`);
        const extracted = tokenizeQuestionBlock(q.questionText);
        if (extracted.hasExtractedOptions) {
          console.log(`Question #${idx + 1}: Auto-extracted options successfully:`, {
            newQuestionText: extracted.questionText,
            extractedOptionA: extracted.optionA,
            extractedOptionB: extracted.optionB,
            extractedOptionC: extracted.optionC,
            extractedOptionD: extracted.optionD,
          });
          return {
            ...q,
            questionText: extracted.questionText || q.questionText,
            optionA: q.optionA.trim() || extracted.optionA,
            optionB: q.optionB.trim() || extracted.optionB,
            optionC: q.optionC.trim() || extracted.optionC,
            optionD: q.optionD.trim() || extracted.optionD,
            correctOption: q.correctOption.trim() || extracted.correctOption,
            explanation: q.explanation.trim() || extracted.explanation,
            marks: q.marks || extracted.marks || 1,
          };
        } else {
          console.warn(`Question #${idx + 1}: Auto-extraction could not find valid options in statement.`);
        }
      }
      return q;
    });

    for (let i = 0; i < processedQuestions.length; i++) {
      const q = processedQuestions[i];
      if (
        !q.questionText.trim() ||
        !q.optionA.trim() ||
        !q.optionB.trim() ||
        !q.optionC.trim() ||
        !q.optionD.trim()
      ) {
        console.error(`Validation Error at Question #${i + 1}:`, {
          hasText: Boolean(q.questionText.trim()),
          hasOptA: Boolean(q.optionA.trim()),
          hasOptB: Boolean(q.optionB.trim()),
          hasOptC: Boolean(q.optionC.trim()),
          hasOptD: Boolean(q.optionD.trim()),
          questionStatement: q.questionText,
        });
        setError(`Question #${i + 1} has empty text or missing options.`);
        console.groupEnd();
        return;
      }
    }

    console.log('✅ All questions validated successfully. Submitting payload...');
    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        subject: subject.trim(),
        durationMin: Number(durationMin) || 15,
        isPublished: Boolean(isPublished),
        questions: processedQuestions.map((q) => ({
          questionText: q.questionText.trim(),
          optionA: q.optionA.trim(),
          optionB: q.optionB.trim(),
          optionC: q.optionC.trim(),
          optionD: q.optionD.trim(),
          correctOption: (q.correctOption || 'A').toUpperCase().trim(),
          marks: Number(q.marks) || 1,
          explanation: q.explanation ? q.explanation.trim() : null,
        })),
      };

      if (testId) {
        await adminApi.updateTest(testId, payload);
      } else {
        await adminApi.createTest(payload);
      }

      window.dispatchEvent(new Event('testSeriesUpdated'));
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save test paper');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="test-editor-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div id="test-editor-modal-card" className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full p-5 sm:p-6 relative my-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {testId ? 'Edit Test Paper' : 'Create New RGUKT Test Paper'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure mock exam title, duration, MCQ options, correct answer keys, and step-by-step solutions.
            </p>
          </div>

          {testId && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="self-start sm:self-auto px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Paper</span>
            </button>
          )}
        </div>

        {/* Delete Confirmation Alert Banner */}
        {showDeleteConfirm && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-2">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <strong className="text-xs font-black">Permanently delete this entire test paper?</strong>
            </div>
            <p className="text-[11px] text-red-700">
              This action cannot be undone. All MCQs and student submission records for "{title}" will be deleted.
            </p>
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                disabled={isDeletingTest}
                onClick={handleDeleteTestPaper}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isDeletingTest ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
              <button
                type="button"
                disabled={isDeletingTest}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading test editor data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* General Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Test Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. RGUKT Model Paper 2026 - Mathematics"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Mathematics / Science"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="sm:col-span-4 flex items-center justify-between pt-2 border-t border-slate-200">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-800">Publish Test Paper to Students</span>
                </label>

                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                  Total Questions: {questions.length} (Marks: {questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0)})
                </span>
              </div>
            </div>

            {/* Questions List Editor */}
            <div className="space-y-4">
              {/* Import Notification Banner */}
              {importNotification && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-900 text-xs font-bold animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{importNotification}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-indigo-600" />
                    <span>MCQ Question Bank ({questions.length} Questions)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Standardized format: <code className="text-emerald-700 font-bold">Question, OptionA, OptionB, OptionC, OptionD, Correct, Explanation, Marks</code>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={csvFileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleDirectCsvUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    id="btn-upload-csv-file"
                    onClick={() => csvFileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                    title="Upload standardized CSV file directly"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload CSV</span>
                  </button>

                  <button
                    type="button"
                    id="btn-bulk-import-csv"
                    onClick={handleOpenPasteModal}
                    className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-[11px] rounded-lg border border-emerald-200 flex items-center space-x-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Import Tool</span>
                  </button>

                  <button
                    type="button"
                    id="btn-download-csv-template"
                    onClick={handleDownloadStandardTemplate}
                    className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 flex items-center space-x-1 cursor-pointer"
                    title="Download standardized CSV template file"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">CSV Template</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-2.5 py-1 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 font-bold text-[11px] rounded-lg border border-indigo-200 flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>
              </div>

              {questions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 relative hover:border-indigo-200 transition-colors"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="font-black text-slate-900 text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                      Question #{idx + 1}
                    </span>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 text-xs">
                        <span className="text-slate-500 font-bold text-[11px]">Marks:</span>
                        <input
                          type="number"
                          min="1"
                          value={q.marks}
                          onChange={(e) => updateQuestionField(idx, 'marks', Number(e.target.value))}
                          className="w-10 p-0.5 border border-slate-200 rounded text-center text-xs font-bold"
                        />
                      </div>

                      {/* Move up / down */}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveQuestion(idx, 'up')}
                        className="text-slate-400 hover:text-slate-600 p-1 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === questions.length - 1}
                        onClick={() => handleMoveQuestion(idx, 'down')}
                        className="text-slate-400 hover:text-slate-600 p-1 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Duplicate */}
                      <button
                        type="button"
                        onClick={() => handleDuplicateQuestion(idx)}
                        className="text-slate-400 hover:text-indigo-600 p-1 cursor-pointer"
                        title="Duplicate Question"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Question */}
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(idx)}
                        className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Question Text Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        Question Statement (without options)
                      </label>
                      {q.questionText && tokenizeQuestionBlock(q.questionText).hasExtractedOptions && (
                        <button
                          type="button"
                          onClick={() => handleAutoSplitQuestion(idx)}
                          className="text-[10px] font-black text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded flex items-center space-x-1 cursor-pointer transition-colors"
                        >
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>Auto-Split Options A-D</span>
                        </button>
                      )}
                    </div>

                    <textarea
                      required
                      rows={2}
                      value={q.questionText}
                      onChange={(e) => updateQuestionField(idx, 'questionText', e.target.value)}
                      placeholder="Enter the question statement (LaTeX math supported, e.g. \frac{a}{b}, x^2, \sqrt{y})..."
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />

                    {/* Options in question text warning banner */}
                    {q.questionText && tokenizeQuestionBlock(q.questionText).hasExtractedOptions && (
                      <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                        <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-[11px]">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Embedded options detected! Separate them into the boxes below:</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAutoSplitQuestion(idx)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] rounded shadow-xs cursor-pointer transition-all flex items-center space-x-1 shrink-0"
                        >
                          <span>Split into Options A, B, C, D</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* MathJax Notation Live Preview */}
                  {q.questionText.trim() && (
                    <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs">
                      <div className="flex items-center space-x-1 text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider mb-1">
                        <Eye className="w-3 h-3 text-indigo-600" />
                        <span>MathJax Live Preview:</span>
                      </div>
                      <div className="text-slate-900 font-semibold">
                        <MathText text={q.questionText} />
                      </div>
                    </div>
                  )}

                  {/* Options A, B, C, D */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="block font-bold text-slate-600 mb-1 text-[11px]">Option A</label>
                      <input
                        type="text"
                        required
                        value={q.optionA}
                        onChange={(e) => updateQuestionField(idx, 'optionA', e.target.value)}
                        placeholder="Option A answer text"
                        className="w-full p-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 mb-1 text-[11px]">Option B</label>
                      <input
                        type="text"
                        required
                        value={q.optionB}
                        onChange={(e) => updateQuestionField(idx, 'optionB', e.target.value)}
                        placeholder="Option B answer text"
                        className="w-full p-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 mb-1 text-[11px]">Option C</label>
                      <input
                        type="text"
                        required
                        value={q.optionC}
                        onChange={(e) => updateQuestionField(idx, 'optionC', e.target.value)}
                        placeholder="Option C answer text"
                        className="w-full p-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 mb-1 text-[11px]">Option D</label>
                      <input
                        type="text"
                        required
                        value={q.optionD}
                        onChange={(e) => updateQuestionField(idx, 'optionD', e.target.value)}
                        placeholder="Option D answer text"
                        className="w-full p-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Correct Option Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-extrabold text-emerald-800 mb-1 uppercase tracking-wider">
                        Correct Option Key
                      </label>
                      <select
                        value={q.correctOption}
                        onChange={(e) => updateQuestionField(idx, 'correctOption', e.target.value)}
                        className="w-full p-1.5 text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        <option value="C">Option C</option>
                        <option value="D">Option D</option>
                      </select>
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                        Step-by-Step Explanation / Solution
                      </label>
                      <input
                        type="text"
                        value={q.explanation}
                        onChange={(e) => updateQuestionField(idx, 'explanation', e.target.value)}
                        placeholder="Explain why this option is correct..."
                        className="w-full p-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between space-x-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Add Another Question</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving Changes...' : testId ? 'Update Test Paper' : 'Save Test Paper'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => {
          setIsCsvModalOpen(false);
          setCsvModalFile(null);
        }}
        onImport={handleImportCsvQuestions}
        currentQuestionCount={questions.length}
        initialTab={csvModalTab}
        initialFile={csvModalFile}
      />
    </div>
  );
};
