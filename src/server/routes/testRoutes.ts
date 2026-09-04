import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken, requirePremium, AuthRequest } from '../auth';

const router = Router();

// Apply auth gate to all student test routes
router.use(authenticateToken);

// List available published tests
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    const tests = await prisma.test.findMany({
      where: { isPublished: true },
      include: {
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get user's past attempts to show status
    const userAttempts = userId
      ? await prisma.attempt.findMany({
          where: { userId },
          orderBy: { submittedAt: 'desc' },
        })
      : [];

    const formattedTests = tests.map((t) => {
      const attemptsForTest = userAttempts.filter((a) => a.testId === t.id);
      const lastAttempt = attemptsForTest[0]; // Most recent attempt

      return {
        id: t.id,
        title: t.title,
        subject: t.subject,
        durationMin: t.durationMin,
        totalMarks: t.totalMarks,
        createdAt: t.createdAt,
        questionCount: t._count.questions,
        totalAttemptsCount: t._count.attempts,
        isAttempted: attemptsForTest.length > 0,
        userAttemptsCount: attemptsForTest.length,
        userLastScore: lastAttempt ? lastAttempt.score : null,
        userLastPercentage: lastAttempt ? Math.round((lastAttempt.score / lastAttempt.totalMarks) * 100) : null,
      };
    });

    res.json({ tests: formattedTests });
  } catch (err: any) {
    console.error('Error fetching tests:', err);
    res.status(500).json({ error: 'Failed to fetch test papers' });
  }
});

