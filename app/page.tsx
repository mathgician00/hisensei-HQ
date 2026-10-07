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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-indigo-500/20 animate-pulse">
          <Shield className="h-7 w-7 text-white" />
        </div>
        <div className="flex items-center space-x-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          <span>Loading…</span>
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Could not load data</h2>
          <p className="text-xs text-slate-400">{errorMessage}</p>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center justify-center space-x-2 mx-auto"
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
  );
}
