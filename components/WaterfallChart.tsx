'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle2,
  Calendar,
  Info,
  ChevronDown,
  Layers,
  ArrowRight,
  UserCheck,
  UserX,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { formatDateOnly } from '@/lib/formatters';

interface WaterfallRow {
  month: string;
  opening: number;
  new_students: number;
  reactivated: number;
  dropped: number;
  closing: number;
  ongoing: number;
  of_which_postponed: number;
  identity_ok: boolean;
}

interface WaterfallChartProps {
  waterfallData: WaterfallRow[];
  onSelectStudent?: (studentId: string) => void;
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({ waterfallData }) => {
  // Default to the latest month in data (e.g. September 2026)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    waterfallData.length > 0 ? waterfallData[waterfallData.length - 1].month : '2026-09-01'
  );

  // Hover state
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  // Drilldown drawer state
  const [drilldownBucket, setDrilldownBucket] = useState<string | null>(null);
  const [drilldownStudents, setDrilldownStudents] = useState<any[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const activeRow =
    waterfallData.find((r) => r.month.startsWith(selectedMonth.slice(0, 7))) ||
    waterfallData[waterfallData.length - 1] || {
      month: new Date().toISOString().slice(0, 10),
      opening: 0,
      new_students: 0,
      reactivated: 0,
      dropped: 0,
      closing: 0,
      ongoing: 0,
      of_which_postponed: 0,
      identity_ok: true,
    };

  const {
    opening,
    new_students: newStudents,
    reactivated,
    dropped,
    closing,
    ongoing,
    of_which_postponed: postponed,
    identity_ok: identityOk,
  } = activeRow;

  const netGrowth = closing - opening;
  const peak = opening + newStudents + reactivated;
  const maxVal = Math.max(peak, closing, 10) + 4;

  // Step definitions for the waterfall bridge
  // Each step has: id, label, value, startY (bottom), endY (top), color, type
  const steps = [
    {
      id: 'opening',
      label: 'Opening Active',
      sublabel: 'Baseline from prev month',
      value: opening,
      displayVal: `${opening}`,
      startY: 0,
      endY: opening,
      height: opening,
      type: 'baseline',
      barColor: 'bg-indigo-600',
      borderColor: 'border-indigo-400',
      textColor: 'text-indigo-400',
      description: 'Active students who paid or attended sessions within the prior 3-month window.',
    },
    {
      id: 'new_students',
      label: '+ New Students',
      sublabel: 'First-time conversions',
      value: newStudents,
      displayVal: `+${newStudents}`,
      startY: opening,
      endY: opening + newStudents,
      height: newStudents,
      type: 'increase',
      barColor: 'bg-emerald-500',
      borderColor: 'border-emerald-400',
      textColor: 'text-emerald-400',
      description: 'Newly converted leads making their very first package payment in this cohort month.',
    },
    {
      id: 'reactivated',
      label: '+ Reactivated',
      sublabel: 'Returning after lapse',
      value: reactivated,
      displayVal: `+${reactivated}`,
      startY: opening + newStudents,
      endY: opening + newStudents + reactivated,
      height: reactivated,
      type: 'increase',
      barColor: 'bg-cyan-500',
      borderColor: 'border-cyan-400',
      textColor: 'text-cyan-400',
      description: 'Previously dropped students who returned and made a renewal payment.',
    },
    {
      id: 'dropped',
      label: '− Dropped (Churn)',
      sublabel: '3-mo inactivity / left',
      value: dropped,
      displayVal: `−${dropped}`,
      startY: closing,
      endY: peak,
      height: dropped,
      type: 'decrease',
      barColor: 'bg-rose-500',
      borderColor: 'border-rose-400',
      textColor: 'text-rose-400',
      description: 'Students from previous month population with no payment/attendance in the last 3 months.',
    },
    {
      id: 'closing',
      label: '= Closing Population',
      sublabel: 'Net active student cohort',
      value: closing,
      displayVal: `${closing}`,
      startY: 0,
      endY: closing,
      height: closing,
      type: 'total',
      barColor: 'bg-gradient-to-t from-emerald-600 to-teal-500',
      borderColor: 'border-teal-400',
      textColor: 'text-teal-300',
      description: 'Total active population at end of month: Opening + New + Reactivated − Dropped.',
    },
  ];

  const handleOpenDrilldown = async (bucketId: string) => {
    setDrilldownBucket(bucketId);
    setIsLoadingStudents(true);
    try {
      const res = await apiFetch(
        `/api/data?type=waterfall_students&month=${selectedMonth}&bucket=${bucketId}`
      );
      const data = await res.json();
      setDrilldownStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load drilldown students:', err);
      setDrilldownStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="font-extrabold text-base text-white tracking-tight">
              Single-Month Student Waterfall Bridge
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md">
              fn_waterfall
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visual bridge showing how the student population transitioned from Opening to Closing. Hover for details or click any bar to inspect students.
          </p>
        </div>

        {/* Right Controls: Month Selector & Identity Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              {waterfallData.map((row) => (
                <option key={row.month} value={row.month} className="bg-slate-900 text-white">
                  {formatDateOnly(row.month)}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
              identityOk
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{identityOk ? 'Identity: OK' : 'Identity: MISMATCH'}</span>
          </div>
        </div>
      </div>

      {/* KPI Ribbon for the Selected Month */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Opening Cohort
          </span>
          <div className="text-xl font-extrabold text-white font-mono mt-0.5">{opening}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active on 1st of month</div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
            Gross Additions
          </span>
          <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">
            +{newStudents + reactivated}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {newStudents} new, {reactivated} reactivated
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
            Gross Churn
          </span>
          <div className="text-xl font-extrabold text-rose-400 font-mono mt-0.5">
            −{dropped}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">3-month inactive / left</div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">
            Closing Cohort
          </span>
          <div className="text-xl font-extrabold text-teal-300 font-mono mt-0.5 flex items-baseline space-x-2">
            <span>{closing}</span>
            <span
              className={`text-xs font-semibold ${
                netGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              ({netGrowth >= 0 ? `+${netGrowth}` : netGrowth})
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Incl. {postponed} postponed
          </div>
        </div>
      </div>

      {/* Visual Graphical Waterfall Chart Canvas */}
      <div className="relative pt-6 pb-2">
        {/* Y-Axis Gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 border-b border-slate-700">
          <div className="border-t border-slate-600 w-full" />
          <div className="border-t border-slate-600 w-full" />
          <div className="border-t border-slate-600 w-full" />
          <div className="border-t border-slate-600 w-full" />
        </div>

        {/* Steps Bar Grid */}
        <div className="relative grid grid-cols-5 gap-3 sm:gap-6 h-72 items-end z-10 px-2">
          {steps.map((step, idx) => {
            const isHovered = hoveredStep === step.id;
            const bottomPercent = (step.startY / maxVal) * 100;
            const heightPercent = Math.max((step.height / maxVal) * 100, step.height > 0 ? 5 : 2);

            return (
              <div
                key={step.id}
                className="relative h-full flex flex-col justify-end items-center group cursor-pointer"
                onMouseEnter={() => setHoveredStep(step.id)}
                onMouseLeave={() => setHoveredStep(null)}
                onClick={() => handleOpenDrilldown(step.id)}
              >
                {/* Floating Value Tag on Bar Top */}
                <div
                  className="absolute transition-all duration-200 pointer-events-none"
                  style={{
                    bottom: `calc(${bottomPercent}% + ${heightPercent}% + 8px)`,
                  }}
                >
                  <span
                    className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded-md shadow-sm border ${
                      step.type === 'increase'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30'
                        : step.type === 'decrease'
                        ? 'bg-rose-950/90 text-rose-300 border-rose-500/30'
                        : 'bg-slate-800/90 text-white border-slate-700'
                    }`}
                  >
                    {step.displayVal}
                  </span>
                </div>

                {/* The Floating / Stepped Bar */}
                <div
                  className="w-full max-w-[80px] rounded-xl transition-all duration-200 relative overflow-hidden shadow-lg border"
                  style={{
                    position: 'absolute',
                    bottom: `${bottomPercent}%`,
                    height: `${heightPercent}%`,
                  }}
                >
                  {/* Background Bar */}
                  <div
                    className={`w-full h-full ${step.barColor} ${
                      isHovered ? 'brightness-125 scale-102' : 'brightness-100'
                    } transition-all`}
                  />

                  {/* If Closing bar, display postponed sub-segment at top */}
                  {step.id === 'closing' && postponed > 0 && (
                    <div
                      className="absolute top-0 left-0 right-0 bg-amber-400/30 border-b border-amber-300/40 flex items-center justify-center text-[9px] font-bold text-amber-200"
                      style={{
                        height: `${Math.min((postponed / closing) * 100, 50)}%`,
                      }}
                      title={`${postponed} students currently on postponement`}
                    >
                      <span className="truncate px-1 font-mono">{postponed} P</span>
                    </div>
                  )}

                  {/* Inner shine */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 pointer-events-none" />
                </div>

                {/* Connecting Dotted Reference Line to Next Step */}
                {idx < steps.length - 1 && (
                  <div
                    className="hidden sm:block absolute right-0 w-full h-[1px] border-b border-dashed border-slate-600/70 pointer-events-none z-0"
                    style={{
                      bottom: `${(step.endY / maxVal) * 100}%`,
                      transform: 'translateX(50%)',
                    }}
                  />
                )}

                {/* Rich Hover Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full mb-12 z-30 w-56 p-3 bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl text-left pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className={`font-bold text-xs ${step.textColor}`}>
                        {step.label}
                      </span>
                      <span className="font-mono font-extrabold text-xs text-white">
                        {step.displayVal}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                      {step.description}
                    </div>
                    <div className="text-[10px] text-indigo-400 font-semibold mt-2 pt-1 border-t border-slate-800/80 flex items-center space-x-1">
                      <span>Click to view student names</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* X-Axis Column Labels */}
        <div className="grid grid-cols-5 gap-3 sm:gap-6 mt-4 border-t border-slate-800 pt-3 px-2">
          {steps.map((step) => (
            <div
              key={step.id}
              onClick={() => handleOpenDrilldown(step.id)}
              className="text-center cursor-pointer hover:bg-slate-800/40 p-1.5 rounded-xl transition"
            >
              <div className={`text-xs font-bold ${step.textColor} truncate`}>
                {step.label}
              </div>
              <div className="text-[10px] text-slate-400 hidden sm:block truncate mt-0.5">
                {step.sublabel}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend & Footnote */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80 gap-3">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-indigo-600 inline-block" />
            <span>Baseline Opening</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            <span>Additions (+)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
            <span>Dropped (−)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-t from-emerald-600 to-teal-500 inline-block" />
            <span>Closing Cohort</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-amber-400/40 border border-amber-300/40 inline-block" />
            <span>Of which Postponed</span>
          </div>
        </div>

        <div className="text-slate-400 flex items-center space-x-1">
          <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <span>Click any bar to drill down into the active student records</span>
        </div>
      </div>

      {/* STUDENT DRILL-DOWN MODAL / DRAWER */}
      {drilldownBucket && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-base text-white flex items-center space-x-2">
                  <span>Student Roster Inspection</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono">
                    {drilldownBucket}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cohort Month: {formatDateOnly(selectedMonth)} • {drilldownStudents.length} student records found
                </p>
              </div>
              <button
                onClick={() => setDrilldownBucket(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {isLoadingStudents ? (
              <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                <Clock className="h-4 w-4 animate-spin text-cyan-400" />
                <span>Querying PostgreSQL database records...</span>
              </div>
            ) : drilldownStudents.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs italic">
                No students recorded in this bucket for {formatDateOnly(selectedMonth)}.
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {drilldownStudents.map((st) => (
                  <div
                    key={st.id}
                    className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-indigo-400">{st.code}</span>
                        <span className="font-semibold text-white">{st.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {st.guardian_name ? `Parent: ${st.guardian_name}` : 'Direct Lead'}
                        {st.first_paid_at && ` • First Paid: ${formatDateOnly(st.first_paid_at)}`}
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                          st.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : st.status === 'postponed'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {st.status}
                      </span>
                      {st.expected_return_date && (
                        <div className="text-[10px] text-amber-300/80 mt-0.5 font-mono">
                          Return: {formatDateOnly(st.expected_return_date)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setDrilldownBucket(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
