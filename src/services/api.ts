// Determine API base URL dynamically:
// - Uses import.meta.env.VITE_API_URL if configured (for separate frontend/backend deployments)
// - Defaults to relative '/api' for full-stack deployments (Node/Express, Cloud Run, Docker)
const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const API_BASE = configuredApiUrl
  ? (configuredApiUrl.endsWith('/api')
      ? configuredApiUrl
      : `${configuredApiUrl.replace(/\/+$/, '')}/api`)
  : '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  const targetUrl = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(targetUrl, {
    ...options,
    headers,
  });

  // Automatically upgrade client token if backend verified a token and issued a fresh application JWT
  const upgradedToken = response.headers.get('x-application-token');
  if (upgradedToken && typeof window !== 'undefined') {
    localStorage.setItem('token', upgradedToken);
  }

  const text = await response.text();
  let data: any = {};

  if (text && text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      // If parsing JSON fails (e.g. HTML 404 error page from static CDN or proxy)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `Backend API endpoint not found (404) at ${targetUrl}. Ensure the backend server is running and VITE_API_URL is configured correctly if hosted separately.`
          );
        }
        if (response.status === 405) {
          throw new Error(
            `Backend API method not allowed (405) at ${targetUrl}. The request was rejected by a static CDN or proxy. Please ensure the Express backend is running and VITE_API_URL is configured.`
          );
        }
        throw new Error(
          `Server error (${response.status}): ${response.statusText || 'Unexpected server response'}`
        );
      }
      throw new Error(
        `Received unexpected non-JSON response from server at ${targetUrl}. Please verify your deployment API routes or VITE_API_URL setting.`
      );
    }
  }

  if (!response.ok) {
    // If request fails due to 401 (Invalid, expired, or missing token), immediately clear the stale client token
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      window.dispatchEvent(
        new CustomEvent('auth:expired', {
          detail: { error: data.error || 'Invalid or expired token', status: 401 },
        })
      );
    }

    const error: any = new Error(data.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  return data as T;
}

// Auth API calls
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    apiRequest<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (userData: { name: string; email: string; password: string }) =>
    apiRequest<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  googleLogin: (userData: { idToken?: string; email: string; name?: string; googleId?: string }) =>
    apiRequest<{ user: any; token: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  getMe: () => apiRequest<{ user: any }>('/auth/me'),

  getAccountDetails: () =>
    apiRequest<{
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
        createdAt?: string;
        currentStreak?: number;
        longestStreak?: number;
      };
      subscription: {
        isPremium: boolean;
        status: 'ACTIVE' | 'EXPIRED' | 'FREE' | 'ADMIN';
        premiumSince: string | null;
        premiumExpiresAt: string | null;
        daysRemaining: number | null;
        validityDays: number;
      };
      payments: Array<{
        id: string;
        razorpayOrderId: string;
        razorpayPaymentId: string | null;
        amount: number;
        amountINR: number;
        status: string;
        createdAt: string;
        paymentMethod: string;
        purpose: string;
      }>;
    }>('/auth/account-details'),
};

// Payment API calls
export const paymentApi = {
  getConfig: () =>
    apiRequest<{
      configured: boolean;
      mode: 'LIVE' | 'TEST' | 'SIMULATION';
      keyPrefix: string | null;
      hasSecret: boolean;
      amountPaise: number;
      amountINR: number;
      currency: string;
    }>('/payment/config'),

  createOrder: () =>
    apiRequest<{
      orderId: string;
      id?: string;
      amount: number;
      currency: string;
      keyId: string;
      key?: string;
      user: any;
    }>('/payment/create-order', { method: 'POST' }),

  verifyPayment: (paymentDetails: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
  }) =>
    apiRequest<{ success: boolean; isPremium: boolean; token: string; user: any }>(
      '/payment/verify',
      {
        method: 'POST',
        body: JSON.stringify(paymentDetails),
      }
    ),

  getStatus: () => apiRequest<{ isPremium: boolean; premiumSince: string | null }>('/payment/status'),
};

