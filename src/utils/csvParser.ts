export type IssueSeverity = 'error' | 'warning' | 'suggestion' | 'info';

export interface RowValidationIssue {
  severity: IssueSeverity;
  field: 'questionText' | 'optionA' | 'optionB' | 'optionC' | 'optionD' | 'correctOption' | 'marks' | 'explanation' | 'general';
  message: string;
  suggestedFix?: string | number;
  autoFixable?: boolean;
}

export interface RawRowFields {
  questionText?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
  marks?: string | number;
  explanation?: string;
}

export interface ParsedQuestion {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  marks: number;
  explanation: string;
  isValid: boolean;
  error?: string;
  rowIndex: number;
  issues?: RowValidationIssue[];
  autoCorrected?: boolean;
  appliedCorrections?: string[];
  rawFields?: RawRowFields;
  aiFixed?: boolean;
  aiNotes?: string;
}

export const STANDARDIZED_CSV_HEADERS = [
  'Question',
  'OptionA',
  'OptionB',
  'OptionC',
  'OptionD',
  'Correct',
  'Explanation',
  'Marks',
] as const;

export interface CsvHeaderValidation {
  isStandard: boolean;
  detectedHeaders: string[];
  recognizedColumns: {
    question: boolean;
    optionA: boolean;
    optionB: boolean;
    optionC: boolean;
    optionD: boolean;
    correct: boolean;
    explanation: boolean;
    marks: boolean;
  };
  missingRequired: string[];
  isComplete: boolean;
}

export interface ExtractedQuestionData {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  marks: number;
  hasExtractedOptions: boolean;
}

/**
 * Calculates the Levenshtein distance between two strings for fuzzy matching.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const a = (s1 || '').trim().toLowerCase();
  const b = (s2 || '').trim().toLowerCase();
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Calculates string similarity ratio between 0.0 (completely different) and 1.0 (exact match).
 */
export function stringSimilarity(s1: string, s2: string): number {
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const a = s1.trim().toLowerCase();
  const b = s2.trim().toLowerCase();
  if (a === b) return 1.0;

  const cleanA = a.replace(/[^a-z0-9]/g, '');
  const cleanB = b.replace(/[^a-z0-9]/g, '');
  if (cleanA === cleanB && cleanA.length > 0) return 1.0;
  if (!cleanA || !cleanB) return 0.0;

  // Substring inclusion bonus
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    const minLen = Math.min(cleanA.length, cleanB.length);
    const maxLen = Math.max(cleanA.length, cleanB.length);
    return 0.75 + (minLen / maxLen) * 0.25;
  }

  const maxLen = Math.max(cleanA.length, cleanB.length);
  const dist = levenshteinDistance(cleanA, cleanB);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Strips UTF-8 BOM and normalizes linebreaks while preserving all mathematical characters,
 * quotes, LaTeX, equations, and multiline spacing.
 */
