import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth';
import { fixQuestionsWithGemini } from '../gemini';
import { evaluateSubscription } from '../subscription';
import { checkAndExpireSubscriptions, getLastExpiryCheckStatus } from '../services/subscriptionExpiryService';

const router = Router();

// Apply auth & admin gate to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Admin Overview Dashboard Stats
router.get('/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalStudents = await prisma.user.count({
      where: { role: 'STUDENT' },
    });

    const premiumStudents = await prisma.user.count({
      where: { role: 'STUDENT', isPremium: true },
    });

    const totalTests = await prisma.test.count();

    const totalAttempts = await prisma.attempt.count();

    const revenueResult = await prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    });

    const totalRevenuePaise = revenueResult._sum.amount || 0;
    const totalRevenueINR = Math.round(totalRevenuePaise / 100);

    // Recent attempts list
    const recentAttempts = await prisma.attempt.findMany({
      take: 5,
      orderBy: { submittedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        test: { select: { title: true } },
      },
    });

    res.json({
      totalStudents,
      premiumStudents,
      freeStudents: totalStudents - premiumStudents,
      totalTests,
      totalAttempts,
      totalRevenueINR,
      recentAttempts: recentAttempts.map((a) => ({
        id: a.id,
        studentName: a.user.name,
        studentEmail: a.user.email,
        testTitle: a.test.title,
        score: a.score,
        totalMarks: a.totalMarks,
        submittedAt: a.submittedAt,
      })),
    });
  } catch (err: any) {
    console.error('Error fetching admin overview:', err);
    res.status(500).json({ error: 'Failed to fetch admin overview stats' });
  }
});

// Get all tests for admin
router.get('/tests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tests = await prisma.test.findMany({
      include: {
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      tests: tests.map((t) => ({
        id: t.id,
        title: t.title,
        subject: t.subject,
        durationMin: t.durationMin,
        totalMarks: t.totalMarks,
        isPublished: t.isPublished,
        createdAt: t.createdAt,
        questionCount: t._count.questions,
        attemptCount: t._count.attempts,
      })),
    });
  } catch (err: any) {
    console.error('Error fetching admin tests:', err);
    res.status(500).json({ error: 'Failed to fetch test papers' });
  }
});

// Get specific test with full question details
router.get('/tests/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: true,
      },
    });

    if (!test) {
      res.status(404).json({ error: 'Test paper not found' });
      return;
    }

    res.json({ test });
  } catch (err: any) {
    console.error('Error fetching test detail:', err);
    res.status(500).json({ error: 'Failed to fetch test detail' });
  }
});

// Create a new test paper with questions
router.post('/tests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, subject, durationMin, isPublished, questions } = req.body;

    if (!title || !subject || !durationMin || !Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'Title, subject, duration, and at least 1 question are required' });
      return;
    }

    // Calculate total marks from question marks sum
    const totalMarks = questions.reduce((sum: number, q: any) => sum + (Number(q.marks) || 1), 0);

    const newTest = await prisma.test.create({
      data: {
        title: title.trim(),
        subject: subject.trim(),
        durationMin: Number(durationMin),
        totalMarks,
        isPublished: Boolean(isPublished),
        questions: {
          create: questions.map((q: any) => ({
            questionText: q.questionText.trim(),
            optionA: q.optionA.trim(),
            optionB: q.optionB.trim(),
            optionC: q.optionC.trim(),
            optionD: q.optionD.trim(),
            correctOption: q.correctOption.toUpperCase().trim(),
            marks: Number(q.marks) || 1,
            explanation: q.explanation ? q.explanation.trim() : null,
          })),
        },
      },
      include: {
        questions: true,
      },
    });

    res.status(201).json({ message: 'Test paper created successfully', test: newTest });
  } catch (err: any) {
    console.error('Error creating test paper:', err);
    res.status(500).json({ error: 'Failed to create test paper' });
  }
});

