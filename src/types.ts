export type Role = 'ADMIN' | 'STUDENT';

export interface SubscriptionInfo {
  isPremium: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'FREE' | 'ADMIN';
  premiumSince: string | null;
  premiumExpiresAt: string | null;
  daysRemaining: number | null;
  validityDays: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isPremium: boolean;
  premiumSince?: string | null;
  subscription?: SubscriptionInfo;
  currentStreak: number;
  longestStreak: number;
  lastAttemptDay?: string | null;
  createdAt?: string;
}

export interface Question {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks: number;
  correctOption?: string; // Only available in results/admin
  explanation?: string | null; // Only available in results/admin
}

export interface TestPaper {
  id: string;
  title: string;
  subject: string;
  durationMin: number;
  totalMarks: number;
  isPublished: boolean;
  createdAt?: string;
  questionCount?: number;
  attemptCount?: number;
  totalAttemptsCount?: number;
  isAttempted?: boolean;
  userAttemptsCount?: number;
  userLastScore?: number | null;
  userLastPercentage?: number | null;
  questions?: Question[];
}

export interface Attempt {
  id: string;
  testId: string;
  testTitle: string;
  subject: string;
  score: number;
  totalMarks: number;
  percentage: number;
  timeTakenSec: number;
  submittedAt: string;
  topperScore: number;
  gapToTopper: number;
}

export interface QuestionSolution extends Question {
  correctOption: string;
  studentAnswer: string | null;
  isCorrect: boolean;
  explanation: string | null;
}

export interface AttemptResult {
  attemptId: string;
  testTitle: string;
  subject: string;
  score: number;
  totalMarks: number;
  timeTakenSec: number;
  submittedAt: string;
  topperScore: number;
  questions: QuestionSolution[];
  studentName?: string;
}

export interface StudentStats {
  totalAvailableTests: number;
  totalAttemptsCount: number;
  avgScorePercentage: number;
  currentStreak: number;
  longestStreak: number;
}

export interface SubjectAnalytics {
  subject: string;
  attemptCount: number;
  avgPercentage: number;
  highestPercentage: number;
  totalScore: number;
  totalMarks: number;
}

export interface StudentExamAnalytics {
  totalExamsWritten: number;
  avgPercentage: number;
  highestPercentage: number;
  totalTimeSpentSec: number;
  avgTimePerQuestionSec: number;
  strongSubjects: string[];
  weakSubjects: string[];
  accuracyRating: string;
  subjectBreakdown: SubjectAnalytics[];
}

export interface StudentDashboardData {
  user: User;
  stats: StudentStats;
  attemptsHistory: Attempt[];
  analytics?: StudentExamAnalytics;
}

export interface AdminOverviewStats {
  totalStudents: number;
  premiumStudents: number;
  freeStudents: number;
  totalTests: number;
  totalAttempts: number;
  totalRevenueINR: number;
  recentAttempts: Array<{
    id: string;
    studentName: string;
    studentEmail: string;
    testTitle: string;
    score: number;
    totalMarks: number;
    submittedAt: string;
  }>;
}

export interface StudentListItem {
  id: string;
  name: string;
  email: string;
  isPremium: boolean;
  premiumSince: string | null;
  currentStreak: number;
  longestStreak: number;
  createdAt: string;
  attemptsCount: number;
  avgPercentage: number;
}

export interface TestAnalyticsData {
  test: {
    id: string;
    title: string;
    subject: string;
    durationMin: number;
    totalMarks: number;
    isPublished: boolean;
  };
  analytics: {
    totalAttempts: number;
    avgScore: number;
    avgTimeSec: number;
    scoreBuckets: Record<string, number>;
    topper: {
      name: string;
      email: string;
      score: number;
      percentage: number;
      timeTakenSec: number;
    } | null;
  };
  leaderboard: Array<{
    rank: number;
    studentName: string;
    studentEmail: string;
    score: number;
    totalMarks: number;
    percentage: number;
    timeTakenSec: number;
    submittedAt: string;
  }>;
  questions: Question[];
}