export function sanitizeRawInput(raw: string): string {
  if (!raw) return '';

  return raw
    .replace(/^\uFEFF/, '')
    .replace(/^\uFFFE/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/**
 * Pure RFC 4180-compliant CSV/Delimited state-machine parser.
 * Supports:
 * - Multiline quoted fields (newlines inside quotes are preserved as literal characters)
 * - Commas, semicolons, brackets, math symbols inside quotes
 * - Escaped double quotes ("") inside quotes
 * - Unicode characters (σ, √, ∑, ∫, ∞, ≤, ≥, ≠, ∈, π, θ, α, β, x², 10⁻², etc.)
 * - LaTeX and mathematical notation (\frac{a}{b}, \sqrt{x}, x^2 + 2x + 1, etc.)
 */
export function parseRFC4180CSV(input: string, customDelimiter?: string): string[][] {
  if (!input || !input.trim()) return [];

  let text = input;
  if (text.charCodeAt(0) === 0xfeff || text.charCodeAt(0) === 0xfffe) {
    text = text.slice(1);
  }

  const delimiter = customDelimiter || detectDelimiter(text);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let hasQuotes = false;

  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < len && text[i + 1] === '"') {
          currentField += '"';
          i++; // skip the escaped second quote
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        // Any character inside quotes is preserved as-is
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        hasQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
        hasQuotes = false;
      } else if (char === '\r') {
        if (i + 1 < len && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = '';
        hasQuotes = false;
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        hasQuotes = false;
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  // Push trailing field & row
  if (currentField.length > 0 || hasQuotes || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Detects delimiter (comma, tab, semicolon, pipe) by scanning outside quoted strings
 */
export function detectDelimiter(text: string): string {
  let inQuotes = false;
  let commas = 0;
  let tabs = 0;
  let semicolons = 0;
  let pipes = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes) {
      if (char === ',') commas++;
      else if (char === '\t') tabs++;
      else if (char === ';') semicolons++;
      else if (char === '|') pipes++;
      else if (char === '\n' || char === '\r') {
        if (commas > 0 || tabs > 0 || semicolons > 0 || pipes > 0) {
          break;
        }
      }
    }
  }

  if (tabs > commas && tabs > semicolons && tabs > pipes) return '\t';
  if (semicolons > commas && semicolons > tabs && semicolons > pipes) return ';';
  if (pipes > commas && pipes > tabs && pipes > semicolons) return '|';
  return ',';
}

/**
 * Universal question parser supporting:
 * 1. Standard RFC 4180 CSV with headers (Question, Option A, Option B, Option C, Option D, Correct Answer, Explanation, Marks)
 * 2. Positional CSV rows without headers
 * 3. JSON Array of question objects
 * 4. Plain Text MCQ blocks (Q1. ... (A) ... (B) ... Ans: ...)
 */
export function parseQuestionsCSV(rawContent: string): {
  questions: ParsedQuestion[];
  validCount: number;
  invalidCount: number;
  headersFound: string[];
  headerValidation?: CsvHeaderValidation;
  isStandardCsv?: boolean;
} {
  if (!rawContent || !rawContent.trim()) {
    return { questions: [], validCount: 0, invalidCount: 0, headersFound: [] };
  }

  const cleanText = sanitizeRawInput(rawContent);
  const trimmed = cleanText.trim();

  // 1. JSON format check
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsedJson = JSON.parse(trimmed);
      const items = Array.isArray(parsedJson) ? parsedJson : parsedJson.questions || [parsedJson];
      if (Array.isArray(items) && items.length > 0) {
        return processObjectList(items);
      }
    } catch {
      // Fall through to CSV
    }
  }

  // 2. Delimited RFC 4180 Parsing
  const rawRows = parseRFC4180CSV(cleanText);

  // Check if first line contains explicit CSV headers
  const firstRow = rawRows[0] || [];
  const headerMap = mapHeaders(firstRow);
  const headerValidation = validateCsvHeaders(firstRow);

  const hasExplicitHeader =
    headerMap.questionText !== -1 &&
    (headerMap.optionA !== -1 ||
      headerMap.optionB !== -1 ||
      headerMap.correctOption !== -1 ||
      headerMap.explanation !== -1 ||
      headerMap.marks !== -1);

  // If explicit header matched or rawRows have multi-column structure (>= 4 columns)
  const isDelimited =
    hasExplicitHeader ||
    (rawRows.length > 0 && rawRows.some((r) => r.length >= 4));

  if (isDelimited && rawRows.length > 0) {
    return parseDelimitedRows(rawRows, hasExplicitHeader, headerMap, headerValidation);
  }

  // 3. Fallback to Plain Text Block parser for unstructured Word/PDF copy-paste
  const textResult = parseTextBlockQuestions(cleanText);
  if (textResult.questions.length > 0) {
    return textResult;
  }

  // Final fallback to delimited
  return parseDelimitedRows(rawRows, hasExplicitHeader, headerMap, headerValidation);
}

/**
 * Converts RFC-4180 parsed CSV rows into ParsedQuestion array
 */
function parseDelimitedRows(
  rawRows: string[][],
  hasExplicitHeader: boolean,
  headerMap: ReturnType<typeof mapHeaders>,
  headerValidation: CsvHeaderValidation
): {
  questions: ParsedQuestion[];
  validCount: number;
  invalidCount: number;
  headersFound: string[];
  headerValidation?: CsvHeaderValidation;
  isStandardCsv?: boolean;
} {
  if (rawRows.length === 0) {
    return { questions: [], validCount: 0, invalidCount: 0, headersFound: [] };
  }

  const firstRow = rawRows[0];
  let dataRows = rawRows;
  let hasHeader = false;

  if (hasExplicitHeader) {
    hasHeader = true;
    dataRows = rawRows.slice(1);
  }

  const parsedQuestions: ParsedQuestion[] = [];
  let validCount = 0;

  dataRows.forEach((row, idx) => {
    // Skip entirely blank rows
    if (row.length === 0 || row.every((c) => !c.trim())) {
      return;
    }

    const rowNum = hasHeader ? idx + 2 : idx + 1;

    let questionText = '';
    let optionA = '';
    let optionB = '';
    let optionC = '';
    let optionD = '';
    let rawCorrect = 'A';
    let rawMarks: any = 1;
    let explanation = '';

    if (hasHeader) {
      questionText = getCellValue(row, headerMap.questionText);
      optionA = getCellValue(row, headerMap.optionA);
      optionB = getCellValue(row, headerMap.optionB);
      optionC = getCellValue(row, headerMap.optionC);
      optionD = getCellValue(row, headerMap.optionD);
      rawCorrect = getCellValue(row, headerMap.correctOption);
      rawMarks = getCellValue(row, headerMap.marks);
      explanation = getCellValue(row, headerMap.explanation);
    } else {
      // Positional Mapping (8 columns: Question, Option A, Option B, Option C, Option D, Correct Answer, Explanation, Marks)
      questionText = row[0] || '';
      optionA = row[1] || '';
      optionB = row[2] || '';
      optionC = row[3] || '';
      optionD = row[4] || '';
      rawCorrect = row[5] || 'A';

      if (row.length >= 8) {
        const val6 = row[6] || '';
        const val7 = row[7] || '';
        const isVal7Numeric = !isNaN(Number(val7)) && val7.trim() !== '';
        const isVal6Numeric = !isNaN(Number(val6)) && val6.trim() !== '';

        if (isVal7Numeric && !isVal6Numeric) {
          explanation = val6;
          rawMarks = val7;
        } else if (isVal6Numeric && !isVal7Numeric) {
          rawMarks = val6;
          explanation = val7;
        } else {
          explanation = val6;
          rawMarks = val7;
        }
      } else if (row.length === 7) {
        const val6 = row[6] || '';
        if (!isNaN(Number(val6)) && val6.trim() !== '') {
          rawMarks = val6;
          explanation = '';
        } else {
          explanation = val6;
          rawMarks = 1;
        }
      }
    }

    const validated = validateAndEnrichQuestion(rowNum, {
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      rawCorrect,
      rawMarks,
      explanation,
    });

    if (validated.isValid) {
      validCount++;
    }

    parsedQuestions.push(validated);
  });

  return {
    questions: parsedQuestions,
    validCount,
    invalidCount: parsedQuestions.length - validCount,
    headersFound: hasHeader ? firstRow : ['Positional Columns (Question, Opt A, Opt B, Opt C, Opt D, Answer, Exp, Marks)'],
    headerValidation: hasHeader ? headerValidation : undefined,
    isStandardCsv: hasHeader ? headerValidation.isStandard : false,
  };
}

function getCellValue(row: string[], colIndex: number): string {
  if (colIndex < 0 || colIndex >= row.length) return '';
  return (row[colIndex] || '').trim();
}

/**
 * Validates, flags issues, and formats question row fields.
 * Preserves mathematical notations, equations, symbols, LaTeX, and multiline content.
 */
export function validateAndEnrichQuestion(
  rowIndex: number,
  raw: {
    questionText?: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    rawCorrect?: string;
    rawMarks?: any;
    explanation?: string;
  }
): ParsedQuestion {
  const issues: RowValidationIssue[] = [];
  const appliedCorrections: string[] = [];
  let autoCorrected = false;

  const rawQText = (raw.questionText || '').trim();
  const rawOptA = (raw.optionA || '').trim();
  const rawOptB = (raw.optionB || '').trim();
  const rawOptC = (raw.optionC || '').trim();
  const rawOptD = (raw.optionD || '').trim();
  const rawCorrect = (raw.rawCorrect || '').trim();
  const rawExp = (raw.explanation || '').trim();

  // 1. Question Text validation
  if (!rawQText) {
    issues.push({
      severity: 'error',
      field: 'questionText',
      message: `Row ${rowIndex}: Question statement is missing`,
      suggestedFix: `Question ${rowIndex}`,
      autoFixable: true,
    });
  }

  // 2. Option A validation
  if (!rawOptA) {
    issues.push({
      severity: 'error',
      field: 'optionA',
      message: `Row ${rowIndex}: Option A is empty`,
      suggestedFix: 'Option A',
      autoFixable: true,
    });
  }

  // 3. Option B validation
  if (!rawOptB) {
    issues.push({
      severity: 'error',
      field: 'optionB',
      message: `Row ${rowIndex}: Option B is empty`,
      suggestedFix: 'Option B',
      autoFixable: true,
    });
  }

  // 4. Option C validation
  if (!rawOptC) {
    issues.push({
      severity: 'error',
      field: 'optionC',
      message: `Row ${rowIndex}: Option C is empty`,
      suggestedFix: 'Option C',
      autoFixable: true,
    });
  }

  // 5. Option D validation
  if (!rawOptD) {
    issues.push({
      severity: 'error',
      field: 'optionD',
      message: `Row ${rowIndex}: Option D is empty`,
      suggestedFix: 'Option D',
      autoFixable: true,
    });
  }

  // 6. Correct Option normalization & validation
  const resolvedCorrect = resolveCorrectOption(rawCorrect, rawOptA, rawOptB, rawOptC, rawOptD);
  const normalizedRaw = (rawCorrect || '').trim().toUpperCase();

  if (!rawCorrect) {
    issues.push({
      severity: 'error',
      field: 'correctOption',
      message: `Row ${rowIndex}: Correct answer is missing`,
      suggestedFix: 'A',
      autoFixable: true,
    });
  } else if (!['A', 'B', 'C', 'D'].includes(normalizedRaw)) {
    if (['OPTION A', 'OPTION B', 'OPTION C', 'OPTION D', '(A)', '(B)', '(C)', '(D)', '[A]', '[B]', '[C]', '[D]', '1', '2', '3', '4'].includes(normalizedRaw)) {
      appliedCorrections.push(`Normalized answer "${rawCorrect}" to "${resolvedCorrect}"`);
      autoCorrected = true;
    } else {
      issues.push({
        severity: 'suggestion',
        field: 'correctOption',
        message: `Answer format "${rawCorrect}" resolved to "${resolvedCorrect}"`,
        suggestedFix: resolvedCorrect,
        autoFixable: true,
      });
    }
  }

  // 7. Marks validation
  const marksResult = parseAndValidateMarks(raw.rawMarks);
  const marks = marksResult.marks;
  if (marksResult.issue) {
    issues.push(marksResult.issue);
    appliedCorrections.push(marksResult.issue.message);
    autoCorrected = true;
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const isValid = errors.length === 0;

  return {
    rowIndex,
    questionText: rawQText,
    optionA: rawOptA,
    optionB: rawOptB,
    optionC: rawOptC,
    optionD: rawOptD,
    correctOption: resolvedCorrect,
    marks,
    explanation: rawExp,
    isValid,
    error: errors.map((e) => e.message).join('; '),
    issues,
    autoCorrected,
    appliedCorrections: appliedCorrections.length > 0 ? appliedCorrections : undefined,
    rawFields: {
      questionText: raw.questionText,
      optionA: raw.optionA,
      optionB: raw.optionB,
      optionC: raw.optionC,
      optionD: raw.optionD,
      correctOption: raw.rawCorrect,
      marks: raw.rawMarks,
      explanation: raw.explanation,
    },
  };
}

/**
 * Resolves correct option letters from various formats (A, B, C, D, Option A, (B), [C], 1, 2, 3, 4,
 * and exact text matching with option choices).
 */
export function resolveCorrectOption(
  raw: string,
  optA: string,
  optB: string,
  optC: string,
  optD: string
): 'A' | 'B' | 'C' | 'D' {
  if (!raw) return 'A';

  const rawTrimmed = raw.trim();

  // 1. Direct single letter A, B, C, D
  const upper = rawTrimmed.toUpperCase();
  if (upper === 'A') return 'A';
  if (upper === 'B') return 'B';
  if (upper === 'C') return 'C';
  if (upper === 'D') return 'D';

  // 2. Direct numeric index 1, 2, 3, 4
  if (upper === '1') return 'A';
  if (upper === '2') return 'B';
  if (upper === '3') return 'C';
  if (upper === '4') return 'D';

  // 3. Option A, Option B, Opt A, Opt 1, Choice A, etc.
  const optMatch = upper.match(/^(?:OPTION|OPT|CHOICE)\s*[:.\-]?\s*([A-D1-4])/i);
  if (optMatch && optMatch[1]) {
    const key = optMatch[1].toUpperCase();
    if (key === 'A' || key === '1') return 'A';
    if (key === 'B' || key === '2') return 'B';
    if (key === 'C' || key === '3') return 'C';
    if (key === 'D' || key === '4') return 'D';
  }

  // 4. Bracketed (A), (B), [C], (1), etc.
  const bracketMatch = upper.match(/^[\[\(]\s*([A-D1-4])\s*[\]\)]/i);
  if (bracketMatch && bracketMatch[1]) {
    const key = bracketMatch[1].toUpperCase();
    if (key === 'A' || key === '1') return 'A';
    if (key === 'B' || key === '2') return 'B';
    if (key === 'C' || key === '3') return 'C';
    if (key === 'D' || key === '4') return 'D';
  }

  // 5. Letter with dot/colon/paren: A., B), C:
  const letterDotMatch = upper.match(/^([A-D1-4])[.:\)]/i);
  if (letterDotMatch && letterDotMatch[1]) {
    const key = letterDotMatch[1].toUpperCase();
    if (key === 'A' || key === '1') return 'A';
    if (key === 'B' || key === '2') return 'B';
    if (key === 'C' || key === '3') return 'C';
    if (key === 'D' || key === '4') return 'D';
  }

  // 6. Answer label prefix e.g. "Answer: B" or "Correct: C"
  const ansPrefixMatch = upper.match(/^(?:CORRECT|ANSWER|ANS|KEY|RIGHT)\s*(?:OPTION|CHOICE|ANSWER)?\s*[:=.\-]?\s*(?:IS\s*)?[:=.\-]?\s*(?:\(?([A-D1-4])\)?|\[([A-D1-4])\])/i);
  if (ansPrefixMatch) {
    const key = (ansPrefixMatch[1] || ansPrefixMatch[2]).toUpperCase();
    if (key === 'A' || key === '1') return 'A';
    if (key === 'B' || key === '2') return 'B';
    if (key === 'C' || key === '3') return 'C';
    if (key === 'D' || key === '4') return 'D';
  }

  // 7. Exact text match with option choices
  const targetLower = rawTrimmed.toLowerCase();
  if (optA && optA.trim().toLowerCase() === targetLower) return 'A';
  if (optB && optB.trim().toLowerCase() === targetLower) return 'B';
  if (optC && optC.trim().toLowerCase() === targetLower) return 'C';
  if (optD && optD.trim().toLowerCase() === targetLower) return 'D';

  // 8. Fuzzy string similarity match
  const candidates: { letter: 'A' | 'B' | 'C' | 'D'; score: number }[] = [
    { letter: 'A', score: stringSimilarity(targetLower, (optA || '').trim().toLowerCase()) },
    { letter: 'B', score: stringSimilarity(targetLower, (optB || '').trim().toLowerCase()) },
    { letter: 'C', score: stringSimilarity(targetLower, (optC || '').trim().toLowerCase()) },
    { letter: 'D', score: stringSimilarity(targetLower, (optD || '').trim().toLowerCase()) },
  ];
  candidates.sort((a, b) => b.score - a.score);
  if (candidates[0].score >= 0.7) {
    return candidates[0].letter;
  }

  return 'A';
}

/**
 * Validates marks value and handles word numbers, numbers with units, decimals
 */
export function parseAndValidateMarks(rawMark: any): {
  marks: number;
  issue?: RowValidationIssue;
  rawStr: string;
} {
  const rawStr = rawMark !== undefined && rawMark !== null ? String(rawMark).trim() : '';

  if (!rawStr) {
    return { marks: 1, rawStr: '' };
  }

  // 1. Direct positive integer check
  const numDirect = Number(rawStr);
  if (!isNaN(numDirect) && numDirect > 0) {
    return { marks: Math.max(1, Math.round(numDirect)), rawStr };
  }

  // 2. Word numbers: "one", "two", "three", "four", "five"
  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const lower = rawStr.toLowerCase();
  if (wordMap[lower]) {
    return {
      marks: wordMap[lower],
      rawStr,
      issue: {
        severity: 'warning',
        field: 'marks',
        message: `Non-numeric word mark "${rawStr}" converted to numeric value ${wordMap[lower]}`,
        suggestedFix: wordMap[lower],
        autoFixable: true,
      },
    };
  }

  // 3. Extract numeric portion if embedded with text e.g. "2 marks", "3 pts", "+2", "(1)", "score=2"
  const matchNum = rawStr.match(/(?:^|[^\d.-])(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?|score)?/i);
  if (matchNum && matchNum[1]) {
    const parsedVal = Math.max(1, Math.round(Number(matchNum[1])));
    return {
      marks: parsedVal,
      rawStr,
      issue: {
        severity: 'warning',
        field: 'marks',
        message: `Non-numeric/formatted mark "${rawStr}" converted to ${parsedVal} mark(s)`,
        suggestedFix: parsedVal,
        autoFixable: true,
      },
    };
  }

  // 4. Default fallback
  return {
    marks: 1,
    rawStr,
    issue: {
      severity: 'warning',
      field: 'marks',
      message: `Invalid mark "${rawStr}" defaulted to standard 1 mark`,
      suggestedFix: 1,
      autoFixable: true,
    },
  };
}

/**
 * Validates header compliance with standard CSV formats
 */
export function validateCsvHeaders(headers: string[]): CsvHeaderValidation {
  const map = mapHeaders(headers);
  const recognized = {
    question: map.questionText !== -1,
    optionA: map.optionA !== -1,
    optionB: map.optionB !== -1,
    optionC: map.optionC !== -1,
    optionD: map.optionD !== -1,
    correct: map.correctOption !== -1,
    explanation: map.explanation !== -1,
    marks: map.marks !== -1,
  };

  const missingRequired: string[] = [];
  if (!recognized.question) missingRequired.push('Question');
  if (!recognized.optionA) missingRequired.push('Option A');
  if (!recognized.optionB) missingRequired.push('Option B');
  if (!recognized.optionC) missingRequired.push('Option C');
  if (!recognized.optionD) missingRequired.push('Option D');
  if (!recognized.correct) missingRequired.push('Correct Answer');

  const isComplete =
    recognized.question &&
    recognized.optionA &&
    recognized.optionB &&
    recognized.optionC &&
    recognized.optionD &&
    recognized.correct &&
    recognized.explanation &&
    recognized.marks;

  return {
    isStandard: isComplete || (recognized.question && recognized.optionA && recognized.optionB && recognized.correct),
    detectedHeaders: headers,
    recognizedColumns: recognized,
    missingRequired,
    isComplete,
  };
}

/**
 * Maps header column names to question property indexes.
 * Supports:
 * - Question, QuestionText, QText, Statement, Problem, Title
 * - Option A, OptionA, Opt A, Choice A, A, Option 1
 * - Option B, OptionB, Opt B, Choice B, B, Option 2
 * - Option C, OptionC, Opt C, Choice C, C, Option 3
 * - Option D, OptionD, Opt D, Choice D, D, Option 4
 * - Correct Answer, Correct, Correct Option, Answer, Key, Ans, Right Answer
 * - Explanation, Solution, Detailed Solution, Soln, Exp, Reasoning, Hint
 * - Marks, Mark, Score, Weightage, Points, Pts
 */
export function mapHeaders(headers: string[]): {
  questionText: number;
  optionA: number;
  optionB: number;
  optionC: number;
  optionD: number;
  correctOption: number;
  marks: number;
  explanation: number;
} {
  const map = {
    questionText: -1,
    optionA: -1,
    optionB: -1,
    optionC: -1,
    optionD: -1,
    correctOption: -1,
    marks: -1,
    explanation: -1,
  };

  headers.forEach((header, idx) => {
    const norm = (header || '')
      .toLowerCase()
      .replace(/[\s_\-\.\(\)\[\]:]/g, '');

    if (
      norm === 'question' ||
      norm === 'questiontext' ||
      norm === 'qtext' ||
      norm === 'qstatement' ||
      norm === 'statement' ||
      norm === 'problem' ||
      norm === 'title' ||
      norm === 'q'
    ) {
      map.questionText = idx;
    } else if (norm === 'optiona' || norm === 'opta' || norm === 'a' || norm === 'choicea' || norm === 'option1' || norm === 'opt1' || norm === 'choice1') {
      map.optionA = idx;
    } else if (norm === 'optionb' || norm === 'optb' || norm === 'b' || norm === 'choiceb' || norm === 'option2' || norm === 'opt2' || norm === 'choice2') {
      map.optionB = idx;
    } else if (norm === 'optionc' || norm === 'optc' || norm === 'c' || norm === 'choicec' || norm === 'option3' || norm === 'opt3' || norm === 'choice3') {
      map.optionC = idx;
    } else if (norm === 'optiond' || norm === 'optd' || norm === 'd' || norm === 'choiced' || norm === 'option4' || norm === 'opt4' || norm === 'choice4') {
      map.optionD = idx;
    } else if (
      norm === 'correctanswer' ||
      norm === 'correct' ||
      norm === 'correctoption' ||
      norm === 'answer' ||
      norm === 'key' ||
      norm === 'ans' ||
      norm === 'rightanswer' ||
      norm === 'rightoption' ||
      norm === 'correctchoice' ||
      norm === 'correctans'
    ) {
      map.correctOption = idx;
    } else if (
      norm === 'marks' ||
      norm === 'mark' ||
      norm === 'score' ||
      norm === 'weightage' ||
      norm === 'points' ||
      norm === 'point' ||
      norm === 'pts'
    ) {
      map.marks = idx;
    } else if (
      norm === 'explanation' ||
      norm === 'solution' ||
      norm === 'detailedsolution' ||
      norm === 'soln' ||
      norm === 'exp' ||
      norm === 'reasoning' ||
      norm === 'reason' ||
      norm === 'hint' ||
      norm === 'working'
    ) {
      map.explanation = idx;
    }
  });

  return map;
}

/**
 * Normalizes JSON array objects into ParsedQuestion
 */
function processObjectList(items: any[]): {
  questions: ParsedQuestion[];
  validCount: number;
  invalidCount: number;
  headersFound: string[];
} {
  const parsedQuestions: ParsedQuestion[] = [];
  let validCount = 0;

  items.forEach((item, idx) => {
    const questionText = item.questionText || item.question || item.qText || item.statement || item.title || '';
    const optionA = item.optionA || item.optA || item.a || item.options?.[0] || '';
    const optionB = item.optionB || item.optB || item.b || item.options?.[1] || '';
    const optionC = item.optionC || item.optC || item.c || item.options?.[2] || '';
    const optionD = item.optionD || item.optD || item.d || item.options?.[3] || '';
    const rawCorrect = String(item.correctOption || item.answer || item.key || item.correct || 'A');
    const marks = Number(item.marks || item.score || 1) || 1;
    const explanation = item.explanation || item.solution || item.explain || '';

    const validated = validateAndEnrichQuestion(idx + 1, {
      questionText: String(questionText || ''),
      optionA: String(optionA || ''),
      optionB: String(optionB || ''),
      optionC: String(optionC || ''),
      optionD: String(optionD || ''),
      rawCorrect: String(rawCorrect || 'A'),
      rawMarks: marks,
      explanation: String(explanation || ''),
    });

    if (validated.isValid) validCount++;

    parsedQuestions.push(validated);
  });

  return {
    questions: parsedQuestions,
    validCount,
    invalidCount: parsedQuestions.length - validCount,
    headersFound: ['JSON Object Import'],
  };
}

/**
 * Applies all suggested fixes to a single parsed question
 */
export function applyQuestionSuggestions(q: ParsedQuestion): ParsedQuestion {
  const updated = {
    questionText: q.questionText || (q.issues?.find((i) => i.field === 'questionText')?.suggestedFix as string) || `Question ${q.rowIndex}`,
    optionA: q.optionA || (q.issues?.find((i) => i.field === 'optionA')?.suggestedFix as string) || 'Option A',
    optionB: q.optionB || (q.issues?.find((i) => i.field === 'optionB')?.suggestedFix as string) || 'Option B',
    optionC: q.optionC || (q.issues?.find((i) => i.field === 'optionC')?.suggestedFix as string) || 'Both A and B',
    optionD: q.optionD || (q.issues?.find((i) => i.field === 'optionD')?.suggestedFix as string) || 'None of the above',
    rawCorrect: (['A', 'B', 'C', 'D'].includes(q.correctOption) ? q.correctOption : 'A'),
    rawMarks: Number(q.marks) > 0 ? Number(q.marks) : 1,
    explanation: q.explanation || '',
  };

  return validateAndEnrichQuestion(q.rowIndex, updated);
}

/**
 * Applies all suggested fixes across an array of parsed questions
 */
export function applyAllQuestionSuggestions(questions: ParsedQuestion[]): {
  questions: ParsedQuestion[];
  validCount: number;
  invalidCount: number;
} {
  const updatedQuestions = questions.map((q) => applyQuestionSuggestions(q));
  const validCount = updatedQuestions.filter((q) => q.isValid).length;
  const invalidCount = updatedQuestions.length - validCount;
  return {
    questions: updatedQuestions,
    validCount,
    invalidCount,
  };
}

/**
 * Plain Text Block parser supporting structured text documents with options (A)-(D)
 */
function parseTextBlockQuestions(text: string): {
  questions: ParsedQuestion[];
  validCount: number;
  invalidCount: number;
  headersFound: string[];
} {
  const strictDocQuestions = tokenizeStrictQuestionDocument(text);
  if (strictDocQuestions && strictDocQuestions.length > 0) {
    const validCount = strictDocQuestions.filter((q) => q.isValid).length;
    return {
      questions: strictDocQuestions,
      validCount,
      invalidCount: strictDocQuestions.length - validCount,
      headersFound: ['Strict Question/Option Tokenizer'],
    };
  }

  const blocks = splitIntoQuestionBlocks(text);
  const questions: ParsedQuestion[] = [];
  let validCount = 0;

  blocks.forEach((block, idx) => {
    if (!block.trim()) return;
    const extracted = tokenizeQuestionBlock(block);
    if (extracted.questionText && (extracted.optionA || extracted.optionB)) {
      const validated = validateAndEnrichQuestion(idx + 1, {
        questionText: extracted.questionText,
        optionA: extracted.optionA,
        optionB: extracted.optionB,
        optionC: extracted.optionC,
        optionD: extracted.optionD,
        rawCorrect: extracted.correctOption,
        rawMarks: extracted.marks,
        explanation: extracted.explanation,
      });
      if (validated.isValid) validCount++;
      questions.push(validated);
    }
  });

  return {
    questions,
    validCount,
    invalidCount: questions.length - validCount,
    headersFound: ['Plain Text MCQ Blocks'],
  };
}

function splitIntoQuestionBlocks(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let currentBlockLines: string[] = [];

  const questionStartRegex =
    /^\s*(?:(?:q(?:uestion|ues|ue|n)?|prob(?:lem)?|item|ex(?:ercise)?|no\.?)\s*(?:no\.?|#)?\s*[:.\-]?\s*\d*|\d+|\[\d+\]|\(\d+\))\s*[:.\-)]\s*/i;

  let blockHasOptions = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      currentBlockLines.push(line);
      continue;
    }

    const isNumberedQuestion = questionStartRegex.test(trimmedLine);
    const isOptionLine =
      /^(?:(?:Option|Opt|Choice)\s*[:.\-]?(?:\([a-dA-D1-4]\)|\[[a-dA-D1-4]\]|[a-dA-D1-4]\b)\s*[:.\-]?|\([a-dA-D1-4]\)|\[[a-dA-D1-4]\]|[a-dA-D1-4][.)\-:\>])\s*/i.test(
        trimmedLine
      );

    if (isOptionLine) {
      blockHasOptions = true;
    }

    if (isNumberedQuestion && currentBlockLines.length > 0 && blockHasOptions) {
      blocks.push(currentBlockLines.join('\n').trim());
      currentBlockLines = [];
      blockHasOptions = false;
    }

    currentBlockLines.push(line);
  }

  if (currentBlockLines.length > 0) {
    const lastBlock = currentBlockLines.join('\n').trim();
    if (lastBlock) {
      blocks.push(lastBlock);
    }
  }

  return blocks.length > 0 ? blocks : [text.trim()];
}