// Student Test API calls
export const testApi = {
  getAvailableTests: () => apiRequest<{ tests: any[] }>('/tests'),

  getStudentDashboard: () => apiRequest<any>('/tests/me/dashboard'),

  getTestPaper: (testId: string) => apiRequest<{ test: any }>(`/tests/${testId}`),

  submitTestAttempt: (testId: string, answers: Record<string, string>, timeTakenSec: number) =>
    apiRequest<{
      success: boolean;
      attemptId: string;
      score: number;
      totalMarks: number;
      timeTakenSec: number;
      streak: { currentStreak: number; longestStreak: number };
    }>(`/tests/${testId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers, timeTakenSec }),
    }),

  getAttemptResult: (attemptId: string) =>
    apiRequest<any>(`/tests/attempts/${attemptId}/result`),

  getQuestionBank: (params?: { subject?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.subject) query.append('subject', params.subject);
    if (params?.search) query.append('search', params.search);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<{ questions: any[] }>(`/tests/question-bank${queryString}`);
  },

  getSubjectsAndTopics: () => apiRequest<{ subjects: any[] }>('/tests/subjects-topics'),
};

// Admin API calls
export const adminApi = {
  getOverview: () => apiRequest<any>('/admin/overview'),

  getTests: () => apiRequest<{ tests: any[] }>('/admin/tests'),

  getTestDetail: (testId: string) => apiRequest<{ test: any }>(`/admin/tests/${testId}`),

  createTest: (testData: any) =>
    apiRequest<{ message: string; test: any }>('/admin/tests', {
      method: 'POST',
      body: JSON.stringify(testData),
    }),

  updateTest: (testId: string, testData: any) =>
    apiRequest<{ message: string; test: any }>(`/admin/tests/${testId}`, {
      method: 'PUT',
      body: JSON.stringify(testData),
    }),

  deleteTest: (testId: string) =>
    apiRequest<{ message: string }>(`/admin/tests/${testId}`, {
      method: 'DELETE',
    }),

  getStudents: () => apiRequest<{ students: any[] }>('/admin/students'),

  getStudentPerformance: (studentId: string) =>
    apiRequest<any>(`/admin/students/${studentId}/performance`),

  grantPremium: (studentId: string) =>
    apiRequest<{ message: string; student: any }>(`/admin/students/${studentId}/grant-premium`, {
      method: 'POST',
    }),

  revokePremium: (studentId: string) =>
    apiRequest<{ message: string; student: any }>(`/admin/students/${studentId}/revoke-premium`, {
      method: 'POST',
    }),

  getTestAnalytics: (testId: string) =>
    apiRequest<any>(`/admin/tests/${testId}/analytics`),

  getBatches: () => apiRequest<{ batches: any[] }>('/admin/batches'),

  createBatch: (batchData: any) =>
    apiRequest<{ message: string; batch: any }>('/admin/batches', {
      method: 'POST',
      body: JSON.stringify(batchData),
    }),

  deleteBatch: (batchId: string) =>
    apiRequest<{ message: string }>(`/admin/batches/${batchId}`, {
      method: 'DELETE',
    }),

  getAnnouncements: () => apiRequest<{ announcements: any[] }>('/admin/announcements'),

  createAnnouncement: (data: any) =>
    apiRequest<{ message: string; announcement: any }>('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAnnouncement: (id: string) =>
    apiRequest<{ message: string }>(`/admin/announcements/${id}`, {
      method: 'DELETE',
    }),

  getAuditLogs: () => apiRequest<{ logs: any[] }>('/admin/audit-logs'),

  getQuestionBank: () => apiRequest<{ questions: any[] }>('/admin/question-bank'),

  getAttempts: () => apiRequest<{ attempts: any[] }>('/admin/attempts'),

  getPayments: (params?: { status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<{ payments: any[]; totalRevenueINR: number }>(`/admin/payments${queryString}`);
  },

  createManualPayment: (data: { studentEmail: string; amountINR?: number; notes?: string }) =>
    apiRequest<{ message: string; payment: any }>('/admin/payments/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approvePayment: (paymentId: string) =>
    apiRequest<{ message: string; payment: any }>(`/admin/payments/${paymentId}/approve`, {
      method: 'POST',
    }),

  fixQuestionsWithAI: (questions: any[], subject?: string) =>
    apiRequest<{ success: boolean; count: number; fixedQuestions: any[]; message: string }>(
      '/admin/fix-questions-ai',
      {
        method: 'POST',
        body: JSON.stringify({ questions, subject }),
      }
    ),

  getDailyCheckStatus: () =>
    apiRequest<{ status: any }>('/admin/subscriptions/daily-check-status'),

  runDailySubscriptionCheck: () =>
    apiRequest<{ message: string; result: any }>('/admin/subscriptions/run-daily-check', {
      method: 'POST',
    }),
};