// Update an existing test paper
router.put('/tests/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, subject, durationMin, isPublished, questions } = req.body;

    const existingTest = await prisma.test.findUnique({ where: { id } });
    if (!existingTest) {
      res.status(404).json({ error: 'Test paper not found' });
      return;
    }

    const totalMarks = Array.isArray(questions)
      ? questions.reduce((sum: number, q: any) => sum + (Number(q.marks) || 1), 0)
      : existingTest.totalMarks;

    const updatedTest = await prisma.$transaction(async (tx) => {
      if (Array.isArray(questions)) {
        await tx.question.deleteMany({ where: { testId: id } });
      }

      return tx.test.update({
        where: { id },
        data: {
          title: title ? title.trim() : existingTest.title,
          subject: subject ? subject.trim() : existingTest.subject,
          durationMin: durationMin !== undefined ? Number(durationMin) : existingTest.durationMin,
          isPublished: typeof isPublished === 'boolean' ? isPublished : existingTest.isPublished,
          totalMarks,
          questions: Array.isArray(questions)
            ? {
                create: questions.map((q: any) => ({
                  questionText: (q.questionText || '').trim(),
                  optionA: (q.optionA || '').trim(),
                  optionB: (q.optionB || '').trim(),
                  optionC: (q.optionC || '').trim(),
                  optionD: (q.optionD || '').trim(),
                  correctOption: (q.correctOption || 'A').toUpperCase().trim(),
                  marks: Number(q.marks) || 1,
                  explanation: q.explanation ? q.explanation.trim() : null,
                })),
              }
            : undefined,
        },
        include: {
          questions: true,
        },
      });
    });

    res.json({ message: 'Test paper updated successfully', test: updatedTest });
  } catch (err: any) {
    console.error('Error updating test paper:', err);
    res.status(500).json({ error: err?.message || 'Failed to update test paper' });
  }
});

// Delete a test paper
router.delete('/tests/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingTest = await prisma.test.findUnique({ where: { id } });
    if (!existingTest) {
      res.status(404).json({ error: 'Test paper not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.attempt.deleteMany({ where: { testId: id } });
      await tx.question.deleteMany({ where: { testId: id } });
      await tx.test.delete({ where: { id } });
    });

    res.json({ message: 'Test paper deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting test paper:', err);
    res.status(500).json({ error: err?.message || 'Failed to delete test paper' });
  }
});