export function tokenizeQuestionBlock(rawInput: string): ExtractedQuestionData {
  if (!rawInput || !rawInput.trim()) {
    return {
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: 'A',
      explanation: '',
      marks: 1,
      hasExtractedOptions: false,
    };
  }

  let text = sanitizeRawInput(rawInput);

  let marks = 1;
  const marksMatch = text.match(/(?:\[|\()?\s*(?:marks?|weightage|points?|pts?|score)\s*[:=.\-]?\s*(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)?\s*(?:\]|\))?/i);
  if (marksMatch && marksMatch[1]) {
    marks = Math.max(1, Math.round(Number(marksMatch[1])));
    text = text.replace(marksMatch[0], ' ');
  }

  let explanation = '';
  const expMatch = text.match(/(?:^|\n|[\s\t,;]{2,}|\s(?=[(A-Da-d1-4]))\s*(?:detailed\s+solution|explanation|solution|explain|reasoning|reason|soln|sol|exp|hint|note|working|why)\s*[:=.\-]?\s*([\s\S]+)$/i);
  if (expMatch) {
    explanation = expMatch[1].trim();
    text = text.substring(0, text.lastIndexOf(expMatch[0])).trim();
  }

  let rawCorrect = 'A';
  const ansMatch = text.match(/(?:^|\n|[\s\t,;]{2,}|\s(?=[(A-Da-d1-4]))\s*(?:correct\s+(?:option|answer|choice|ans)?|right\s+(?:option|answer)|ans(?:wer)?|key|opt)\s*[:=.\-]?\s*(?:is\s*)?[:=.\-]?\s*(\([A-Da-d1-4]\)|\[[A-Da-d1-4]\]|[A-Da-d1-4]\b|[^\n\r]+)?/i);
  if (ansMatch) {
    if (ansMatch[1]) {
      const trimmedAns = ansMatch[1].trim();
      const firstLetterMatch = trimmedAns.match(/^(?:\(?([a-dA-D1-4])\)?|[\[\(]([a-dA-D1-4])[\]\)])/);
      if (firstLetterMatch) {
        rawCorrect = (firstLetterMatch[1] || firstLetterMatch[2]).toUpperCase();
      } else {
        rawCorrect = trimmedAns;
      }
    }
    text = text.replace(ansMatch[0], ' ');
  }

  const regA = /(?:^|[\r\n]|[\t\s]{2,}|(?<=[.?!:])\s*)(?:\(\s*[Aa]\s*\)|\[\s*[Aa]\s*\]|[Aa]\.|\b(?:Option|Opt)\s*[Aa]:?)\s*/g;
  const regB = /(?:^|[\r\n]|[\t\s]{2,}|(?<=[.?!:])\s*)(?:\(\s*[Bb]\s*\)|\[\s*[Bb]\s*\]|[Bb]\.|\b(?:Option|Opt)\s*[Bb]:?)\s*/g;
  const regC = /(?:^|[\r\n]|[\t\s]{2,}|(?<=[.?!:])\s*)(?:\(\s*[Cc]\s*\)|\[\s*[Cc]\s*\]|[Cc]\.|\b(?:Option|Opt)\s*[Cc]:?)\s*/g;
  const regD = /(?:^|[\r\n]|[\t\s]{2,}|(?<=[.?!:])\s*)(?:\(\s*[Dd]\s*\)|\[\s*[Dd]\s*\]|[Dd]\.|\b(?:Option|Opt)\s*[Dd]:?)\s*/g;

  const mA = regA.exec(text);
  const mB = regB.exec(text);
  const mC = regC.exec(text);
  const mD = regD.exec(text);

  if (mA && mB && mA.index < mB.index) {
    const questionText = text.substring(0, mA.index).trim();
    const optionA = text.substring(mA.index + mA[0].length, mB.index).trim();
    let optionB = '';
    let optionC = '';
    let optionD = '';

    if (mC && mB.index < mC.index) {
      optionB = text.substring(mB.index + mB[0].length, mC.index).trim();
      if (mD && mC.index < mD.index) {
        optionC = text.substring(mC.index + mC[0].length, mD.index).trim();
        optionD = text.substring(mD.index + mD[0].length).trim();
      } else {
        optionC = text.substring(mC.index + mC[0].length).trim();
      }
    } else {
      optionB = text.substring(mB.index + mB[0].length).trim();
    }

    const resolved = resolveCorrectOption(rawCorrect, optionA, optionB, optionC, optionD);
    return {
      questionText: cleanQuestionNumbering(questionText),
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption: resolved,
      explanation,
      marks,
      hasExtractedOptions: Boolean(optionA && optionB),
    };
  }

  return {
    questionText: text.trim(),
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: resolveCorrectOption(rawCorrect, '', '', '', ''),
    explanation,
    marks,
    hasExtractedOptions: false,
  };
}

export function tokenizeStrictQuestionDocument(rawContent: string): ParsedQuestion[] | null {
  if (!rawContent || !rawContent.trim()) return null;

  const text = sanitizeRawInput(rawContent);
  const qRegex =
    /(?:^|\n)\s*(?:(?:q(?:uestion|ues|ue|n)?|prob(?:lem)?|item|ex(?:ercise)?|no\.?)\s*(?:no\.?|#)?\s*[:.\-]?\s*\d*|\d+|\[\d+\]|\(\d+\))\s*[:.\-)]\s*/gi;
  const qMatches: Array<{ index: number; length: number }> = [];

  let m: RegExpExecArray | null;
  while ((m = qRegex.exec(text)) !== null) {
    qMatches.push({ index: m.index, length: m[0].length });
  }

  if (qMatches.length <= 1) return null;

  const parsedQuestions: ParsedQuestion[] = [];
  for (let i = 0; i < qMatches.length; i++) {
    const start = qMatches[i].index;
    const end = i < qMatches.length - 1 ? qMatches[i + 1].index : text.length;
    const blockText = text.substring(start, end).trim();

    const extracted = tokenizeQuestionBlock(blockText);
    if (extracted.hasExtractedOptions && extracted.questionText && extracted.optionA && extracted.optionB) {
      parsedQuestions.push({
        rowIndex: i + 1,
        questionText: extracted.questionText,
        optionA: extracted.optionA,
        optionB: extracted.optionB,
        optionC: extracted.optionC || 'Option C',
        optionD: extracted.optionD || 'Option D',
        correctOption: extracted.correctOption,
        marks: extracted.marks || 1,
        explanation: extracted.explanation || '',
        isValid: true,
      });
    }
  }

  return parsedQuestions.length > 0 ? parsedQuestions : null;
}

export function extractQuestionOptionsAndMetadata(rawInput: string): ExtractedQuestionData {
  return tokenizeQuestionBlock(rawInput);
}

export function extractQuestionOptionsByPatternScoring(rawInput: string): ExtractedQuestionData {
  return tokenizeQuestionBlock(rawInput);
}

export function cleanDisplayQuestionText(text: string): string {
  return text || '';
}

export function cleanQuestionNumbering(text: string): string {
  if (!text) return '';
  return text
    .replace(
      /^\s*(?:(?:q(?:uestion|ues|ue|n)?|prob(?:lem)?|item|ex(?:ercise)?|no\.?)\s*(?:no\.?|#)?\s*[:.\-]?\s*\d*|\d+|\[\d+\]|\(\d+\))\s*[:.\-)]\s*/i,
      ''
    )
    .replace(/^\s*(?:q(?:uestion|ues|ue|n)?\s*[:.\-]\s*)/i, '')
    .trim();
}

export function cleanOptionPrefix(text: string, letter: string): string {
  return (text || '').trim();
}

export function cleanExplanationPrefix(text: string): string {
  if (!text) return '';
  return text
    .replace(
      /^\s*(?:detailed\s+solution|explanation|solution|explain|reasoning|reason|soln|sol|exp|hint|note|working|why)\s*[:=.\-]?\s*/i,
      ''
    )
    .trim();
}

export function getSampleCSVTemplate(): string {
  return `Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation,Marks
"If sin(θ) + cos(θ) = √2, what is the value of θ in the first quadrant?","30°","45°","60°","90°","B","sin(45°) + cos(45°) = 1/√2 + 1/√2 = 2/√2 = √2.",1
"What is the distance between the points (2, 3) and (5, 7)?","3 units","4 units","5 units","6 units","C","Distance = √[(5-2)² + (7-3)²] = √(9 + 16) = √25 = 5 units.",1
"Find the roots of the quadratic equation x² - 5x + 6 = 0.","x = 1, 6","x = 2, 3","x = -2, -3","x = 0, 5","B","Factoring gives (x-2)(x-3) = 0, hence x = 2 and x = 3.",1
"In an Arithmetic Progression, if first term a = 3 and common difference d = 4, what is the 10th term?","35","39","40","43","B","a_10 = a + 9d = 3 + 9(4) = 3 + 36 = 39.",1
"What is the discriminant of the quadratic equation ax² + bx + c = 0?","b - 4ac","b² - 4ac","√(b² - 4ac)","4ac - b²","B","Discriminant Δ = b² - 4ac.",1`;
}

export function getSamplePlainTextTemplate(): string {
  return `1. In a right-angled triangle ABC, angle B = 90 degrees.
If AB = 3 cm and BC = 4 cm, find the length of hypotenuse AC.
(A) 5 cm
(B) 6 cm
(C) 7 cm
(D) 8 cm
Answer: A
Explanation: By Pythagoras theorem, AC = √(3² + 4²) = √(9 + 16) = 5 cm.

2. What is the value of sin²(30°) + cos²(30°)?
(A) 0
(B) 1
(C) 2
(D) 1/2
Answer: B
Explanation: By trigonometric identity sin²(θ) + cos²(θ) = 1 for any angle θ.`;
}
