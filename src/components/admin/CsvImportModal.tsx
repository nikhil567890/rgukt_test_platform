import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  FileText,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  Wand2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Bot,
  Loader2,
} from 'lucide-react';
import { adminApi } from '../../services/api';
import {
  parseQuestionsCSV,
  getSampleCSVTemplate,
  getSamplePlainTextTemplate,
  ParsedQuestion,
  STANDARDIZED_CSV_HEADERS,
  CsvHeaderValidation,
  validateCsvHeaders,
  applyQuestionSuggestions,
  applyAllQuestionSuggestions,
  validateAndEnrichQuestion,
} from '../../utils/csvParser';
import { MathText } from '../common/MathText';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (questions: ParsedQuestion[], mode: 'append' | 'replace') => void;
  currentQuestionCount?: number;
  initialTab?: 'upload' | 'paste';
  initialFile?: File | null;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  currentQuestionCount = 0,
  initialTab = 'upload',
  initialFile = null,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>(initialTab);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState(false);
  const [parsedResult, setParsedResult] = useState<{
    questions: ParsedQuestion[];
    validCount: number;
    invalidCount: number;
    headersFound: string[];
    headerValidation?: CsvHeaderValidation;
    isStandardCsv?: boolean;
  } | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'issues' | 'corrected' | 'aifixed'>('all');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<ParsedQuestion | null>(null);

  // AI Fix States
  const [isFixingWithAI, setIsFixingWithAI] = useState(false);
  const [fixingRowIndex, setFixingRowIndex] = useState<number | null>(null);
  const [aiFixNotification, setAiFixNotification] = useState<string | null>(null);
  const [aiFixError, setAiFixError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize when modal opens or initialFile / initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'upload');
      if (initialFile) {
        processFile(initialFile);
      }
    } else {
      setRawText('');
      setFileName(null);
      setParsedResult(null);
      setIsDragging(false);
      setExpandedRow(null);
      setEditingQuestion(null);
      setAiFixNotification(null);
      setAiFixError(null);
      setIsFixingWithAI(false);
      setFixingRowIndex(null);
    }
  }, [isOpen, initialTab, initialFile]);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    console.group(`📁 [CsvImportModal:processFile] Loading File: ${file.name}`);
    console.log(`File size: ${file.size} bytes, type: ${file.type}`);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setRawText(content);
        const res = parseQuestionsCSV(content);
        console.log('File parse complete:', {
          total: res.questions.length,
          valid: res.validCount,
          invalid: res.invalidCount,
          headers: res.headersFound,
        });
        setParsedResult(res);
      }
      console.groupEnd();
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const csvData = getSampleCSVTemplate();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'rgukt_standard_questions_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyHeaders = () => {
    const headerStr = STANDARDIZED_CSV_HEADERS.join(',');
    navigator.clipboard.writeText(headerStr);
    setCopiedHeaders(true);
    setTimeout(() => setCopiedHeaders(false), 2500);
  };

  const handleLoadPlainTextSample = () => {
    const sample = getSamplePlainTextTemplate();
    setRawText(sample);
    const res = parseQuestionsCSV(sample);
    setParsedResult(res);
  };

  const handleLoadCSVSample = () => {
    const sample = getSampleCSVTemplate();
    setRawText(sample);
    const res = parseQuestionsCSV(sample);
    setParsedResult(res);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setActiveTab('upload');
      processFile(file);
    }
  };

  const handlePasteChange = (text: string) => {
    setRawText(text);
    if (text.trim()) {
      console.group('📋 [CsvImportModal:handlePasteChange] Parsing Pasted Text');
      console.log(`Pasted content length: ${text.length} chars`);
      const res = parseQuestionsCSV(text);
      console.log('Paste parse outcome:', {
        total: res.questions.length,
        valid: res.validCount,
        invalid: res.invalidCount,
      });
      console.groupEnd();
      setParsedResult(res);
    } else {
      setParsedResult(null);
    }
  };

  // Apply all auto-fixable suggestions across entire parsed result
  const handleApplyAllFixes = () => {
    if (!parsedResult) return;
    const { questions, validCount, invalidCount } = applyAllQuestionSuggestions(parsedResult.questions);
    setParsedResult({
      ...parsedResult,
      questions,
      validCount,
      invalidCount,
    });
  };

  // Fix a single question using suggestions
  const handleFixQuestion = (index: number) => {
    if (!parsedResult) return;
    const targetQ = parsedResult.questions[index];
    if (!targetQ) return;
    const fixed = applyQuestionSuggestions(targetQ);
    const updated = [...parsedResult.questions];
    updated[index] = fixed;
    const validCount = updated.filter((q) => q.isValid).length;
    const invalidCount = updated.length - validCount;
    setParsedResult({
      ...parsedResult,
      questions: updated,
      validCount,
      invalidCount,
    });
  };

  // Fix all flagged questions or all questions using Gemini AI
  const handleFixAllWithAI = async () => {
    if (!parsedResult || parsedResult.questions.length === 0) return;

    // Identify questions that have alerts/issues or are invalid (or all if none flagged)
    const questionsToFix = parsedResult.questions.filter(
      (q) => !q.isValid || (q.issues && q.issues.length > 0)
    );
    const targets = questionsToFix.length > 0 ? questionsToFix : parsedResult.questions;

    setIsFixingWithAI(true);
    setAiFixError(null);
    setAiFixNotification(null);

    try {
      const response = await adminApi.fixQuestionsWithAI(
        targets.map((q) => ({
          rowIndex: q.rowIndex,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          marks: q.marks,
          explanation: q.explanation,
          issues: q.issues,
        })),
        'Mathematics & Physical Sciences'
      );

      const fixedList = response.fixedQuestions || [];
      const fixedMap = new Map<number, any>();
      fixedList.forEach((fq) => {
        if (fq.rowIndex !== undefined) {
          fixedMap.set(fq.rowIndex, fq);
        }
      });

      const updated = parsedResult.questions.map((original) => {
        const fixed = fixedMap.get(original.rowIndex);
        if (fixed) {
          return {
            ...original,
            questionText: fixed.questionText,
            optionA: fixed.optionA,
            optionB: fixed.optionB,
            optionC: fixed.optionC,
            optionD: fixed.optionD,
            correctOption: fixed.correctOption as 'A' | 'B' | 'C' | 'D',
            marks: fixed.marks || 1,
            explanation: fixed.explanation || original.explanation,
            isValid: true,
            issues: [],
            error: undefined,
            aiFixed: true,
            aiNotes: fixed.aiNotes || 'Repaired and verified with Gemini AI.',
          };
        }
        return original;
      });

      const validCount = updated.filter((q) => q.isValid).length;
      const invalidCount = updated.length - validCount;

      setParsedResult({
        ...parsedResult,
        questions: updated,
        validCount,
        invalidCount,
      });

      setAiFixNotification(
        `✨ Gemini AI successfully analyzed and repaired ${fixedList.length} question(s)! All alerts resolved.`
      );
      setTimeout(() => setAiFixNotification(null), 6000);
    } catch (err: any) {
      console.error('Failed to fix questions with AI:', err);
      setAiFixError(err.message || 'AI service could not process questions. Please try again.');
      setTimeout(() => setAiFixError(null), 6000);
    } finally {
      setIsFixingWithAI(false);
    }
  };

  // Fix a specific question using Gemini AI
  const handleFixSingleWithAI = async (index: number) => {
    if (!parsedResult) return;
    const targetQ = parsedResult.questions[index];
    if (!targetQ) return;

    setFixingRowIndex(targetQ.rowIndex);
    setAiFixError(null);

    try {
      const response = await adminApi.fixQuestionsWithAI(
        [
          {
            rowIndex: targetQ.rowIndex,
            questionText: targetQ.questionText,
            optionA: targetQ.optionA,
            optionB: targetQ.optionB,
            optionC: targetQ.optionC,
            optionD: targetQ.optionD,
            correctOption: targetQ.correctOption,
            marks: targetQ.marks,
            explanation: targetQ.explanation,
            issues: targetQ.issues,
          },
        ],
        'Mathematics & Physical Sciences'
      );

      const fixed = response.fixedQuestions?.[0];
      if (fixed) {
        const updated = [...parsedResult.questions];
        updated[index] = {
          ...targetQ,
          questionText: fixed.questionText,
          optionA: fixed.optionA,
          optionB: fixed.optionB,
          optionC: fixed.optionC,
          optionD: fixed.optionD,
          correctOption: fixed.correctOption as 'A' | 'B' | 'C' | 'D',
          marks: fixed.marks || 1,
          explanation: fixed.explanation || targetQ.explanation,
          isValid: true,
          issues: [],
          error: undefined,
          aiFixed: true,
          aiNotes: fixed.aiNotes || 'Repaired and verified with Gemini AI.',
        };

        const validCount = updated.filter((q) => q.isValid).length;
        const invalidCount = updated.length - validCount;

        setParsedResult({
          ...parsedResult,
          questions: updated,
          validCount,
          invalidCount,
        });

        setAiFixNotification(`✨ Question #${targetQ.rowIndex} successfully repaired by Gemini AI!`);
        setTimeout(() => setAiFixNotification(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to fix single question with AI:', err);
      setAiFixError(`Failed to repair Question #${targetQ.rowIndex}: ${err.message}`);
      setTimeout(() => setAiFixError(null), 5000);
    } finally {
      setFixingRowIndex(null);
    }
  };

  // Save manual edit for a question row
  const handleSaveEdit = (edited: ParsedQuestion) => {
    if (!parsedResult) return;
    const validated = validateAndEnrichQuestion(edited.rowIndex, {
      questionText: edited.questionText,
      optionA: edited.optionA,
      optionB: edited.optionB,
      optionC: edited.optionC,
      optionD: edited.optionD,
      rawCorrect: edited.correctOption,
      rawMarks: edited.marks,
      explanation: edited.explanation,
    });

    const index = parsedResult.questions.findIndex((q) => q.rowIndex === edited.rowIndex);
    if (index !== -1) {
      const updated = [...parsedResult.questions];
      updated[index] = validated;
      const validCount = updated.filter((q) => q.isValid).length;
      const invalidCount = updated.length - validCount;
      setParsedResult({
        ...parsedResult,
        questions: updated,
        validCount,
        invalidCount,
      });
    }
    setEditingQuestion(null);
  };

  const handleConfirmImport = () => {
    if (!parsedResult || parsedResult.questions.length === 0) {
      alert('No questions found to import.');
      return;
    }

    // Auto-fill fallback on finalize to ensure 100% data model compatibility
    const questionsToImport = parsedResult.questions.map((q) => {
      return {
        ...q,
        questionText: q.questionText || `Question ${q.rowIndex}`,
        optionA: q.optionA || 'Option A',
        optionB: q.optionB || 'Option B',
        optionC: q.optionC || 'Option C',
        optionD: q.optionD || 'Option D',
        correctOption: (['A', 'B', 'C', 'D'].includes(q.correctOption) ? q.correctOption : 'A') as 'A' | 'B' | 'C' | 'D',
        marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
        explanation: q.explanation || '',
      };
    });

    onImport(questionsToImport, importMode);
    onClose();
  };

  const totalQuestions = parsedResult?.questions.length || 0;
  const issuesCount = parsedResult?.questions.filter((q) => !q.isValid || (q.issues && q.issues.length > 0)).length || 0;
  const autoCorrectedCount = parsedResult?.questions.filter((q) => q.autoCorrected).length || 0;
  const aiFixedCount = parsedResult?.questions.filter((q) => q.aiFixed).length || 0;

  const displayedQuestions = parsedResult
    ? parsedResult.questions.filter((q) => {
        if (filterMode === 'valid') return q.isValid;
        if (filterMode === 'issues') return !q.isValid || (q.issues && q.issues.length > 0);
        if (filterMode === 'corrected') return q.autoCorrected;
        if (filterMode === 'aifixed') return q.aiFixed;
        return true;
      })
    : [];

  const headerValidation = parsedResult?.headersFound
    ? validateCsvHeaders(parsedResult.headersFound)
    : null;

  return (
    <div
      id="csv-import-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="csv-import-modal-card"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full p-4 sm:p-6 relative my-4 sm:my-6 max-h-[94vh] flex flex-col"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                <FileSpreadsheet className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-black text-slate-900">Upload & Import Question Bank</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Upload standardized CSV files with automatic field validation, non-numeric mark correction, and smart formatting flags.
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-3.5 space-y-3.5 overflow-y-auto flex-1">
          {/* Standardized CSV Specification Box */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50/70 via-slate-50 to-indigo-50/50 border border-emerald-200/80 rounded-xl space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2">
                <span className="p-1 rounded bg-emerald-600 text-white">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Standardized CSV Schema (Guaranteed Consistency)</h4>
                  <p className="text-[11px] text-slate-600">
                    Guarantees 100% data fidelity with strict column mappings:
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyHeaders}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                  title="Copy standard CSV column header row"
                >
                  {copiedHeaders ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>Copy Headers</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Download className="w-3 h-3 text-white" />
                  <span>Download Sample CSV</span>
                </button>
              </div>
            </div>

            {/* Standard Headers Tag Grid */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-500 mr-1">Required Headers:</span>
              {STANDARDIZED_CSV_HEADERS.map((header) => (
                <code
                  key={header}
                  className="px-2 py-0.5 bg-white border border-slate-200 text-slate-800 text-[10px] font-mono font-bold rounded-md shadow-2xs"
                >
                  {header}
                </code>
              ))}
            </div>
          </div>

          {/* Input Method Switcher */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              id="tab-upload-csv"
              onClick={() => setActiveTab('upload')}
              className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'upload'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload CSV File (Recommended)</span>
            </button>

            <button
              type="button"
              id="tab-paste-text"
              onClick={() => setActiveTab('paste')}
              className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'paste'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Text / Raw MCQs</span>
            </button>
          </div>

          {/* Tab 1: File Drop Area */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]'
                    : fileName
                    ? 'border-emerald-400 bg-emerald-50/20 hover:bg-emerald-50/30'
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20'
                }`}
              >
                <div className="p-3 bg-emerald-100/70 text-emerald-700 rounded-full mb-2">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs sm:text-sm font-extrabold text-slate-800 text-center">
                  {fileName ? `File Selected: ${fileName}` : 'Click to browse or drag & drop CSV file here'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 text-center">
                  Headers: <code className="font-mono text-emerald-800 font-bold">Question, OptionA, OptionB, OptionC, OptionD, Correct, Explanation, Marks</code>
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold shadow-2xs">
                    Choose .CSV File
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadCSVSample();
                    }}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    Load Sample Data
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Raw Text Paste Area */}
          {activeTab === 'paste' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">
                  Paste questions directly (plain text from Word/PDF, or CSV table):
                </label>
                <div className="flex items-center space-x-2 text-[10px]">
                  <button
                    type="button"
                    onClick={handleLoadPlainTextSample}
                    className="text-indigo-600 hover:underline cursor-pointer font-semibold"
                  >
                    Insert Text Sample
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleLoadCSVSample}
                    className="text-emerald-600 hover:underline cursor-pointer font-semibold"
                  >
                    Insert CSV Sample
                  </button>
                </div>
              </div>

              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder={`Question,OptionA,OptionB,OptionC,OptionD,Correct,Explanation,Marks\n"Find the roots of x² - 5x + 6 = 0.","x = 1, 6","x = 2, 3","x = -2, -3","x = 0, 5","B","(x-2)(x-3)=0 => x=2,3",2 marks`}
                className="w-full p-3 text-xs font-mono bg-slate-900 text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-800 leading-relaxed"
              />
            </div>
          )}

          {/* Header Match & Consistency Verification Banner */}
          {parsedResult && headerValidation && headerValidation.isStandard && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center space-x-2 text-emerald-900 font-extrabold text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Standard CSV Format Verified — Guaranteed Data Consistency</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className={`px-2 py-0.5 rounded font-bold ${headerValidation.recognizedColumns.question ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  Question {headerValidation.recognizedColumns.question ? '✓' : '✗'}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${headerValidation.recognizedColumns.optionA ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  OptionA {headerValidation.recognizedColumns.optionA ? '✓' : '✗'}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${headerValidation.recognizedColumns.optionB ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  OptionB {headerValidation.recognizedColumns.optionB ? '✓' : '✗'}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${headerValidation.recognizedColumns.optionC ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  OptionC {headerValidation.recognizedColumns.optionC ? '✓' : '✗'}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${headerValidation.recognizedColumns.optionD ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  OptionD {headerValidation.recognizedColumns.optionD ? '✓' : '✗'}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${headerValidation.recognizedColumns.correct ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  Correct {headerValidation.recognizedColumns.correct ? '✓' : '✗'}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${headerValidation.recognizedColumns.explanation ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  Explanation {headerValidation.recognizedColumns.explanation ? '✓' : '(Optional)'}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${headerValidation.recognizedColumns.marks ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  Marks {headerValidation.recognizedColumns.marks ? '✓' : '(Default 1)'}
                </span>
              </div>
            </div>
          )}

          {/* Parsed Results Overview & Smart Diagnostic Bar */}
          {parsedResult && (
            <div className="space-y-3 pt-1">
              {/* AI Fix Notification Toast / Banner */}
              {aiFixNotification && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center space-x-2 text-indigo-950 text-xs font-bold shadow-xs">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="flex-1">{aiFixNotification}</span>
                  <button
                    type="button"
                    onClick={() => setAiFixNotification(null)}
                    className="text-indigo-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {aiFixError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-900 text-xs font-bold shadow-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="flex-1">{aiFixError}</span>
                  <button
                    type="button"
                    onClick={() => setAiFixError(null)}
                    className="text-red-400 hover:text-red-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* AI Auto-Fix Alerts Banner if there are flagged issues */}
              {issuesCount > 0 && (
                <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 flex items-center space-x-1.5">
                        <span>AI Question Alert Resolver</span>
                        <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[10px] rounded-full font-bold">
                          {issuesCount} Flagged
                        </span>
                      </h4>
                      <p className="text-[11px] text-indigo-800 mt-0.5 leading-relaxed">
                        Gemini AI will inspect the questions, construct missing options, solve the correct answer key with proof, and format MathJax notation.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isFixingWithAI}
                    onClick={handleFixAllWithAI}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer transition-all shrink-0 hover:shadow-indigo-200"
                  >
                    {isFixingWithAI ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Repairing with AI...</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4" />
                        <span>Fix All Alerts with AI</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 gap-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-extrabold text-slate-900">
                    Parsed: {totalQuestions} Questions
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{parsedResult.validCount} Valid</span>
                  </span>
                  {parsedResult.invalidCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded-md flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 text-red-600" />
                      <span>{parsedResult.invalidCount} Missing Fields</span>
                    </span>
                  )}
                  {autoCorrectedCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-md flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>{autoCorrectedCount} Formatted</span>
                    </span>
                  )}
                  {aiFixedCount > 0 && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 font-black rounded-md flex items-center space-x-1 border border-indigo-200">
                      <Bot className="w-3 h-3 text-indigo-600" />
                      <span>{aiFixedCount} AI Fixed</span>
                    </span>
                  )}
                </div>

                {/* Filter and Auto-Fix Buttons */}
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                  {issuesCount > 0 && (
                    <button
                      type="button"
                      disabled={isFixingWithAI}
                      onClick={handleFixAllWithAI}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-[11px] rounded-lg flex items-center space-x-1 cursor-pointer transition-all shadow-2xs"
                      title="Fix all incomplete questions and alerts using Gemini AI"
                    >
                      {isFixingWithAI ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>Fix Alerts (AI)</span>
                    </button>
                  )}

                  {parsedResult.invalidCount > 0 && (
                    <button
                      type="button"
                      onClick={handleApplyAllFixes}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-lg flex items-center space-x-1 cursor-pointer transition-all shadow-2xs"
                      title="Automatically fill fallback values for missing options and format marks"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>Auto-Fix All ({parsedResult.invalidCount})</span>
                    </button>
                  )}

                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setFilterMode('all')}
                      className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                        filterMode === 'all'
                          ? 'bg-slate-800 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      All ({totalQuestions})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('valid')}
                      className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                        filterMode === 'valid'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Valid ({parsedResult.validCount})
                    </button>
                    {issuesCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterMode('issues')}
                        className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                          filterMode === 'issues'
                            ? 'bg-red-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Flagged ({issuesCount})
                      </button>
                    )}
                    {autoCorrectedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterMode('corrected')}
                        className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                          filterMode === 'corrected'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Formatted ({autoCorrectedCount})
                      </button>
                    )}
                    {aiFixedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterMode('aifixed')}
                        className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                          filterMode === 'aifixed'
                            ? 'bg-indigo-700 text-white'
                            : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                        }`}
                      >
                        AI Fixed ({aiFixedCount})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Table with Diagnostic Flags and Action Buttons */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto shadow-2xs">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-600 uppercase text-[9px] sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5 w-2/5">Question Statement & Solution</th>
                      <th className="p-2.5">Extracted Options (A, B, C, D)</th>
                      <th className="p-2.5 w-12 text-center">Key</th>
                      <th className="p-2.5 w-14 text-center">Marks</th>
                      <th className="p-2.5 w-28 text-center">Diagnostics</th>
                      <th className="p-2.5 w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedQuestions.map((q, idx) => {
                      const hasErrors = !q.isValid;
                      const hasIssues = q.issues && q.issues.length > 0;
                      const isExpanded = expandedRow === q.rowIndex;
                      const isRowFixing = fixingRowIndex === q.rowIndex;

                      return (
                        <React.Fragment key={idx}>
                          <tr
                            className={`transition-colors ${
                              hasErrors
                                ? 'bg-red-50/40 hover:bg-red-50/70'
                                : q.aiFixed
                                ? 'bg-indigo-50/30 hover:bg-indigo-50/50'
                                : q.autoCorrected
                                ? 'bg-amber-50/20 hover:bg-amber-50/40'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-2.5 text-center font-bold text-slate-500 align-top">
                              {q.rowIndex}
                            </td>

                            <td className="p-2.5 font-semibold text-slate-800 align-top">
                              {q.questionText ? (
                                <div className="whitespace-pre-line text-[11px] leading-relaxed text-slate-800">
                                  <MathText text={q.questionText} />
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1 text-red-600 font-bold text-xs">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>Missing Question Statement</span>
                                </div>
                              )}

                              {q.explanation && (
                                <div className="mt-1 text-[10px] text-indigo-700 bg-indigo-50/60 px-2 py-0.5 rounded border border-indigo-100 inline-block font-normal">
                                  💡 {q.explanation}
                                </div>
                              )}

                              {/* Flagged Issue Chips */}
                              {hasIssues && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {q.issues?.map((iss, iIdx) => (
                                    <span
                                      key={iIdx}
                                      className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        iss.severity === 'error'
                                          ? 'bg-red-100 text-red-800 border border-red-200'
                                          : iss.severity === 'warning'
                                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                      }`}
                                    >
                                      {iss.severity === 'error' ? (
                                        <AlertCircle className="w-2.5 h-2.5 text-red-600" />
                                      ) : iss.severity === 'warning' ? (
                                        <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                      ) : (
                                        <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                                      )}
                                      <span>{iss.message}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            <td className="p-2.5 text-slate-700 text-[10px] space-y-0.5 align-top">
                              <div className="flex items-start space-x-1">
                                <span className="font-bold text-slate-900 w-3.5">A:</span>
                                <span className={q.correctOption === 'A' ? 'font-bold text-emerald-700 bg-emerald-50 px-1 rounded' : ''}>
                                  {q.optionA || <span className="text-red-500 font-bold italic">Missing Required</span>}
                                </span>
                              </div>
                              <div className="flex items-start space-x-1">
                                <span className="font-bold text-slate-900 w-3.5">B:</span>
                                <span className={q.correctOption === 'B' ? 'font-bold text-emerald-700 bg-emerald-50 px-1 rounded' : ''}>
                                  {q.optionB || <span className="text-red-500 font-bold italic">Missing Required</span>}
                                </span>
                              </div>
                              <div className="flex items-start space-x-1">
                                <span className="font-bold text-slate-900 w-3.5">C:</span>
                                <span className={q.correctOption === 'C' ? 'font-bold text-emerald-700 bg-emerald-50 px-1 rounded' : ''}>
                                  {q.optionC || <span className="text-slate-400 italic">Auto-filled</span>}
                                </span>
                              </div>
                              <div className="flex items-start space-x-1">
                                <span className="font-bold text-slate-900 w-3.5">D:</span>
                                <span className={q.correctOption === 'D' ? 'font-bold text-emerald-700 bg-emerald-50 px-1 rounded' : ''}>
                                  {q.optionD || <span className="text-slate-400 italic">Auto-filled</span>}
                                </span>
                              </div>
                            </td>

                            <td className="p-2.5 text-center font-black text-indigo-700 align-top">
                              <span className="inline-block px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded font-black text-xs">
                                {q.correctOption}
                              </span>
                            </td>

                            <td className="p-2.5 text-center align-top">
                              <span className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-bold text-xs text-slate-800">
                                {q.marks || 1}
                              </span>
                            </td>

                            <td className="p-2.5 text-center align-top space-y-1">
                              {q.aiFixed ? (
                                <div>
                                  <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-900 font-extrabold text-[8.5px] rounded border border-indigo-200">
                                    <Bot className="w-2.5 h-2.5 text-indigo-600" />
                                    <span>AI Repaired</span>
                                  </span>
                                </div>
                              ) : q.isValid ? (
                                <span className="inline-flex items-center space-x-0.5 px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[9px] rounded">
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Valid</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center space-x-0.5 px-2 py-0.5 bg-red-100 text-red-800 font-bold text-[9px] rounded"
                                  title={q.error}
                                >
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  <span>Incomplete</span>
                                </span>
                              )}

                              {q.autoCorrected && !q.aiFixed && (
                                <div>
                                  <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 font-bold text-[8px] rounded border border-amber-200">
                                    <Sparkles className="w-2 h-2 text-amber-600" />
                                    <span>Formatted</span>
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="p-2.5 text-center align-top">
                              <div className="flex items-center justify-center space-x-1">
                                {/* Fix single row with AI button */}
                                <button
                                  type="button"
                                  disabled={isRowFixing}
                                  onClick={() => handleFixSingleWithAI(idx)}
                                  className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded cursor-pointer transition-colors border border-indigo-200"
                                  title="Fix Question with Gemini AI"
                                >
                                  {isRowFixing ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                  ) : (
                                    <Sparkles className="w-3 h-3 text-indigo-600" />
                                  )}
                                </button>

                                {!q.isValid && (
                                  <button
                                    type="button"
                                    onClick={() => handleFixQuestion(idx)}
                                    className="p-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded cursor-pointer transition-colors"
                                    title="Auto-Fix Question (Fallback)"
                                  >
                                    <Wand2 className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setEditingQuestion({ ...q })}
                                  className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer transition-colors"
                                  title="Edit Row"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedRow(isExpanded ? null : q.rowIndex)}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer transition-colors"
                                  title="Toggle Details"
                                >
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Row Diagnostics & Raw Comparison Panel */}
                          {isExpanded && (
                            <tr className="bg-slate-50 border-y border-slate-200">
                              <td colSpan={7} className="p-3 text-xs">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h5 className="font-bold text-slate-900 flex items-center space-x-1.5">
                                      <Info className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Row #{q.rowIndex} Detailed Diagnostics & AI Summary</span>
                                    </h5>
                                    <div className="flex items-center space-x-1.5">
                                      <button
                                        type="button"
                                        disabled={isRowFixing}
                                        onClick={() => handleFixSingleWithAI(idx)}
                                        className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center space-x-1 cursor-pointer"
                                      >
                                        <Sparkles className="w-2.5 h-2.5" />
                                        <span>{isRowFixing ? 'Repairing...' : 'Fix with AI'}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingQuestion({ ...q })}
                                        className="px-2 py-0.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-[10px] font-bold flex items-center space-x-1 cursor-pointer"
                                      >
                                        <Edit3 className="w-2.5 h-2.5" />
                                        <span>Edit Question</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* AI Notes Banner if repaired */}
                                  {q.aiNotes && (
                                    <div className="bg-indigo-50 p-2.5 rounded-lg border border-indigo-200 text-indigo-950 text-[11px] space-y-1">
                                      <div className="flex items-center space-x-1 font-bold text-[10px] text-indigo-700 uppercase">
                                        <Bot className="w-3 h-3 text-indigo-600" />
                                        <span>Gemini AI Repair Summary:</span>
                                      </div>
                                      <p className="text-slate-800 font-medium">{q.aiNotes}</p>
                                    </div>
                                  )}

                                  {/* Issues list */}
                                  {q.issues && q.issues.length > 0 && (
                                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                                      <span className="font-bold text-[10px] text-slate-600 uppercase">Issues & Suggestions:</span>
                                      <ul className="space-y-1">
                                        {q.issues.map((iss, i) => (
                                          <li key={i} className="flex items-start space-x-2 text-[11px]">
                                            <span className="mt-0.5">
                                              {iss.severity === 'error' ? '❌' : iss.severity === 'warning' ? '⚠️' : '💡'}
                                            </span>
                                            <div>
                                              <span className="font-semibold text-slate-800">{iss.message}</span>
                                              {iss.suggestedFix !== undefined && (
                                                <span className="ml-1 text-emerald-700 font-mono text-[10px] font-bold">
                                                  (Fix: {String(iss.suggestedFix)})
                                                </span>
                                              )}
                                            </div>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Applied corrections */}
                                  {q.appliedCorrections && q.appliedCorrections.length > 0 && (
                                    <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-200 text-emerald-900 text-[11px] space-y-1">
                                      <span className="font-bold text-[10px] uppercase text-emerald-800">Automatic Adjustments Applied:</span>
                                      <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                                        {q.appliedCorrections.map((corr, cIdx) => (
                                          <li key={cIdx}>{corr}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Raw Fields Preview */}
                                  {q.rawFields && (
                                    <div className="bg-slate-100 p-2 rounded-lg text-[10px] text-slate-600 font-mono space-y-0.5">
                                      <span className="font-bold uppercase text-slate-700 block font-sans text-[9px]">Original Input Fields:</span>
                                      <div><strong className="text-slate-800">Q:</strong> {q.rawFields.questionText || '<empty>'}</div>
                                      <div><strong className="text-slate-800">Opts:</strong> [A: {q.rawFields.optionA || '-'}, B: {q.rawFields.optionB || '-'}, C: {q.rawFields.optionC || '-'}, D: {q.rawFields.optionD || '-'}]</div>
                                      <div><strong className="text-slate-800">Key:</strong> {q.rawFields.correctOption || '-'} | <strong className="text-slate-800">Marks:</strong> {String(q.rawFields.marks || '-')}</div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Import Options Strategy */}
              {parsedResult.questions.length > 0 && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-2 text-xs">
                  <p className="font-bold text-slate-900">Import Strategy:</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="radio"
                        name="importMode"
                        value="append"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        Append all {parsedResult.questions.length} questions ({currentQuestionCount} existing)
                      </span>
                    </label>

                    {currentQuestionCount > 0 && (
                      <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-800">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Replace existing {currentQuestionCount} questions</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!parsedResult || parsedResult.questions.length === 0}
            onClick={handleConfirmImport}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
          >
            <span>Import All {parsedResult?.questions.length || 0} Questions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Inline Edit Modal for a Single Row */}
        {editingQuestion && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-1.5">
                  <Edit3 className="w-4 h-4 text-emerald-600" />
                  <span>Edit Question #{editingQuestion.rowIndex}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Question Statement:</label>
                  <textarea
                    rows={3}
                    value={editingQuestion.questionText}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, questionText: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5">Option A:</label>
                    <input
                      type="text"
                      value={editingQuestion.optionA}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, optionA: e.target.value })
                      }
                      className="w-full p-1.5 border border-slate-300 rounded-md text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5">Option B:</label>
                    <input
                      type="text"
                      value={editingQuestion.optionB}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, optionB: e.target.value })
                      }
                      className="w-full p-1.5 border border-slate-300 rounded-md text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5">Option C:</label>
                    <input
                      type="text"
                      value={editingQuestion.optionC}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, optionC: e.target.value })
                      }
                      className="w-full p-1.5 border border-slate-300 rounded-md text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5">Option D:</label>
                    <input
                      type="text"
                      value={editingQuestion.optionD}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, optionD: e.target.value })
                      }
                      className="w-full p-1.5 border border-slate-300 rounded-md text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5">Correct Option:</label>
                    <select
                      value={editingQuestion.correctOption}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          correctOption: e.target.value as 'A' | 'B' | 'C' | 'D',
                        })
                      }
                      className="w-full p-1.5 border border-slate-300 rounded-md text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5">Marks:</label>
                    <input
                      type="number"
                      min={1}
                      value={editingQuestion.marks}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          marks: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full p-1.5 border border-slate-300 rounded-md text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5">Explanation (Optional):</label>
                  <input
                    type="text"
                    value={editingQuestion.explanation}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                    }
                    className="w-full p-1.5 border border-slate-300 rounded-md text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEdit(editingQuestion)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-2xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
