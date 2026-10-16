'use client';

import React, { useState } from 'react';
import {
  Shield,
  UserCheck,
  GraduationCap,
  Calendar,
  CreditCard,
  CheckCircle2,
  DollarSign,
  Database,
  BarChart3,
  LogOut,
  RefreshCw,
  Clock,
  Menu,
  X,
  BookOpen,
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
    ? ['dashboard', 'timetable', 'leads', 'students', 'classes', 'billing', 'sessions', 'payroll', 'master']
    : role === 'admin'
    ? ['dashboard', 'timetable', 'leads', 'students', 'classes', 'billing', 'sessions', 'payroll']
    : role === 'teacher'
    ? ['timetable', 'sessions', 'classes', 'payroll']
    : ['dashboard', 'timetable'];

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const adminTabs = [
    { id: 'dashboard', label: 'Overview & Radar', icon: BarChart3 },
    { id: 'timetable', label: 'Weekly Timetable', icon: Calendar },
    { id: 'leads', label: 'Admissions & Leads', icon: UserCheck },
    { id: 'students', label: 'Students & Credits', icon: GraduationCap },
    { id: 'classes', label: 'Classes & Courses', icon: BookOpen },
    { id: 'billing', label: 'Invoices & Billing', icon: CreditCard },
    { id: 'sessions', label: 'Sessions & Attendance', icon: CheckCircle2 },
    { id: 'payroll', label: 'Payroll Engine', icon: DollarSign },
    { id: 'master', label: 'Master Data & Pricing', icon: Database },
  ];

  const teacherTabs = [
    { id: 'timetable', label: 'My Timetable', icon: Calendar },
    { id: 'sessions', label: 'Attendance & Check-In', icon: CheckCircle2 },
    { id: 'classes', label: 'My Assigned Classes', icon: BookOpen },
    { id: 'payroll', label: 'My Compensation', icon: DollarSign },
  ];

  const byId = new Map([...adminTabs, ...teacherTabs].map((t) => [t.id, t]));
  const tabs = tabsForRole(currentRole).map((id) => {
    const base = byId.get(id)!;
    return currentRole === 'teacher' ? teacherTabs.find((t) => t.id === id) ?? base : base;
  });

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#6dd95d] flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-slate-900" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-slate-900">hisensei HQ</div>
            <div className="text-[10px] text-slate-500">{ROLE_LABEL[currentRole]}</div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#6dd95d]' : ''}`} />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Navigation</div>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-[#6dd95d] text-slate-950 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </div>
                    {tab.id === 'dashboard' && exceptionsCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#fdb01b] text-slate-950 rounded-full">
                        {exceptionsCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="truncate mr-2 font-medium">{userName || userEmail}</div>
              <button
                onClick={onSignOut}
                className="px-3 py-1.5 text-xs text-[#f77f73] font-semibold hover:bg-red-50 rounded-lg flex items-center space-x-1"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Left Sidebar: Auto-collapsed, expands smoothly on hover */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden md:flex fixed top-0 left-0 bottom-0 z-40 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex-col justify-between ${
          isHovered ? 'w-64 shadow-xl' : 'w-16 shadow-xs'
        }`}
      >
        {/* Top: Brand Header */}
        <div className="p-3 border-b border-slate-100 flex items-center space-x-3 overflow-hidden h-16 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-[#6dd95d] flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-slate-950" />
          </div>

          <div
            className={`transition-opacity duration-200 whitespace-nowrap overflow-hidden ${
              isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-slate-900">hisensei HQ</span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-slate-100 text-slate-700 rounded-sm">
                v0.4
              </span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center space-x-1">
              <Clock className="h-2.5 w-2.5" />
              <span>GMT+8 Makassar</span>
            </div>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <div className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={!isHovered ? tab.label : undefined}
                className={`w-full flex items-center h-10 px-2.5 rounded-xl text-xs font-semibold transition-all relative ${
                  isActive
                    ? 'bg-[#6dd95d] text-slate-950 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <div className="h-5 w-5 flex items-center justify-center shrink-0">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                </div>

                <span
                  className={`ml-3 whitespace-nowrap transition-opacity duration-200 overflow-hidden ${
                    isHovered ? 'opacity-100' : 'opacity-0 w-0'
                  }`}
                >
                  {tab.label}
                </span>

                {tab.id === 'dashboard' && exceptionsCount > 0 && (
                  <span
                    className={`ml-auto px-1.5 py-0.2 text-[10px] font-bold rounded-full transition-opacity duration-200 ${
                      isActive ? 'bg-slate-950 text-white' : 'bg-[#fdb01b] text-slate-950'
                    } ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {exceptionsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom: User, Refresh & Logout */}
        <div className="p-2 border-t border-slate-100 bg-slate-50/50 space-y-2 shrink-0 overflow-hidden">
          {/* User Info */}
          <div className="flex items-center space-x-2.5 px-1 py-1">
            <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
              {(userName || userEmail || 'U').charAt(0).toUpperCase()}
            </div>
            <div
              className={`transition-opacity duration-200 overflow-hidden whitespace-nowrap ${
                isHovered ? 'opacity-100' : 'opacity-0 w-0'
              }`}
            >
              <div className="text-xs font-semibold text-slate-900 truncate max-w-[130px]">
                {userName || userEmail}
              </div>
              <div className="text-[10px] font-medium text-slate-500">{ROLE_LABEL[currentRole]}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1 pt-1">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`h-8 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 transition flex items-center justify-center ${
                isHovered ? 'flex-1 space-x-1.5 px-2' : 'w-full'
              }`}
              title="Refresh Live Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isRefreshing ? 'animate-spin text-[#6dd95d]' : ''}`} />
              {isHovered && <span className="text-[11px] font-medium">Sync</span>}
            </button>

            {isHovered && (
              <button
                onClick={onSignOut}
                className="h-8 px-2 rounded-lg text-[#f77f73] hover:bg-red-50 transition flex items-center space-x-1 shrink-0"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">Exit</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
