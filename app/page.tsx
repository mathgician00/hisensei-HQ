'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';
import { Navbar, UserRole, tabsForRole } from '@/components/Navbar';
import { LoginGate } from '@/components/LoginGate';
import { DashboardTab } from '@/components/DashboardTab';
import { LeadsTab } from '@/components/LeadsTab';
import { StudentsTab } from '@/components/StudentsTab';
import { ClassesTab } from '@/components/ClassesTab';
import { BillingTab } from '@/components/BillingTab';
import { SessionsTab } from '@/components/SessionsTab';
import { WeeklyTimetableMatrix } from '@/components/WeeklyTimetableMatrix';
import { PayrollTab } from '@/components/PayrollTab';
import { MasterDataTab } from '@/components/MasterDataTab';
import { Loader2, AlertCircle, Shield, RefreshCw } from 'lucide-react';

interface Me {
  email: string;
  name: string | null;
  role: UserRole;
  teacher_id: string | null;
}

export default function Home() {
  const [authState, setAuthState] = useState<'loading' | 'signed_out' | 'denied' | 'ready'>('loading');
  const [authMessage, setAuthMessage] = useState('');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [preselectedEnrollmentId, setPreselectedEnrollmentId] = useState<string>('');

  // 1) Firebase session -> 2) server resolves the role (deny by default)
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setMe(null);
      setData(null);
      if (!user) {
        setAuthState('signed_out');
        return;
      }
      setAuthState('loading');
      try {
        const res = await apiFetch('/api/data?type=me');
        const json = await res.json();
        if (!res.ok) {
          setAuthMessage(json.error || 'Access denied');
          setAuthState('denied');
          return;
        }
        setMe(json);
        setActiveTab(tabsForRole(json.role)[0]);
        setAuthState('ready');
      } catch (e: any) {
        setAuthMessage(e.message || 'Could not reach the server');
        setAuthState('denied');
      }
    });
  }, []);

  const loadData = useCallback(async (background = false) => {
    if (background) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await apiFetch('/api/data?type=all');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load system data');
      setData(json);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error connecting to database');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authState === 'ready') loadData();
  }, [authState, loadData]);

  const handleSignIn = async () => {
    setAuthMessage('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      setAuthMessage(e.message || 'Sign-in failed');
    }
  };
  const handleSignOut = () => signOut(auth);

  if (authState === 'loading' || (authState === 'ready' && isLoading && !data)) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-slate-900 space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-[#6dd95d] flex items-center justify-center">
          <Shield className="h-7 w-7 text-slate-900" />
        </div>
        <div className="flex items-center space-x-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-[#6dd95d]" />
          <span>Loading system…</span>
        </div>
      </div>
    );
  }

  if (authState === 'signed_out') {
    return <LoginGate mode="signed_out" message={authMessage} onSignIn={handleSignIn} onSignOut={handleSignOut} />;
  }
  if (authState === 'denied') {
    return <LoginGate mode="denied" message={authMessage} email={firebaseUser?.email ?? undefined} onSignIn={handleSignIn} onSignOut={handleSignOut} />;
  }

  if (errorMessage && !data) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="max-w-md w-full bg-white border border-[#f77f73]/40 rounded-2xl p-6 shadow-sm text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full bg-[#f77f73]/10 text-[#f77f73] flex items-center justify-center border border-[#f77f73]/20">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Could not load data</h2>
          <p className="text-xs text-slate-600">{errorMessage}</p>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-900 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (!me || !data) return null;

  const role = me.role;
  const allowedTabs = tabsForRole(role);
  const tab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];
  const exceptionsCount = data.reports?.exceptions?.length || 0;
  const goInvoice = (_studentId: string, enrollmentId: string) => {
    setPreselectedEnrollmentId(enrollmentId);
    setActiveTab('billing');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col md:flex-row">
      <Navbar
        currentRole={role}
        userEmail={me.email}
        userName={me.name}
        onSignOut={handleSignOut}
        activeTab={tab}
        onTabChange={setActiveTab}
        isRefreshing={isRefreshing}
        onRefresh={() => loadData(true)}
        exceptionsCount={exceptionsCount}
      />

      <div className="flex-1 md:pl-16 min-w-0 transition-all">
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {tab === 'dashboard' && (
          <DashboardTab
            reports={data.reports}
            leadsCount={data.counts?.leads ?? data.leads?.length ?? 0}
            studentsCount={data.counts?.students ?? data.students?.length ?? 0}
            invoicesCount={data.counts?.invoices ?? data.invoices?.length ?? 0}
            onNavigateTab={setActiveTab}
            onSelectStudentForInvoice={goInvoice}
          />
        )}

        {tab === 'timetable' && (
          <WeeklyTimetableMatrix
            sessions={data.sessions || []}
            currentRole={role}
            selectedTeacherId={me.teacher_id || ''}
            masterData={data.master}
            onRefresh={() => loadData(true)}
          />
        )}

        {tab === 'leads' && (
          <LeadsTab leads={data.leads || []} masterData={data.master} onRefresh={() => loadData(true)} onNavigateTab={setActiveTab} />
        )}

        {tab === 'students' && (
          <StudentsTab students={data.students || []} onRefresh={() => loadData(true)} onNavigateTab={setActiveTab} onSelectStudentForInvoice={goInvoice} />
        )}

        {tab === 'classes' && (
          <ClassesTab
            classes={data.classes || []}
            students={data.students || []}
            masterData={data.master}
            onRefresh={() => loadData(true)}
            onNavigateTab={setActiveTab}
            readOnly={role === 'teacher'}
            sessions={data.sessions || []}
          />
        )}

        {tab === 'billing' && (
          <BillingTab
            invoices={data.invoices || []}
            students={data.students || []}
            masterData={data.master}
            onRefresh={() => loadData(true)}
            preselectedEnrollmentId={preselectedEnrollmentId}
          />
        )}

        {tab === 'sessions' && (
          <SessionsTab
            sessions={data.sessions || []}
            currentRole={role}
            selectedTeacherId={me.teacher_id || ''}
            masterData={data.master}
            onRefresh={() => loadData(true)}
          />
        )}

        {tab === 'payroll' && (
          <PayrollTab currentRole={role} selectedTeacherId={me.teacher_id || ''} onRefresh={() => loadData(true)} />
        )}

        {tab === 'master' && role === 'master_admin' && <MasterDataTab masterData={data.master} currentEmail={me.email} />}
      </main>
      </div>
    </div>
  );
}