// Get student dashboard (streak, attempt history, topper comparisons)
router.get('/me/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User ID missing' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isPremium: true,
        premiumSince: true,
        currentStreak: true,
        longestStreak: true,
        lastAttemptDay: true,
      },
    });

    const attempts = await prisma.attempt.findMany({
      where: { userId },
      include: {
        test: {
          select: { id: true, title: true, subject: true, totalMarks: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Compute topper score for each attempted test
    const attemptsWithTopper = await Promise.all(
      attempts.map(async (a) => {
        const topperMax = await prisma.attempt.aggregate({
          where: { testId: a.testId },
          _max: { score: true },
        });

        const topperScore = topperMax._max.score ?? a.score;
        const percentage = Math.round((a.score / a.totalMarks) * 100);

        return {
          id: a.id,
          testId: a.testId,
          testTitle: a.test.title,
          subject: a.test.subject,
          score: a.score,
          totalMarks: a.totalMarks,
          percentage,
          timeTakenSec: a.timeTakenSec,
          submittedAt: a.submittedAt,
          topperScore,
          gapToTopper: topperScore - a.score,
        };
      })
    );

    const totalAvailableTests = await prisma.test.count({
      where: { isPublished: true },
    });

    const totalAttemptsCount = attempts.length;
    const avgScorePercentage =
      totalAttemptsCount > 0
        ? Math.round(
            attemptsWithTopper.reduce((acc, curr) => acc + curr.percentage, 0) / totalAttemptsCount
          )
        : 0;

    // Compute Subject & Overall Exam Analytics
    const subjectMap: Record<string, { subject: string; attemptCount: number; percentages: number[]; totalScore: number; totalMarks: number }> = {};
    attemptsWithTopper.forEach((a) => {
      const subj = a.subject || 'General Studies';
      if (!subjectMap[subj]) {
        subjectMap[subj] = { subject: subj, attemptCount: 0, percentages: [], totalScore: 0, totalMarks: 0 };
      }
      subjectMap[subj].attemptCount += 1;
      subjectMap[subj].percentages.push(a.percentage);
      subjectMap[subj].totalScore += a.score;
      subjectMap[subj].totalMarks += a.totalMarks;
    });

    const subjectBreakdown = Object.values(subjectMap).map((item) => ({
      subject: item.subject,
      attemptCount: item.attemptCount,
      avgPercentage: Math.round(item.percentages.reduce((s, p) => s + p, 0) / item.attemptCount),
      highestPercentage: Math.max(...item.percentages),
      totalScore: item.totalScore,
      totalMarks: item.totalMarks,
    }));

    const totalTimeSpentSec = attemptsWithTopper.reduce((sum, a) => sum + (a.timeTakenSec || 0), 0);
    const totalMarksSum = attemptsWithTopper.reduce((sum, a) => sum + a.totalMarks, 0);

    const analytics = {
      totalExamsWritten: totalAttemptsCount,
      avgPercentage: avgScorePercentage,
      highestPercentage: totalAttemptsCount > 0 ? Math.max(...attemptsWithTopper.map((a) => a.percentage)) : 0,
      totalTimeSpentSec,
      avgTimePerQuestionSec: totalMarksSum > 0 ? Math.round(totalTimeSpentSec / totalMarksSum) : 0,
      strongSubjects: subjectBreakdown.filter((s) => s.avgPercentage >= 70).map((s) => s.subject),
      weakSubjects: subjectBreakdown.filter((s) => s.avgPercentage < 50).map((s) => s.subject),
      accuracyRating:
        avgScorePercentage >= 80
          ? 'Excellent'
          : avgScorePercentage >= 65
          ? 'Good'
          : avgScorePercentage >= 50
          ? 'Average'
          : 'Needs Improvement',
      subjectBreakdown,
    };

    res.json({
      user,
      stats: {
        totalAvailableTests,
        totalAttemptsCount,
        avgScorePercentage,
        currentStreak: user?.currentStreak || 0,
        longestStreak: user?.longestStreak || 0,
      },
      attemptsHistory: attemptsWithTopper,
      analytics,
    });
  } catch (err: any) {
    console.error('Error fetching student dashboard:', err);
    res.status(500).json({ error: 'Failed to fetch student dashboard data' });
  }
});

// GET Student Question Bank (all uploaded questions from published tests) - REQUIRES PREMIUM
router.get('/question-bank', requirePremium, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subject, search } = req.query;

    const whereClause: any = {
      test: { isPublished: true },
    };

    if (subject && typeof subject === 'string' && subject !== 'ALL') {
      whereClause.test = {
        isPublished: true,
        subject: { equals: subject },
      };
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      whereClause.OR = [
        { questionText: { contains: searchTerm } },
        { optionA: { contains: searchTerm } },
        { optionB: { contains: searchTerm } },
        { optionC: { contains: searchTerm } },
        { optionD: { contains: searchTerm } },
        { explanation: { contains: searchTerm } },
      ];
    }

    const questions = await prisma.question.findMany({
      where: whereClause,
      include: {
        test: { select: { id: true, title: true, subject: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ questions });
  } catch (err: any) {
    console.error('Error fetching student question bank:', err);
    res.status(500).json({ error: 'Failed to fetch question bank' });
  }
});

// GET Student Subjects & Topics (aggregated from uploaded tests and questions)
router.get('/subjects-topics', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const publishedTests = await prisma.test.findMany({
      where: { isPublished: true },
      include: {
        questions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Default RGUKT Mathematics Syllabus Core Branches
    const coreSubjects = [
      { name: 'Mathematics', code: 'MATH', color: 'bg-indigo-600' },
      { name: 'Algebra & Polynomials', code: 'ALG', color: 'bg-blue-600' },
      { name: 'Trigonometry & Applications', code: 'TRIG', color: 'bg-purple-600' },
      { name: 'Coordinate Geometry', code: 'COORD', color: 'bg-emerald-600' },
      { name: 'Mensuration & Statistics', code: 'STAT', color: 'bg-amber-600' },
    ];

    const result = coreSubjects.map((core) => {
      const testsInSubject = publishedTests.filter(
        (t) =>
          core.name === 'Mathematics' ||
          t.subject.toLowerCase().includes(core.name.toLowerCase()) ||
          core.name.toLowerCase().includes(t.subject.toLowerCase())
      );

      const totalQuestionsInSubject = testsInSubject.reduce(
        (sum, t) => sum + t.questions.length,
        0
      );

      const topics = testsInSubject.map((t) => ({
        id: t.id,
        title: t.title,
        questionCount: t.questions.length,
        durationMin: t.durationMin,
        totalMarks: t.totalMarks,
      }));

      return {
        id: `sub-${core.code.toLowerCase()}`,
        name: core.name,
        code: core.code,
        color: core.color,
        testCount: testsInSubject.length,
        totalQuestions: totalQuestionsInSubject,
        topics,
        tests: testsInSubject.map((t) => ({
          id: t.id,
          title: t.title,
          durationMin: t.durationMin,
          totalMarks: t.totalMarks,
          questionCount: t.questions.length,
        })),
      };
    });

    const extraSubjectNames = Array.from(
      new Set(
        publishedTests
          .map((t) => t.subject)
          .filter(
            (s) =>
              !coreSubjects.some(
                (c) => c.name.toLowerCase() === s.toLowerCase()
              )
          )
      )
    );

    extraSubjectNames.forEach((sName) => {
      const testsInSubject = publishedTests.filter((t) => t.subject === sName);
      const totalQuestionsInSubject = testsInSubject.reduce(
        (sum, t) => sum + t.questions.length,
        0
      );
      result.push({
        id: `sub-${sName.toLowerCase().replace(/\s+/g, '-')}`,
        name: sName,
        code: sName.substring(0, 4).toUpperCase(),
        color: 'bg-rose-500',
        testCount: testsInSubject.length,
        totalQuestions: totalQuestionsInSubject,
        topics: testsInSubject.map((t) => ({
          id: t.id,
          title: t.title,
          questionCount: t.questions.length,
          durationMin: t.durationMin,
          totalMarks: t.totalMarks,
        })),
        tests: testsInSubject.map((t) => ({
          id: t.id,
          title: t.title,
          durationMin: t.durationMin,
          totalMarks: t.totalMarks,
          questionCount: t.questions.length,
        })),
      });
    });

    res.json({ subjects: result });
  } catch (err: any) {
    console.error('Error fetching subjects & topics:', err);
    res.status(500).json({ error: 'Failed to fetch subjects and topics' });
  }
});

// Get test details & questions for exam mode (EXCLUDES correct answers and explanations) - REQUIRES PREMIUM
router.get('/:id', requirePremium, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const test = await prisma.test.findFirst({
      where: { id, isPublished: true },
      include: {
        questions: {
          select: {
            id: true,
            questionText: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            marks: true,
            // CRITICAL: DO NOT select correctOption or explanation here!
          },
        },
      },
    });

    if (!test) {
      res.status(404).json({ error: 'Test paper not found or not published' });
      return;
    }

    res.json({ test });
  } catch (err: any) {
    console.error('Error fetching test paper:', err);
    res.status(500).json({ error: 'Failed to load test paper' });
  }
});

// Submit test attempt - REQUIRES PREMIUM
router.post('/:id/submit', requirePremium, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: testId } = req.params;
    const userId = req.user?.id;
    const { answers, timeTakenSec } = req.body; // answers is { [questionId]: "A" | "B" | "C" | "D" }

    if (!userId) {
      res.status(401).json({ error: 'User ID missing' });
      return;
    }

    if (!answers || typeof answers !== 'object') {
      res.status(400).json({ error: 'Invalid answers format' });
      return;
    }

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: true },
    });

    if (!test) {
      res.status(404).json({ error: 'Test paper not found' });
      return;
    }

    // Calculate score
    let totalScore = 0;
    test.questions.forEach((q) => {
      const studentAnswer = answers[q.id];
      if (studentAnswer && studentAnswer.toUpperCase() === q.correctOption.toUpperCase()) {
        totalScore += q.marks;
      }
    });

    // Save Attempt in DB
    const attempt = await prisma.attempt.create({
      data: {
        userId,
        testId,
        answers: JSON.stringify(answers),
        score: totalScore,
        totalMarks: test.totalMarks,
        timeTakenSec: Number(timeTakenSec) || 0,
        startedAt: new Date(Date.now() - (Number(timeTakenSec) || 0) * 1000),
        submittedAt: new Date(),
      },
    });

    // Streak Logic Calculation
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let newCurrentStreak = user?.currentStreak || 0;
    const lastDay = user?.lastAttemptDay;

    if (lastDay === todayStr) {
      // Same calendar day attempt: keep streak as is
      newCurrentStreak = Math.max(1, newCurrentStreak);
    } else if (lastDay === yesterdayStr) {
      // Attempted on consecutive day: increment streak
      newCurrentStreak += 1;
    } else {
      // Skipped a day or first attempt: set streak to 1
      newCurrentStreak = 1;
    }

    const newLongestStreak = Math.max(user?.longestStreak || 0, newCurrentStreak);

    await prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastAttemptDay: todayStr,
      },
    });

    res.json({
      success: true,
      attemptId: attempt.id,
      score: totalScore,
      totalMarks: test.totalMarks,
      timeTakenSec: attempt.timeTakenSec,
      streak: {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
      },
    });
  } catch (err: any) {
    console.error('Error submitting test attempt:', err);
    res.status(500).json({ error: 'Failed to submit test attempt' });
  }
});