// Get list of all students
router.get('/students', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      include: {
        attempts: {
          select: { score: true, totalMarks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedStudents = students.map((s) => {
      const attemptsCount = s.attempts.length;
      const totalScore = s.attempts.reduce((sum, a) => sum + a.score, 0);
      const possibleMarks = s.attempts.reduce((sum, a) => sum + a.totalMarks, 0);
      const avgPercentage = possibleMarks > 0 ? Math.round((totalScore / possibleMarks) * 100) : 0;

      return {
        id: s.id,
        name: s.name,
        email: s.email,
        isPremium: s.isPremium,
        premiumSince: s.premiumSince,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        createdAt: s.createdAt,
        attemptsCount,
        avgPercentage,
      };
    });

    res.json({ students: formattedStudents });
  } catch (err: any) {
    console.error('Error fetching students list:', err);
    res.status(500).json({ error: 'Failed to fetch students list' });
  }
});

// Get individual student performance details & topper comparison
router.get('/students/:id/performance', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        isPremium: true,
        premiumSince: true,
        currentStreak: true,
        longestStreak: true,
        lastAttemptDay: true,
        createdAt: true,
      },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const attempts = await prisma.attempt.findMany({
      where: { userId: id },
      include: {
        test: { select: { id: true, title: true, subject: true, totalMarks: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Compute topper score comparison for each test attempted
    const performanceHistory = await Promise.all(
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

    // Compute Subject & Overall Exam Analytics for Admin
    const totalAttemptsCount = performanceHistory.length;
    const avgScorePercentage =
      totalAttemptsCount > 0
        ? Math.round(
            performanceHistory.reduce((acc, curr) => acc + curr.percentage, 0) / totalAttemptsCount
          )
        : 0;

    const subjectMap: Record<string, { subject: string; attemptCount: number; percentages: number[]; totalScore: number; totalMarks: number }> = {};
    performanceHistory.forEach((a) => {
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

    const totalTimeSpentSec = performanceHistory.reduce((sum, a) => sum + (a.timeTakenSec || 0), 0);
    const totalMarksSum = performanceHistory.reduce((sum, a) => sum + a.totalMarks, 0);

    const analytics = {
      totalExamsWritten: totalAttemptsCount,
      avgPercentage: avgScorePercentage,
      highestPercentage: totalAttemptsCount > 0 ? Math.max(...performanceHistory.map((a) => a.percentage)) : 0,
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
      student,
      performanceHistory,
      analytics,
    });
  } catch (err: any) {
    console.error('Error fetching student performance:', err);
    res.status(500).json({ error: 'Failed to fetch student performance details' });
  }
});

// Manual Premium Grant for Student (Admin Permission Grant)
router.post(['/students/:id/grant-premium', '/students/:id/grant-permission'], async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await prisma.user.findUnique({ where: { id } });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const updatedStudent = await prisma.user.update({
      where: { id },
      data: {
        isPremium: true,
        premiumSince: new Date(),
      },
    });

    // Record audit log for admin permission grant
    await prisma.auditLog.create({
      data: {
        action: 'ADMIN_GRANT_PREMIUM',
        details: `Administrator granted full 365-day premium membership permission to student "${updatedStudent.name}" (${updatedStudent.email}).`,
      },
    });

    const subscription = evaluateSubscription(updatedStudent);

    res.json({
      message: `Premium permission successfully granted to ${updatedStudent.name}. Account is now Premium Active.`,
      student: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        email: updatedStudent.email,
        isPremium: updatedStudent.isPremium,
        premiumSince: updatedStudent.premiumSince,
        subscription,
      },
    });
  } catch (err: any) {
    console.error('Error granting premium status:', err);
    res.status(500).json({ error: 'Failed to grant premium status' });
  }
});

// Revoke Premium for Student
router.post('/students/:id/revoke-premium', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await prisma.user.findUnique({ where: { id } });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const updatedStudent = await prisma.user.update({
      where: { id },
      data: {
        isPremium: false,
        premiumSince: null,
      },
    });

    // Record audit log for admin permission revoke
    await prisma.auditLog.create({
      data: {
        action: 'ADMIN_REVOKE_PREMIUM',
        details: `Administrator revoked premium status for student "${updatedStudent.name}" (${updatedStudent.email}). Account reverted to Free Tier.`,
      },
    });

    const subscription = evaluateSubscription(updatedStudent);

    res.json({
      message: `Premium permission revoked for ${updatedStudent.name}. Account reverted to Free Tier.`,
      student: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        email: updatedStudent.email,
        isPremium: updatedStudent.isPremium,
        premiumSince: updatedStudent.premiumSince,
        subscription,
      },
    });
  } catch (err: any) {
    console.error('Error revoking premium status:', err);
    res.status(500).json({ error: 'Failed to revoke premium status' });
  }
});

