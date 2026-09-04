/**
 * Utility to detect and sanitize NUL characters (\u0000 / 0x00) for PostgreSQL.
 * PostgreSQL UTF-8 text fields reject strings containing \u0000 with:
 * "invalid byte sequence for encoding 'UTF8': 0x00" (SQLSTATE 22021 / Prisma P2039).
 *
 * REQUIRED RULE:
 * At the PostgreSQL database boundary, this sanitizer removes ONLY the NUL character:
 * \u0000 / 0x00
 *
 * It must NOT perform ANY other transformation:
 * - NO .trim()
 * - NO .toUpperCase()
 * - NO .toLowerCase()
 * - NO .normalize()
 * - NO converting non-string values to defaults
 *
 * Strictly preserves:
 * leading spaces, trailing spaces, internal spaces, newlines, tabs, punctuation,
 * Unicode characters, LaTeX, MathJax delimiters, backslashes, escaped characters,
 * option formatting, correct-answer representation, explanation formatting, and types.
 */

export function containsNullCharacter(value: unknown): boolean {
  return typeof value === 'string' && value.includes('\u0000');
}

/**
 * Strips ONLY literal NUL characters (\u0000 / 0x00) from strings.
 * Preserves null, undefined, numbers, and any other non-string types untouched.
 */
export function sanitizePostgresString(
  value: string | null | undefined
): string | null | undefined {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/\u0000/g, '');
}

/**
 * Sanitizes question fields specifically before sending to Prisma/PostgreSQL,
 * logging safe diagnostics if any field contains an invalid NUL character.
 *
 * Preserves all types, formatting, casing, whitespace, and numerical values untouched.
 */
export function sanitizeQuestionForPostgres<T extends Record<string, any>>(
  question: T,
  questionIndex?: number
): T {
  if (!question || typeof question !== 'object') {
    return question;
  }

  const fieldsToCheck = [
    'questionText',
    'optionA',
    'optionB',
    'optionC',
    'optionD',
    'correctOption',
    'explanation',
  ];

  for (const fieldName of fieldsToCheck) {
    if (containsNullCharacter(question[fieldName])) {
      console.warn(
        `[Test Creation] NUL character removed\nQuestion index: ${
          questionIndex !== undefined ? questionIndex : 'unknown'
        }\nField: ${fieldName}`
      );
    }
  }

  return {
    ...question,
    questionText: sanitizePostgresString(question.questionText),
    optionA: sanitizePostgresString(question.optionA),
    optionB: sanitizePostgresString(question.optionB),
    optionC: sanitizePostgresString(question.optionC),
    optionD: sanitizePostgresString(question.optionD),
    correctOption: sanitizePostgresString(question.correctOption),
    explanation: sanitizePostgresString(question.explanation),
  };
}

/**
 * Sanitizes entire test paper payload before sending to Prisma/PostgreSQL.
 * Removes ONLY literal NUL (\u0000) characters without altering whitespace, casing, or types.
 */
export function sanitizeTestForPostgres<T extends Record<string, any>>(testData: T): T {
  if (!testData || typeof testData !== 'object') {
    return testData;
  }

  if (containsNullCharacter(testData.title)) {
    console.warn('[Test Creation] NUL character removed\nField: title');
  }
  if (containsNullCharacter(testData.subject)) {
    console.warn('[Test Creation] NUL character removed\nField: subject');
  }

  const sanitizedQuestions = Array.isArray(testData.questions)
    ? testData.questions.map((q: any, idx: number) => sanitizeQuestionForPostgres(q, idx))
    : testData.questions;

  return {
    ...testData,
    title: sanitizePostgresString(testData.title),
    subject: sanitizePostgresString(testData.subject),
    questions: sanitizedQuestions,
  };
}