// Get detailed result & solution for an attempt - REQUIRES PREMIUM
router.get('/attempts/:attemptId/result', requirePremium, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { attemptId } = req.params;
    const userId = req.user?.id;

    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            questions: true, // INCLUDES correctOption and explanation
          },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!attempt) {
      res.status(404).json({ error: 'Attempt record not found' });
      return;
    }

    // Verify ownership or Admin role
    if (attempt.userId !== userId && req.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied to this attempt result' });
      return;
    }

    // Get topper score for this test
    const topperMax = await prisma.attempt.aggregate({
      where: { testId: attempt.testId },
      _max: { score: true },
    });

    const parsedAnswers = JSON.parse(attempt.answers || '{}');

    // Format questions with student answer comparison
    const questionsWithSolutions = attempt.test.questions.map((q) => {
      const studentAns = parsedAnswers[q.id] || null;
      const isCorrect = studentAns && studentAns.toUpperCase() === q.correctOption.toUpperCase();

      return {
        id: q.id,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        studentAnswer: studentAns,
        isCorrect,
        marks: q.marks,
        explanation: q.explanation,
      };
    });

    res.json({
      attemptId: attempt.id,
      testTitle: attempt.test.title,
      subject: attempt.test.subject,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      timeTakenSec: attempt.timeTakenSec,
      submittedAt: attempt.submittedAt,
      topperScore: topperMax._max.score ?? attempt.score,
      questions: questionsWithSolutions,
      studentName: attempt.user.name,
    });
  } catch (err: any) {
    console.error('Error fetching attempt result:', err);
    res.status(500).json({ error: 'Failed to load attempt result details' });
  }
});

export default router;
