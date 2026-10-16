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
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { WaterfallChart } from '@/components/WaterfallChart';

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
  const renewals = [...(reports?.renewals || [])].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  const waterfall = reports?.waterfall || [];
  const funnelCohort = reports?.funnelCohort || reports?.cohort || [];

  const criticalExceptionsCount = exceptions.filter((e) => e.severity === 'critical').length;

  return (
    <div className="space-y-8 text-slate-900">
      {/* 1. Header & Summary Bar */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <span>Executive BI & Academic Radar</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
            Live PostgreSQL Intelligence
          </span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Real-time institutional health monitoring: lead pipelines, student cohorts, active credit balances, exceptions, and revenue integrity.
        </p>
      </div>

      {/* 2. Top Metric KPI Cards (Clean Flat Light Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Pipeline Leads */}
        <div
          onClick={() => onNavigateTab('leads')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-all cursor-pointer group shadow-xs hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Leads in Pipeline</span>
            <span className="p-1.5 rounded-lg bg-[#65acff]/20 text-blue-900">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{leadsCount}</span>
            <span className="text-xs text-blue-700 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              CRM <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Active Enrolled Students */}
        <div
          onClick={() => onNavigateTab('students')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-all cursor-pointer group shadow-xs hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Enrolled Students</span>
            <span className="p-1.5 rounded-lg bg-[#6dd95d]/25 text-emerald-950">
              <CheckCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{studentsCount}</span>
            <span className="text-xs text-emerald-800 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Roster <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Invoices */}
        <div
          onClick={() => onNavigateTab('billing')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-all cursor-pointer group shadow-xs hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Invoices Generated</span>
            <span className="p-1.5 rounded-lg bg-[#c1a9e6]/25 text-purple-950">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{invoicesCount}</span>
            <span className="text-xs text-purple-800 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Billing <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Renewal Due Alerts */}
        <div
          onClick={() => onNavigateTab('billing')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-all cursor-pointer group shadow-xs hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Renewals Due</span>
            <span className="p-1.5 rounded-lg bg-[#fdb01b]/25 text-amber-950">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-700">{renewals.length}</span>
            <span className="text-xs text-amber-800 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Action <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Operational Exceptions */}
        <div
          className={`bg-white border rounded-xl p-4 transition-all cursor-pointer group shadow-xs hover:shadow-sm ${
            criticalExceptionsCount > 0
              ? 'border-[#f77f73]/50 hover:border-[#f77f73]'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Exceptions Radar</span>
            <span
              className={`p-1.5 rounded-lg ${
                criticalExceptionsCount > 0 ? 'bg-[#f77f73]/20 text-rose-900' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold ${
                criticalExceptionsCount > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {exceptions.length}
            </span>
            <span className="text-xs text-slate-500">
              {criticalExceptionsCount} critical
            </span>
          </div>
        </div>
      </div>

      {/* 3. The Single-Month Interactive Waterfall Chart */}
      <section>
        <WaterfallChart
          waterfallData={waterfall}
          onSelectStudent={() => {
            onNavigateTab('students');
          }}
        />
      </section>

      {/* 4. Action Radars: Exceptions & Renewal Due */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exception Alerts Radar */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">Exception Alerts Radar</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">v_exceptions</span>
            </div>

            {exceptions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
                <span>Zero exceptions detected across all academic and billing operations.</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {exceptions.map((exc: any, idx: number) => {
                  const kind = exc.kind || exc.category || 'alert';
                  const ref = exc.ref || exc.entity_code || '';
                  const detail = exc.detail || exc.details || '';
                  const isCritical = kind === 'no_checkin' || kind === 'negative_balance' || exc.severity === 'critical';
                  const isWarning = kind === 'paid_no_slots' || kind === 'no_pay_rate' || exc.severity === 'warning';

                  const formatKindLabel = (k: string) => {
                    switch (k) {
                      case 'no_checkin': return 'Check-in Overdue';
                      case 'no_pay_rate': return 'Missing Pay Rate';
                      case 'paid_no_slots': return 'Paid Without Slots';
                      case 'negative_balance': return 'Negative Balance';
                      default: return k.replace(/_/g, ' ');
                    }
                  };

                  const handleNavigate = () => {
                    const k = String(kind).toLowerCase();
                    const r = String(ref).toLowerCase();
                    if (k.includes('session') || k.includes('checkin') || r.startsWith('ses-')) {
                      onNavigateTab('sessions');
                    } else if (k.includes('invoice') || k.includes('paid') || k.includes('slot') || r.startsWith('inv-')) {
                      onNavigateTab('billing');
                    } else if (k.includes('rate') || k.includes('pay')) {
                      onNavigateTab('master');
                    } else {
                      onNavigateTab('students');
                    }
                  };

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 flex items-start justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                              isCritical
                                ? 'bg-[#f77f73]/20 text-rose-950 border border-[#f77f73]/40'
                                : isWarning
                                ? 'bg-[#fdb01b]/20 text-amber-950 border border-[#fdb01b]/40'
                                : 'bg-[#65acff]/20 text-blue-950 border border-[#65acff]/40'
                            }`}
                          >
                            {formatKindLabel(kind)}
                          </span>
                          {ref && (
                            <span className="text-slate-600 font-mono font-bold">{ref}</span>
                          )}
                        </div>
                        <p className="text-slate-700 font-medium">{detail}</p>
                      </div>

                      <button
                        onClick={handleNavigate}
                        className="text-slate-400 hover:text-slate-800 p-1 rounded hover:bg-slate-200/60 shrink-0 cursor-pointer"
                        title="Inspect record"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Renewal Due Radar */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">Renewal Due Radar</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">v_renewal_due</span>
            </div>

            {renewals.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
                <span>All active students hold sufficient session balance (&gt; 1 credit).</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {renewals.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 flex items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{r.name}</span>
                        <span className="text-slate-500 font-mono text-[11px]">{r.student_code}</span>
                      </div>
                      <div className="text-slate-600 text-[11px] mt-0.5">
                        Purchased: {r.purchased} | Consumed: {r.consumed} |{' '}
                        <span className="text-amber-800 font-bold">Remaining: {r.balance}</span>
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
                      className="px-3 py-1.5 rounded-lg bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 font-bold text-xs flex items-center gap-1 shrink-0 transition-colors"
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
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">Funnel Conversion by Cohort Month</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">v_funnel_cohort</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200 font-bold">
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
              <tbody className="divide-y divide-slate-100 font-mono">
                {funnelCohort.map((row: any, i: number) => {
                  const total = Number(row.total_leads) || 0;
                  const conv = Number(row.converted) || 0;
                  const pct = total > 0 ? ((conv / total) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                        {typeof row.cohort_month === 'string' ? row.cohort_month.slice(0, 7) : row.cohort_month}
                      </td>
                      <td className="py-2.5 px-3">{row.total_leads}</td>
                      <td className="py-2.5 px-3">{row.trial_attended || 0}</td>
                      <td className="py-2.5 px-3">{row.offer_made || 0}</td>
                      <td className="py-2.5 px-3 text-emerald-800 font-bold">{row.converted || 0}</td>
                      <td className="py-2.5 px-3 text-rose-700">{row.lost || 0}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-[#6dd95d]/20 text-emerald-950 font-sans font-bold">
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
