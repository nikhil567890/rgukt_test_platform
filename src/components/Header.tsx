import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  Sparkles,
  Flame,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  Award,
  BookOpen,
  Users,
  BarChart3,
  Lock,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenPaywall: () => void;
  onOpenAccountModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
  onOpenPaywall,
  onOpenAccountModal,
}) => {
  const { user, isLoggedIn, isAdmin, isPremium, logout } = useAuth();

  return (
    <header id="main-header" className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand Logo */}
          <div
            id="brand-logo"
            onClick={() => onSelectTab(isAdmin ? 'admin-overview' : 'student-dashboard')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs group-hover:bg-indigo-700 transition-colors">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-base font-bold tracking-tight text-slate-900">RGUKT</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Prep
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-none">Entrance Exam Test Series</p>
            </div>
          </div>

          {/* Navigation Links for Authenticated Users */}
          {isLoggedIn && (
            <nav id="main-navigation" className="hidden md:flex items-center space-x-1">
              {!isAdmin ? (
                <>
                  <button
                    id="nav-student-dashboard"
                    onClick={() => onSelectTab('student-dashboard')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      currentTab === 'student-dashboard'
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    <span>My Dashboard</span>
                  </button>

                  <button
                    id="nav-tests"
                    onClick={() => onSelectTab('test-list')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      currentTab === 'test-list'
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Test Papers</span>
                    {!isPremium && <Lock className="w-3 h-3 text-amber-500 ml-0.5" />}
                  </button>

                  <button
                    id="nav-student-subjects"
                    onClick={() => onSelectTab('student-subjects')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      currentTab === 'student-subjects'
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Subjects & Topics</span>
                  </button>

                  <button
                    id="nav-student-question-bank"
                    onClick={() => onSelectTab('student-question-bank')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      currentTab === 'student-question-bank'
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Question Bank</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    id="nav-admin-overview"
                    onClick={() => onSelectTab('admin-overview')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      currentTab === 'admin-overview'
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Overview</span>
                  </button>

                  <button
                    id="nav-admin-tests"
                    onClick={() => onSelectTab('admin-tests')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      currentTab === 'admin-tests'
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Manage Tests</span>
                  </button>

                  <button
                    id="nav-admin-students"
                    onClick={() => onSelectTab('admin-students')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      currentTab === 'admin-students'
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Students</span>
                  </button>
                </>
              )}
            </nav>
          )}

          {/* Right Action Bar */}
          <div id="header-right-actions" className="flex items-center space-x-2.5">
            {isLoggedIn && user ? (
              <div className="flex items-center space-x-2.5">
                {/* Streak Badge for Students */}
                {!isAdmin && (
                  <div
                    id="header-streak-badge"
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold shadow-2xs"
                    title="Consecutive daily test attempts"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>{user.currentStreak} Day Streak</span>
                  </div>
                )}

                {/* Role / Premium Status Badge */}
                {isAdmin ? (
                  <span
                    id="badge-admin"
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </span>
                ) : isPremium ? (
                  <span
                    id="badge-premium"
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Premium Member</span>
                  </span>
                ) : (
                  <button
                    id="btn-upgrade-header"
                    onClick={onOpenPaywall}
                    className="flex items-center space-x-1 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Unlock Premium (₹3000)</span>
                  </button>
                )}

                {/* User Menu / Account Details / Logout */}
                <button
                  id="user-info-pill"
                  onClick={onOpenAccountModal}
                  title="View Account, Subscription & Payment Details"
                  className="hidden sm:flex items-center space-x-2 pl-2 border-l border-slate-200 hover:opacity-80 transition-opacity cursor-pointer group text-left"
                >
                  <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-semibold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{user?.name || 'User'}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">Account & Subscriptions</p>
                  </div>
                </button>

                <button
                  id="btn-logout"
                  onClick={() => {
                    logout();
                    onOpenAuth();
                  }}
                  title="Log Out"
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  id="btn-login-trigger"
                  onClick={onOpenAuth}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Sign In / Register
                </button>
                <button
                  id="btn-paywall-trigger"
                  onClick={onOpenPaywall}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Get Premium Access</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
