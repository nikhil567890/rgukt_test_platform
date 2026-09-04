import React from 'react';
import {
  LayoutGrid,
  Users,
  BookOpen,
  HelpCircle,
  FileEdit,
  Clock,
  ClipboardCheck,
  Award,
  BarChart3,
  Bell,
  ShieldCheck,
  CreditCard,
  Settings,
  ChevronRight,
  X,
} from 'lucide-react';

export interface AdminSidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const ADMIN_NAV_ITEMS = [
  { id: 'admin-overview', label: 'Overview', icon: LayoutGrid },
  { id: 'admin-students', label: 'Students', icon: Users },
  { id: 'admin-subjects', label: 'Subjects & topics', icon: BookOpen },
  { id: 'admin-question-bank', label: 'Question bank', icon: HelpCircle },
  { id: 'admin-tests', label: 'Test builder', icon: FileEdit },
  { id: 'admin-scheduling', label: 'Scheduling', icon: Clock },
  { id: 'admin-attempts', label: 'Attempts & results', icon: ClipboardCheck },
  { id: 'admin-rank-lists', label: 'Rank lists', icon: Award },
  { id: 'admin-reports', label: 'Reports', icon: BarChart3 },
  { id: 'admin-payments', label: 'Payments & Revenue', icon: CreditCard },
  { id: 'admin-announcements', label: 'Announcements', icon: Bell },
  { id: 'admin-audit-logs', label: 'Audit logs', icon: ShieldCheck },
  { id: 'admin-settings', label: 'Settings', icon: Settings },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-[#0B192C] text-slate-300 flex flex-col z-50 transition-transform duration-300 ease-in-out border-r border-slate-800 shadow-2xl shrink-0 overflow-y-auto ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header Section */}
        <div className="p-5 border-b border-slate-800/80 relative">
          {/* Mobile close button */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center space-x-3.5">
            {/* Vinodh Sir Avatar Badge */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-indigo-950/50 border-b-2 border-amber-500 shrink-0">
              V
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight leading-snug">
                Vinodh Sir
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mt-0.5">
                ADMINISTRATION
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 px-3 py-4 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            MANAGEMENT
          </div>

          <nav className="space-y-1 mt-1">
            {ADMIN_NAV_ITEMS.map((item) => {
              const IconComponent = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`admin-nav-${item.id}`}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group cursor-pointer ${
                    isActive
                      ? 'bg-slate-800/90 text-white shadow-sm border-l-4 border-amber-500 pl-3'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <IconComponent
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform ${
                      isActive ? 'text-amber-400 translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400'
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Admin Info */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-300">RGUKT Admin v2.4</span>
          </div>
          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
            Online
          </span>
        </div>
      </aside>
    </>
  );
};
