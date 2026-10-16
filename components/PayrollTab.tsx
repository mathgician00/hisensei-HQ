'use client';

import React, { useState, useEffect } from 'react';
import type { UserRole } from '@/components/Navbar';
import { apiFetch } from '@/lib/api';
import {
  DollarSign,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { formatRupiah, formatDateOnly, previousMonthRangeWita } from '@/lib/formatters';
import { SortHeader } from './SortHeader';

interface PayrollTabProps {
  currentRole: UserRole;
  selectedTeacherId?: string;
  onRefresh: () => void;
}

export const PayrollTab: React.FC<PayrollTabProps> = ({
  currentRole,
  selectedTeacherId,
  onRefresh,
}) => {
  const [periodStart, setPeriodStart] = useState(() => previousMonthRangeWita().start);
  const [periodEnd, setPeriodEnd] = useState(() => previousMonthRangeWita().end);
  const [previewData, setPreviewData] = useState<{ items: any[]; summary: any[] }>({
    items: [],
    summary: [],
  });
  const [runs, setRuns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchPayroll = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await apiFetch(`/api/data?type=payroll&start=${periodStart}&end=${periodEnd}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewData(data.preview);
      setRuns(data.runs);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const res = await apiFetch(`/api/data?type=payroll&start=${periodStart}&end=${periodEnd}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!ignore) {
          setPreviewData(data.preview);
          setRuns(data.runs);
        }
      } catch (err: any) {
        if (!ignore) {
          setErrorMessage(err.message);
        }
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [periodStart, periodEnd]);

  const handleLockPayroll = async () => {
    if (
      !confirm(
        `Are you sure you want to lock payroll for period ${periodStart} to ${periodEnd}? This permanently freezes sessions and attendance records!`
      )
    ) {
      return;
    }

    setIsLocking(true);
    setErrorMessage('');
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lock_payroll',
          payload: {
            start: periodStart,
            end: periodEnd,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Payroll successfully locked! Run ID: ${data.run_id}`);
      fetchPayroll();
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLocking(false);
    }
  };

  // Sort State - Default is teacher name ASC
  const [sortField, setSortField] = useState<string>('teacher_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      if (['total_amount', 'sessions_conducted', 'trials_attended'].includes(field)) {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  // If teacher role, filter preview to only the selected teacher
  const baseSummary =
    currentRole === 'teacher' && selectedTeacherId
      ? previewData.summary.filter((s) => s.teacher_id === selectedTeacherId)
      : previewData.summary;

  const filteredSummary = [...baseSummary].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'teacher_name':
        comparison = (a.teacher_name || '').localeCompare(b.teacher_name || '', undefined, { sensitivity: 'base' });
        break;
      case 'sessions_conducted':
        comparison = (parseInt(a.sessions_conducted) || 0) - (parseInt(b.sessions_conducted) || 0);
        break;
      case 'trials_attended':
        comparison = (parseInt(a.trials_attended) || 0) - (parseInt(b.trials_attended) || 0);
        break;
      case 'total_amount':
        comparison = (parseInt(a.total_amount) || 0) - (parseInt(b.total_amount) || 0);
        break;
      default:
        comparison = (a.teacher_name || '').localeCompare(b.teacher_name || '', undefined, { sensitivity: 'base' });
    }

    if (comparison !== 0) {
      return sortDirection === 'asc' ? comparison : -comparison;
    }
    return (a.teacher_name || '').localeCompare(b.teacher_name || '', undefined, { sensitivity: 'base' });
  });

  const totalPayable = filteredSummary.reduce(
    (acc, curr) => acc + (parseInt(curr.total_amount) || 0),
    0
  );

  return (
    <div className="space-y-6 pb-12 text-slate-900">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <span>Teacher Compensation & Payroll Engine</span>
            <span className="px-2 py-0.5 text-xs bg-[#6dd95d]/20 text-emerald-950 border border-[#6dd95d]/40 rounded-full font-mono font-bold">
              Append-Only Immutability
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Prorated calculation for held sessions (with ≥1 consuming attendee) and attended trials.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          <Calendar className="h-4 w-4 text-slate-400 ml-1.5" />
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="bg-transparent text-xs text-slate-800 focus:outline-none"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="bg-transparent text-xs text-slate-800 focus:outline-none mr-1.5"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-[#f77f73]/15 border border-[#f77f73]/30 text-rose-900 text-xs rounded-xl flex items-center space-x-2 font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Summary KPI & Action */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Payable in Period
          </span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 font-mono">
            {formatRupiah(totalPayable)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            For {filteredSummary.length} teachers
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Locked Past Payroll Runs
          </span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 font-mono">
            {runs.length} Runs
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Historical records frozen & audited
          </div>
        </div>

        {(currentRole === 'admin' || currentRole === 'master_admin') && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Lock Period Execution
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Finalizes period payout and locks all sessions/attendances via database trigger.
              </p>
            </div>
            <button
              onClick={handleLockPayroll}
              disabled={isLocking || previewData.items.length === 0}
              className="mt-3 w-full py-2 bg-[#6dd95d] hover:bg-[#5ec74e] disabled:bg-slate-100 disabled:text-slate-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2 shadow-xs"
            >
              <Lock className="h-4 w-4" />
              <span>{isLocking ? 'Locking...' : 'Lock Payroll for Period'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Teachers Period Summary Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Teacher Earnings Breakdown (Preview)</h3>
          <span className="text-xs text-slate-500">
            Period: {formatDateOnly(periodStart)} – {formatDateOnly(periodEnd)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">
                  <SortHeader label="Teacher" field="teacher_name" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                </th>
                <th className="py-3 px-4 text-center">
                  <SortHeader label="Sessions Conducted" field="sessions_conducted" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" />
                </th>
                <th className="py-3 px-4 text-center">
                  <SortHeader label="Trials Attended" field="trials_attended" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" />
                </th>
                <th className="py-3 px-4 text-right font-bold text-slate-900">
                  <SortHeader label="Total Compensation" field="total_amount" currentField={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSummary.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    No payable items found for this period.
                  </td>
                </tr>
              ) : (
                filteredSummary.map((t) => (
                  <tr key={t.teacher_id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{t.teacher_name}</div>
                      <div className="font-mono text-[10px] text-blue-700 font-bold">{t.teacher_code}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-700 font-semibold">
                      {t.sessions_count}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-blue-800 font-bold">
                      {t.trials_count}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 text-sm bg-slate-50/70">
                      {formatRupiah(parseInt(t.total_amount) || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Locked Payroll Runs */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Audited Payroll Runs (Immutable History)</h3>
          <span className="text-xs text-slate-500">Append-only audit lines</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Locked Timestamp</th>
                <th className="py-3 px-4 text-center">Items Frozen</th>
                <th className="py-3 px-4 text-right font-bold text-slate-900">Total Disbursed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {formatDateOnly(r.period_start)} – {formatDateOnly(r.period_end)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c1a9e6]/25 text-purple-950 border border-[#c1a9e6]/40 flex items-center space-x-1 w-max">
                      <Lock className="h-3 w-3" />
                      <span className="uppercase">{r.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {formatDateOnly(r.locked_at)}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-700">
                    {r.lines_count} lines
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatRupiah(parseInt(r.total_amount) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