// Test level analytics & leaderboard
router.get('/tests/:id/analytics', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: true,
      },
    });

    if (!test) {
      res.status(404).json({ error: 'Test paper not found' });
      return;
    }

    const attempts = await prisma.attempt.findMany({
      where: { testId: id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ score: 'desc' }, { timeTakenSec: 'asc' }],
    });

    const totalAttempts = attempts.length;
    const avgScore =
      totalAttempts > 0 ? Math.round((attempts.reduce((s, a) => s + a.score, 0) / totalAttempts) * 10) / 10 : 0;
    const avgTimeSec =
      totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.timeTakenSec, 0) / totalAttempts) : 0;

    // Topper
    const topperAttempt = attempts[0] || null;

    // Distribution buckets (0-20%, 21-40%, 41-60%, 61-80%, 81-100%)
    const scoreBuckets = {
      '0-20%': 0,
      '21-40%': 0,
      '41-60%': 0,
      '61-80%': 0,
      '81-100%': 0,
    };

    attempts.forEach((a) => {
      const pct = (a.score / a.totalMarks) * 100;
      if (pct <= 20) scoreBuckets['0-20%']++;
      else if (pct <= 40) scoreBuckets['21-40%']++;
      else if (pct <= 60) scoreBuckets['41-60%']++;
      else if (pct <= 80) scoreBuckets['61-80%']++;
      else scoreBuckets['81-100%']++;
    });

    // Leaderboard top 10
    const leaderboard = attempts.slice(0, 10).map((a, rank) => ({
      rank: rank + 1,
      studentName: a.user.name,
      studentEmail: a.user.email,
      score: a.score,
      totalMarks: a.totalMarks,
      percentage: Math.round((a.score / a.totalMarks) * 100),
      timeTakenSec: a.timeTakenSec,
      submittedAt: a.submittedAt,
    }));

    res.json({
      test: {
        id: test.id,
        title: test.title,
        subject: test.subject,
        durationMin: test.durationMin,
        totalMarks: test.totalMarks,
        isPublished: test.isPublished,
      },
      analytics: {
        totalAttempts,
        avgScore,
        avgTimeSec,
        scoreBuckets,
        topper: topperAttempt
          ? {
              name: topperAttempt.user.name,
              email: topperAttempt.user.email,
              score: topperAttempt.score,
              percentage: Math.round((topperAttempt.score / test.totalMarks) * 100),
              timeTakenSec: topperAttempt.timeTakenSec,
            }
          : null,
      },
      leaderboard,
      questions: test.questions,
    });
  } catch (err: any) {
    console.error('Error fetching test analytics:', err);
    res.status(500).json({ error: 'Failed to fetch test analytics' });
  }
});

// GET Batches
router.get('/batches', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const batches = await prisma.batch.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ batches });
  } catch (err: any) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// POST Create Batch
router.post('/batches', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, stream, description } = req.body;
    if (!name || !code) {
      res.status(400).json({ error: 'Name and Code are required' });
      return;
    }
    const batch = await prisma.batch.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        stream: (stream || 'RGUKT CET').trim(),
        description: description ? description.trim() : null,
      },
    });
    res.status(201).json({ message: 'Batch created successfully', batch });
  } catch (err: any) {
    console.error('Error creating batch:', err);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// DELETE Batch
router.delete('/batches/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.batch.delete({ where: { id } });
    res.json({ message: 'Batch deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting batch:', err);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

// GET Announcements
router.get('/announcements', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ announcements });
  } catch (err: any) {
    console.error('Error fetching announcements:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// POST Create Announcement
router.post('/announcements', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, priority, isPinned, targetBatch } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required' });
      return;
    }
    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        priority: priority || 'NORMAL',
        isPinned: Boolean(isPinned),
        targetBatch: targetBatch || 'ALL',
      },
    });
    res.status(201).json({ message: 'Announcement created successfully', announcement });
  } catch (err: any) {
    console.error('Error creating announcement:', err);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// DELETE Announcement
router.delete('/announcements/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.announcement.delete({ where: { id } });
    res.json({ message: 'Announcement deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting announcement:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// GET Audit Logs
router.get('/audit-logs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ logs });
  } catch (err: any) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET Global Question Bank (questions across all tests)
router.get('/question-bank', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        test: { select: { title: true, subject: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ questions });
  } catch (err: any) {
    console.error('Error fetching question bank:', err);
    res.status(500).json({ error: 'Failed to fetch question bank' });
  }
});

// GET All Attempts
router.get('/attempts', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attempts = await prisma.attempt.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        test: { select: { id: true, title: true, subject: true, totalMarks: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json({ attempts });
  } catch (err: any) {
    console.error('Error fetching all attempts:', err);
    res.status(500).json({ error: 'Failed to fetch attempts list' });
  }
});

// GET All Payments / Transactions
router.get('/payments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query;

    const whereClause: any = {};
    if (status && typeof status === 'string' && status !== 'ALL') {
      whereClause.status = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { razorpayOrderId: { contains: term } },
        { razorpayPaymentId: { contains: term } },
        { user: { name: { contains: term } } },
        { user: { email: { contains: term } } },
      ];
    }

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, isPremium: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const revenueAggregate = await prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    });

    const totalRevenueINR = Math.round((revenueAggregate._sum.amount || 0) / 100);

    res.json({ payments, totalRevenueINR });
  } catch (err: any) {
    console.error('Error fetching admin payments:', err);
    res.status(500).json({ error: 'Failed to fetch payments records' });
  }
});

