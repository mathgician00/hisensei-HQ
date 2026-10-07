'use client';

import React from 'react';
import {
  Shield,
  UserCheck,
  GraduationCap,
  Sparkles,
  RefreshCw,
  Clock,
  Layers,
  Calendar,
  CreditCard,
  CheckCircle2,
  DollarSign,
  Database,
  BarChart3,
  AlertTriangle,
  LogOut,
} from 'lucide-react';

export type UserRole = 'master_admin' | 'admin' | 'teacher' | 'viewer';

interface NavbarProps {
  currentRole: UserRole;
  userEmail: string;
  userName?: string | null;
  onSignOut: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  exceptionsCount: number;
}

const ROLE_LABEL: Record<UserRole, string> = {
  master_admin: 'Master Admin',
  admin: 'Admin',
  teacher: 'Teacher',
  viewer: 'Viewer',
};

export const tabsForRole = (role: UserRole): string[] =>
  role === 'master_admin'
    ? ['dashboard', 'leads', 'students', 'classes', 'billing', 'sessions', 'payroll', 'master']
    : role === 'admin'
    ? ['dashboard', 'leads', 'students', 'classes', 'billing', 'sessions', 'payroll']
    : role === 'teacher'
    ? ['sessions', 'classes', 'payroll']
    : ['dashboard'];

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  userEmail,
  userName,
  onSignOut,
  activeTab,
  onTabChange,
  isRefreshing,
  onRefresh,
  exceptionsCount,
}) => {
  // Navigation tabs accessible based on role
  const adminTabs = [
    { id: 'dashboard', label: 'Overview & Radar', icon: BarChart3 },
    { id: 'leads', label: 'Admissions & Leads', icon: UserCheck },
    { id: 'students', label: 'Students & Credits', icon: GraduationCap },
    { id: 'classes', label: 'Classes & Timetable', icon: Calendar },
    { id: 'billing', label: 'Invoices & Billing', icon: CreditCard },
    { id: 'sessions', label: 'Sessions & Attendance', icon: CheckCircle2 },
    { id: 'payroll', label: 'Payroll Engine', icon: DollarSign },
    { id: 'master', label: 'Master Data & Pricing', icon: Database },
  ];

  const teacherTabs = [
    { id: 'sessions', label: 'My Timetable & Check-In', icon: CheckCircle2 },
    { id: 'classes', label: 'My Assigned Classes', icon: Calendar },
    { id: 'payroll', label: 'My Compensation', icon: DollarSign },
  ];

  const teacherTabsAll = teacherTabs;
  const byId = new Map([...adminTabs, ...teacherTabsAll].map((t) => [t.id, t]));
  const tabs = tabsForRole(currentRole).map((id) => {
    const base = byId.get(id)!;
    // Teachers see their own data under the teacher labels
    return currentRole === 'teacher' ? teacherTabsAll.find((t) => t.id === id) ?? base : base;
  });

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md">
      {/* Top Banner & Role Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  hisensei HQ
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  PRD v0.4
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center space-x-1.5">
                <Clock className="h-3 w-3" />
                <span>Asia/Makassar (GMT+8)</span>
              </p>
            </div>
          </div>

          {/* Right Controls: Role Switcher & Dev Badge */}
          <div className="flex items-center space-x-4">
            {/* Signed-in user (role is assigned by the server, not chosen here) */}
            <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
              <div className="text-right leading-tight">
                <div className="text-xs font-semibold text-white">{userName || userEmail}</div>
                <div className="text-[10px] text-cyan-400">{ROLE_LABEL[currentRole]}</div>
              </div>
              <button
                onClick={onSignOut}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
              title="Refresh Live Data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/80">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.id === 'dashboard' && exceptionsCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                    {exceptionsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
