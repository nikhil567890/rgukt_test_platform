import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { PaywallModal } from './components/PaywallModal';
import { AccountModal } from './components/AccountModal';
import { SEOHead } from './components/common/SEOHead';

import { StudentDashboard } from './components/student/StudentDashboard';
import { TestList } from './components/student/TestList';
import { ExamScreen } from './components/student/ExamScreen';
import { SolutionView } from './components/student/SolutionView';
import { StudentSubjects } from './components/student/StudentSubjects';
import { StudentQuestionBank } from './components/student/StudentQuestionBank';

import { AdminOverview } from './components/admin/AdminOverview';
import { TestManagement } from './components/admin/TestManagement';
import { TestEditorModal } from './components/admin/TestEditorModal';
import { StudentList } from './components/admin/StudentList';
import { StudentPerformance } from './components/admin/StudentPerformance';
import { TestAnalytics } from './components/admin/TestAnalytics';

import { AdminSidebar } from './components/admin/AdminSidebar';
import { AdminSubjects } from './components/admin/AdminSubjects';
import { AdminQuestionBank } from './components/admin/AdminQuestionBank';
import { AdminScheduling } from './components/admin/AdminScheduling';
import { AdminAttempts } from './components/admin/AdminAttempts';
import { AdminRankLists } from './components/admin/AdminRankLists';
import { AdminReports } from './components/admin/AdminReports';
import { AdminAnnouncements } from './components/admin/AdminAnnouncements';
import { AdminPayments } from './components/admin/AdminPayments';
import { AdminAuditLogs } from './components/admin/AdminAuditLogs';
import { AdminSettings } from './components/admin/AdminSettings';