// POST Manual Payment Approval
router.post('/payments/manual', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentEmail, amountINR = 3000, notes } = req.body;

    if (!studentEmail) {
      res.status(400).json({ error: 'Student email is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: studentEmail.trim().toLowerCase() },
    });

    if (!user) {
      res.status(404).json({ error: `Student with email "${studentEmail}" not found` });
      return;
    }

    // Update user to premium
    await prisma.user.update({
      where: { id: user.id },
      data: { isPremium: true, premiumSince: new Date() },
    });

    // Create payment entry
    const orderId = `manual_off_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const paymentId = `pay_off_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const amountPaise = (amountINR || 3000) * 100;

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        amount: amountPaise,
        status: 'PAID',
      },
      include: {
        user: { select: { id: true, name: true, email: true, isPremium: true } },
      },
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        action: 'MANUAL_PAYMENT_APPROVAL',
        details: `Approved manual payment of ₹${amountINR} for ${user.email}. ${notes || ''}`,
      },
    });

    res.json({ message: `Manual payment recorded and premium activated for ${user.name}`, payment });
  } catch (err: any) {
    console.error('Error processing manual payment:', err);
    res.status(500).json({ error: 'Failed to process manual payment' });
  }
});

// POST Approve Payment by Payment ID
router.post('/payments/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!payment) {
      res.status(404).json({ error: 'Payment record not found' });
      return;
    }

    // Mark payment as paid
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: { status: 'PAID', razorpayPaymentId: payment.razorpayPaymentId || `pay_manual_${Date.now()}` },
    });

    // Activate user premium status
    await prisma.user.update({
      where: { id: payment.userId },
      data: { isPremium: true, premiumSince: new Date() },
    });

    res.json({ message: 'Payment approved and premium membership activated', payment: updatedPayment });
  } catch (err: any) {
    console.error('Error approving payment:', err);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

// POST Fix questions using Gemini AI
router.post('/fix-questions-ai', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { questions, subject } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'Array of questions is required' });
      return;
    }

    console.log(`[AI Question Fixer] Processing ${questions.length} questions for subject: ${subject || 'Mathematics'}`);
    const fixedQuestions = await fixQuestionsWithGemini(questions, subject);

    res.json({
      success: true,
      count: fixedQuestions.length,
      fixedQuestions,
      message: `Successfully analyzed and repaired ${fixedQuestions.length} question(s) with AI.`,
    });
  } catch (err: any) {
    console.error('Error fixing questions with AI:', err);
    res.status(500).json({ error: err.message || 'Failed to fix questions using AI' });
  }
});

// GET /api/admin/subscriptions/daily-check-status
router.get('/subscriptions/daily-check-status', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = getLastExpiryCheckStatus();
    res.json({ status: status || { message: 'Daily daemon active. Initial check pending.' } });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve daily check status' });
  }
});

// POST /api/admin/subscriptions/run-daily-check
router.post('/subscriptions/run-daily-check', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await checkAndExpireSubscriptions();
    res.json({
      message: `Checked ${result.totalChecked} students: ${result.activeCount} active, ${result.expiredCount} expired after 365 days.`,
      result,
    });
  } catch (err: any) {
    console.error('Manual subscription check error:', err);
    res.status(500).json({ error: 'Failed to execute 365-day subscription expiration check' });
  }
});

export default router;

