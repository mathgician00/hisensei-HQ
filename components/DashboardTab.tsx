'use client';

import React from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Flame,
  CreditCard,
  DollarSign,
  ChevronRight,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { WaterfallChart } from '@/components/WaterfallChart';
import { formatRupiah } from '@/lib/formatters';

interface ExceptionItem {
  category: string;
  severity: 'critical' | 'warning' | 'notice';
  entity_id: string;
  entity_code?: string;
  details: string;
  detected_at?: string;
}

interface RenewalItem {
  enrollment_id: string;
  student_id: string;
  student_code: string;
  name: string;
  purchased: number;
  consumed: number;
  balance: number;
}

interface DashboardReports {
  waterfall?: any[];
  cohort?: any[];
  renewals?: RenewalItem[];
  exceptions?: ExceptionItem[];
  funnelPeriod?: any[];
  funnelCohort?: any[];
  teacherMonth?: any[];
}

interface DashboardTabProps {
  reports?: DashboardReports;
  leadsCount: number;
  studentsCount: number;
  invoicesCount: number;
  onNavigateTab: (tab: string) => void;
  onSelectStudentForInvoice?: (studentId: string, enrollmentId: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  reports,
  leadsCount,
  studentsCount,
  invoicesCount,
  onNavigateTab,
  onSelectStudentForInvoice,
}) => {
  const exceptions = reports?.exceptions || [];
  const renewals = reports?.renewals || [];
  const waterfall = reports?.waterfall || [];
  const funnelCohort = reports?.funnelCohort || [];

  const criticalExceptionsCount = exceptions.filter((e) => e.severity === 'critical').length;
  const warningsCount = exceptions.filter((e) => e.severity === 'warning').length;

  return (
    <div className="space-y-8">
      {/* 1. Header & Summary Bar */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          <span>Executive BI & Academic Radar</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
            Live Database Analytics
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Real-time institutional health monitoring: lead pipelines, student cohorts, active credit balances, exceptions, and revenue integrity.
        </p>
      </div>

      {/* 2. Top Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Pipeline Leads */}
        <div
          onClick={() => onNavigateTab('leads')}
          className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 transition-all cursor-pointer group shadow-sm hover:shadow-indigo-500/5"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Leads in Pipeline</span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-100">{leadsCount}</span>
            <span className="text-xs text-indigo-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              CRM <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Active Enrolled Students */}
        <div
          onClick={() => onNavigateTab('students')}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 transition-all cursor-pointer group shadow-sm hover:shadow-emerald-500/5"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Enrolled Students</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
              <CheckCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-100">{studentsCount}</span>
            <span className="text-xs text-emerald-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Roster <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Invoices */}
        <div
          onClick={() => onNavigateTab('billing')}
          className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-all cursor-pointer group shadow-sm hover:shadow-cyan-500/5"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Invoices Generated</span>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-100">{invoicesCount}</span>
            <span className="text-xs text-cyan-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Billing <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Renewal Due Alerts */}
        <div
          onClick={() => onNavigateTab('billing')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-4 transition-all cursor-pointer group shadow-sm hover:shadow-amber-500/5"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Renewals Due</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{renewals.length}</span>
            <span className="text-xs text-amber-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Action <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Operational Exceptions */}
        <div
          className={`bg-slate-900 border rounded-xl p-4 transition-all cursor-pointer group shadow-sm ${
            criticalExceptionsCount > 0
              ? 'border-rose-500/40 hover:border-rose-500'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Exceptions Radar</span>
            <span
              className={`p-1.5 rounded-lg ${
                criticalExceptionsCount > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold ${
                criticalExceptionsCount > 0 ? 'text-rose-400' : 'text-slate-100'
              }`}
            >
              {exceptions.length}
            </span>
            <span className="text-xs text-slate-400">
              {criticalExceptionsCount} critical
            </span>
          </div>
        </div>
      </div>

      {/* 3. The Single-Month Interactive Waterfall Chart */}
      <section>
        <WaterfallChart
          waterfallData={waterfall}
          onSelectStudent={(studentId) => {
            onNavigateTab('students');
          }}
        />
      </section>

      {/* 4. Action Radars: Exceptions & Renewal Due */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exception Alerts Radar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-semibold text-slate-200">Exception Alerts Radar</h3>
              </div>
              <span className="text-xs text-slate-400">View v_exceptions</span>
            </div>

            {exceptions.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-400/80" />
                <span>Zero exceptions detected across all academic and billing operations.</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {exceptions.map((exc, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-start justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-medium text-[10px] ${
                            exc.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : exc.severity === 'warning'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {exc.category}
                        </span>
                        {exc.entity_code && (
                          <span className="text-slate-400 font-mono">{exc.entity_code}</span>
                        )}
                      </div>
                      <p className="text-slate-300 font-normal">{exc.details}</p>
                    </div>

                    <button
                      onClick={() => {
                        if (exc.category.includes('session') || exc.category.includes('attendance')) {
                          onNavigateTab('sessions');
                        } else if (exc.category.includes('invoice') || exc.category.includes('billing')) {
                          onNavigateTab('billing');
                        } else {
                          onNavigateTab('students');
                        }
                      }}
                      className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 shrink-0"
                      title="Inspect record"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Renewal Due Radar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-semibold text-slate-200">Renewal Due Radar</h3>
              </div>
              <span className="text-xs text-slate-400">Balance &le; threshold</span>
            </div>

            {renewals.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-400/80" />
                <span>All active students hold sufficient session balance (&gt; 1 credit).</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {renewals.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{r.name}</span>
                        <span className="text-slate-400 font-mono text-[11px]">{r.student_code}</span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        Purchased: {r.purchased} | Consumed: {r.consumed} |{' '}
                        <span className="text-amber-400 font-bold">Remaining: {r.balance}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (onSelectStudentForInvoice) {
                          onSelectStudentForInvoice(r.student_id, r.enrollment_id);
                        } else {
                          onNavigateTab('billing');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1 shrink-0 transition-colors shadow-sm"
                    >
                      <span>Invoice</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Funnel Cohort Analytics */}
      {funnelCohort && funnelCohort.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-semibold text-slate-200">Funnel Conversion by Cohort Month</h3>
            </div>
            <span className="text-xs text-slate-400">View v_funnel_cohort</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Cohort Month</th>
                  <th className="py-2.5 px-3">Total Leads</th>
                  <th className="py-2.5 px-3">Trials Attended</th>
                  <th className="py-2.5 px-3">Offers Made</th>
                  <th className="py-2.5 px-3">Converted</th>
                  <th className="py-2.5 px-3">Lost</th>
                  <th className="py-2.5 px-3">Conv %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {funnelCohort.map((row: any, i: number) => {
                  const total = Number(row.total_leads) || 0;
                  const conv = Number(row.converted) || 0;
                  const pct = total > 0 ? ((conv / total) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                        {typeof row.cohort_month === 'string' ? row.cohort_month.slice(0, 7) : row.cohort_month}
                      </td>
                      <td className="py-2.5 px-3">{row.total_leads}</td>
                      <td className="py-2.5 px-3">{row.trial_attended || 0}</td>
                      <td className="py-2.5 px-3">{row.offer_made || 0}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-semibold">{row.converted || 0}</td>
                      <td className="py-2.5 px-3 text-rose-400">{row.lost || 0}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-sans font-semibold">
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