function AppContent() {
  const { isLoggedIn, isAdmin, isLoading } = useAuth();

  // Navigation view tab state
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['student-dashboard', 'test-list', 'student-subjects', 'student-question-bank'].includes(tab)) {
        return tab;
      }
    }
    return 'student-dashboard';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Sub-parameters
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  // Modal triggers
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isTestEditorOpen, setIsTestEditorOpen] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);

  // Track previous logged-in state to detect logout action
  const prevIsLoggedInRef = React.useRef(isLoggedIn);

  // Automatically adjust default view on auth status change (login / logout / admin shift)
  React.useEffect(() => {
    // If user was logged in and has now logged out, open the login page modal immediately
    if (prevIsLoggedInRef.current && !isLoggedIn) {
      setIsAuthOpen(true);
      if (currentTab.startsWith('admin-') || currentTab === 'exam' || currentTab === 'solution') {
        setCurrentTab('student-dashboard');
      }
      setActiveTestId(null);
      setActiveAttemptId(null);
      setActiveStudentId(null);
    } else if (!isLoggedIn) {
      if (currentTab.startsWith('admin-')) {
        setCurrentTab('student-dashboard');
      }
    } else if (isAdmin) {
      if (!currentTab.startsWith('admin-')) {
        setCurrentTab('admin-overview');
      }
    } else {
      if (currentTab.startsWith('admin-')) {
        setCurrentTab('student-dashboard');
      }
    }
    prevIsLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn, isAdmin]);

  // Listen for global auth open request (e.g. from expired session prompts)
  React.useEffect(() => {
    const handleOpenAuth = () => {
      setIsAuthOpen(true);
    };
    window.addEventListener('auth:open_modal', handleOpenAuth);
    return () => window.removeEventListener('auth:open_modal', handleOpenAuth);
  }, []);

  // Handlers for switching tabs
  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      if (['test-list', 'student-subjects', 'student-question-bank'].includes(tab)) {
        window.history.replaceState(null, '', `/?tab=${tab}`);
      } else if (tab === 'student-dashboard') {
        window.history.replaceState(null, '', '/');
      }
    }
  };

  // Student actions
  const handleStartExam = (testId: string) => {
    setActiveTestId(testId);
    setCurrentTab('exam');
  };

  const handleExamSubmitted = (attemptId: string) => {
    setActiveAttemptId(attemptId);
    setCurrentTab('solution');
  };

  const handleViewSolution = (attemptId: string) => {
    setActiveAttemptId(attemptId);
    setCurrentTab('solution');
  };

  // Admin actions
  const handleCreateNewTest = () => {
    setEditingTestId(null);
    setIsTestEditorOpen(true);
  };

  const handleEditTest = (testId: string) => {
    setEditingTestId(testId);
    setIsTestEditorOpen(true);
  };

  const handleViewTestAnalytics = (testId: string) => {
    setActiveTestId(testId);
    setCurrentTab('admin-test-analytics');
  };

  const handleViewStudentPerformance = (studentId: string) => {
    setActiveStudentId(studentId);
    setCurrentTab('admin-student-perf');
  };

  const isAdminTab = currentTab.startsWith('admin-');

  if (isLoading) {
    return (
      <div id="app-loading-screen" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-600">Initializing RGUKT Prep...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Dynamic SEO Metadata */}
      <SEOHead currentTab={currentTab} />

      {/* Header Bar */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenPaywall={() => setIsPaywallOpen(true)}
        onOpenAccountModal={() => setIsAccountOpen(true)}
      />

      {/* Main Container Layout */}
      {isAdminTab && isAdmin ? (
        <div className="flex-1 flex w-full relative">
          {/* Admin Sidebar */}
          <AdminSidebar
            currentTab={currentTab}
            onSelectTab={handleSelectTab}
            isOpenMobile={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          {/* Admin Main Content View Area */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 overflow-y-auto">
            {/* Mobile Sidebar Toggle Button */}
            <div className="lg:hidden mb-4 flex items-center justify-between bg-slate-900 text-white p-3 rounded-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Vinodh Sir Administration
              </span>
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg"
              >
                Menu ☰
              </button>
            </div>

            {currentTab === 'admin-overview' && (
              <AdminOverview
                onNavigateToManageTests={() => setCurrentTab('admin-tests')}
                onNavigateToStudents={() => setCurrentTab('admin-students')}
                onCreateNewTest={handleCreateNewTest}
              />
            )}

            {currentTab === 'admin-students' && (
              <StudentList onSelectStudent={handleViewStudentPerformance} />
            )}

            {currentTab === 'admin-subjects' && <AdminSubjects />}

            {currentTab === 'admin-question-bank' && <AdminQuestionBank />}

            {currentTab === 'admin-tests' && (
              <TestManagement
                onCreateTest={handleCreateNewTest}
                onEditTest={handleEditTest}
                onViewAnalytics={handleViewTestAnalytics}
              />
            )}

            {currentTab === 'admin-scheduling' && <AdminScheduling />}

            {currentTab === 'admin-attempts' && <AdminAttempts />}

            {currentTab === 'admin-rank-lists' && <AdminRankLists />}

            {currentTab === 'admin-reports' && <AdminReports />}

            {currentTab === 'admin-payments' && <AdminPayments />}

            {currentTab === 'admin-announcements' && <AdminAnnouncements />}

            {currentTab === 'admin-audit-logs' && <AdminAuditLogs />}

            {currentTab === 'admin-settings' && <AdminSettings />}

            {currentTab === 'admin-student-perf' && activeStudentId && (
              <StudentPerformance
                studentId={activeStudentId}
                onBack={() => setCurrentTab('admin-students')}
              />
            )}

            {currentTab === 'admin-test-analytics' && activeTestId && (
              <TestAnalytics
                testId={activeTestId}
                onBack={() => setCurrentTab('admin-tests')}
              />
            )}
          </main>
        </div>
      ) : (
        /* Student & Regular View Layout */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {currentTab === 'student-dashboard' && (
            <StudentDashboard
              onNavigateToTests={() => setCurrentTab('test-list')}
              onViewSolution={handleViewSolution}
              onOpenPaywall={() => setIsPaywallOpen(true)}
              onOpenAccountModal={() => setIsAccountOpen(true)}
            />
          )}

          {currentTab === 'test-list' && (
            <TestList
              onStartExam={handleStartExam}
              onOpenPaywall={() => setIsPaywallOpen(true)}
            />
          )}

          {currentTab === 'student-subjects' && (
            <StudentSubjects onStartTest={handleStartExam} />
          )}

          {currentTab === 'student-question-bank' && (
            <StudentQuestionBank onOpenPaywall={() => setIsPaywallOpen(true)} />
          )}

          {currentTab === 'exam' && activeTestId && (
            <ExamScreen
              testId={activeTestId}
              onExamSubmitted={handleExamSubmitted}
              onCancelExam={() => setCurrentTab('test-list')}
            />
          )}

          {currentTab === 'solution' && activeAttemptId && (
            <SolutionView
              attemptId={activeAttemptId}
              onBackToDashboard={() => setCurrentTab('student-dashboard')}
            />
          )}

          {isAdminTab && !isAdmin && (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 max-w-md mx-auto my-12 space-y-3">
              <p className="font-bold text-slate-800 text-sm">Admin Portal Access Restricted</p>
              <p className="text-xs text-slate-500">Please sign in with administrator credentials (admin@rgukt.ac.in) to access the administration suite.</p>
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                Sign In as Admin
              </button>
            </div>
          )}
        </main>
      )}

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
      />

      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onOpenPaywall={() => setIsPaywallOpen(true)}
      />

      <TestEditorModal
        isOpen={isTestEditorOpen}
        testId={editingTestId}
        onClose={() => {
          setIsTestEditorOpen(false);
          setEditingTestId(null);
        }}
        onSuccess={() => {
          setIsTestEditorOpen(false);
          setEditingTestId(null);
          window.dispatchEvent(new Event('testSeriesUpdated'));
        }}
      />
    </div>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
