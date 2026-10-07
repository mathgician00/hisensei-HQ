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

  // If teacher role, filter preview to only the selected teacher
  const filteredSummary =
    currentRole === 'teacher' && selectedTeacherId
      ? previewData.summary.filter((s) => s.teacher_id === selectedTeacherId)
      : previewData.summary;

  const totalPayable = filteredSummary.reduce(
    (acc, curr) => acc + (parseInt(curr.total_amount) || 0),
    0
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <span>Teacher Compensation & Payroll Engine</span>
            <span className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-mono">
              Append-Only Immutability
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Prorated calculation for held sessions (with ≥1 consuming attendee) and attended trials.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center space-x-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
          <Calendar className="h-4 w-4 text-slate-400 ml-1.5" />
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="bg-transparent text-xs text-slate-200 focus:outline-none"
          />
          <span className="text-slate-500 text-xs">to</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="bg-transparent text-xs text-slate-200 focus:outline-none mr-1.5"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Summary KPI & Action */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Payable in Period
          </span>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400 font-mono">
            {formatRupiah(totalPayable)}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            For {filteredSummary.length} teachers
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Locked Past Payroll Runs
          </span>
          <div className="mt-2 text-2xl font-extrabold text-white font-mono">
            {runs.length} Runs
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Historical records frozen & audited
          </div>
        </div>

        {(currentRole === 'admin' || currentRole === 'master_admin') && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Lock Period Execution
              </span>
              <p className="text-xs text-slate-400 mt-1">
                Finalizes period payout and locks all sessions/attendances via database trigger.
              </p>
            </div>
            <button
              onClick={handleLockPayroll}
              disabled={isLocking || previewData.items.length === 0}
              className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2 shadow-md"
            >
              <Lock className="h-4 w-4" />
              <span>{isLocking ? 'Locking...' : 'Lock Payroll for Period'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Teachers Period Summary Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">Teacher Earnings Breakdown (Preview)</h3>
          <span className="text-xs text-slate-400">
            Period: {formatDateOnly(periodStart)} – {formatDateOnly(periodEnd)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Teacher</th>
                <th className="py-3 px-4 text-center">Sessions Conducted</th>
                <th className="py-3 px-4 text-center">Trials Attended</th>
                <th className="py-3 px-4 text-right font-bold text-white">Total Compensation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredSummary.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                    No payable items found for this period.
                  </td>
                </tr>
              ) : (
                filteredSummary.map((t) => (
                  <tr key={t.teacher_id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{t.teacher_name}</div>
                      <div className="font-mono text-[10px] text-indigo-400">{t.teacher_code}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300">
                      {t.sessions_count}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-cyan-400">
                      {t.trials_count}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-400 text-sm bg-slate-800/20">
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">Audited Payroll Runs (Immutable History)</h3>
          <span className="text-xs text-slate-400">Append-only audit lines</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Locked Timestamp</th>
                <th className="py-3 px-4 text-center">Items Frozen</th>
                <th className="py-3 px-4 text-right font-bold text-white">Total Disbursed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-mono font-medium text-white">
                    {formatDateOnly(r.period_start)} – {formatDateOnly(r.period_end)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center space-x-1 w-max">
                      <Lock className="h-3 w-3" />
                      <span className="uppercase">{r.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {formatDateOnly(r.locked_at)}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-300">
                    {r.lines_count} lines
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
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
