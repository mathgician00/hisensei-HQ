'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  TrendingUp,
  Calendar,
  CheckCircle2,
  Info,
  ArrowRight,
  Clock,
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
  // Default to the latest month in data
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

  const peak = opening + newStudents + reactivated;
  const maxVal = Math.max(peak, closing, 10) + 4;

  // Step definitions using the flat 6-color palette
  const steps = [
    {
      id: 'opening',
      label: 'Opening Active',
      sublabel: 'Prior cohort baseline',
      value: opening,
      displayVal: `${opening}`,
      startY: 0,
      endY: opening,
      height: opening,
      type: 'baseline',
      hex: '#c1a9e6',
      badgeBg: 'bg-[#c1a9e6]/20',
      badgeText: 'text-purple-900',
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
      hex: '#6dd95d',
      badgeBg: 'bg-[#6dd95d]/25',
      badgeText: 'text-emerald-950',
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
      hex: '#65acff',
      badgeBg: 'bg-[#65acff]/25',
      badgeText: 'text-blue-950',
      description: 'Previously dropped students who returned and made a renewal payment.',
    },
    {
      id: 'dropped',
      label: '− Dropped (Churn)',
      sublabel: '3-mo inactive / left',
      value: dropped,
      displayVal: `−${dropped}`,
      startY: closing,
      endY: peak,
      height: dropped,
      type: 'decrease',
      hex: '#f77f73',
      badgeBg: 'bg-[#f77f73]/25',
      badgeText: 'text-rose-950',
      description: 'Students from previous month population with no payment/attendance in the last 3 months.',
    },
    {
      id: 'closing',
      label: '= Closing Cohort',
      sublabel: 'Net active student cohort',
      value: closing,
      displayVal: `${closing}`,
      startY: 0,
      endY: closing,
      height: closing,
      type: 'total',
      hex: '#fdb01b',
      badgeBg: 'bg-[#fdb01b]/25',
      badgeText: 'text-amber-950',
      description: 'Total active population at end of month: Opening + New + Reactivated − Dropped.',
    },
  ];

  const handleOpenDrilldown = async (bucketId: string) => {
    setDrilldownBucket(bucketId);
    setIsLoadingStudents(true);
    const normalizedMonth = String(selectedMonth).slice(0, 10);
    try {
      const res = await apiFetch(
        `/api/data?type=waterfall_students&month=${encodeURIComponent(normalizedMonth)}&bucket=${bucketId}`
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

  const activeBucketStep = steps.find((s) => s.id === drilldownBucket);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 text-slate-900">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-xl bg-[#6dd95d]/20 text-slate-900 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-base text-slate-900 tracking-tight">
              Single-Month Student Waterfall Bridge
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visual bridge showing student population progression. Click any bar to inspect students in that bucket.
          </p>
        </div>

        {/* Right Controls: Month Selector & Identity Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {waterfallData.map((row) => (
                <option key={row.month} value={row.month} className="bg-white text-slate-900">
                  {formatDateOnly(row.month)}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
              identityOk
                ? 'bg-[#6dd95d]/15 text-emerald-900 border-[#6dd95d]/30'
                : 'bg-[#f77f73]/15 text-rose-900 border-[#f77f73]/30'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{identityOk ? 'Identity: OK' : 'Identity: MISMATCH'}</span>
          </div>
        </div>
      </div>

      {/* KPI Ribbon for the Selected Month */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Opening Cohort
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-0.5">{opening}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active on 1st of month</div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
            Gross Additions
          </span>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-0.5">
            +{newStudents + reactivated}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {newStudents} new, {reactivated} reactivated
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-rose-700 tracking-wider">
            Gross Churn
          </span>
          <div className="text-xl font-bold text-rose-700 font-mono mt-0.5">
            −{dropped}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">3-month inactive / left</div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">
            Closing Cohort
          </span>
          <div className="text-xl font-bold text-amber-700 font-mono mt-0.5">{closing}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {ongoing} ongoing, {postponed} postponed
          </div>
        </div>
      </div>

      {/* Waterfall Graphic Canvas */}
      <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 sm:p-6 relative">
        <div className="relative h-64 sm:h-72 w-full flex">
          {/* Horizontal Background Grid Reference Lines */}
          <div className="absolute inset-0 pointer-events-none">
            {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
              const val = Math.round(maxVal * ratio);
              const isBase = ratio === 0;
              return (
                <div
                  key={ratio}
                  className="absolute left-0 right-0 flex items-center"
                  style={{ bottom: `${ratio * 100}%` }}
                >
                  <span className="text-[10px] font-mono font-bold text-slate-500 w-8 text-right pr-2 shrink-0 -translate-y-1/2">
                    {val}
                  </span>
                  <div
                    className={`w-full ${
                      isBase
                        ? 'border-b border-slate-300'
                        : 'border-b border-slate-200 border-dashed'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Columns & Stepped Floating Rectangles: Anchored precisely on the same coordinate baseline */}
          <div className="relative h-full w-full ml-9 flex items-end justify-between">
            {steps.map((step, idx) => {
              const isHovered = hoveredStep === step.id;
              const bottomPercent = (step.startY / maxVal) * 100;
              const heightPercent = Math.max((step.height / maxVal) * 100, 2);

              return (
                <div
                  key={step.id}
                  className="relative h-full flex flex-col justify-end items-center group cursor-pointer flex-1"
                  onMouseEnter={() => setHoveredStep(step.id)}
                  onMouseLeave={() => setHoveredStep(null)}
                  onClick={() => handleOpenDrilldown(step.id)}
                >
                  {/* Floating Value Tag on Bar Top */}
                  <div
                    className="absolute transition-all duration-200 pointer-events-none z-10"
                    style={{
                      bottom: `calc(${bottomPercent}% + ${heightPercent}% + 6px)`,
                    }}
                  >
                    <span
                      className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded-sm border border-slate-300 ${step.badgeBg} ${step.badgeText}`}
                    >
                      {step.displayVal}
                    </span>
                  </div>

                  {/* The Stepped Bar: Explicitly Flat & NOT rounded (rounded-none per user spec #5) */}
                  <div
                    className="w-full max-w-[70px] rounded-none transition-all duration-150 relative overflow-hidden border border-slate-400/40"
                    style={{
                      position: 'absolute',
                      bottom: `${bottomPercent}%`,
                      height: `${heightPercent}%`,
                      backgroundColor: step.hex,
                    }}
                  >
                    {/* Closing bar postponed sub-segment at top with flat gold #fdce1b */}
                    {step.id === 'closing' && postponed > 0 && (
                      <div
                        className="absolute top-0 left-0 right-0 bg-[#fdce1b] border-b border-amber-500/30 flex items-center justify-center text-[9px] font-bold text-slate-900"
                        style={{
                          height: `${Math.min((postponed / closing) * 100, 50)}%`,
                        }}
                        title={`${postponed} students currently on postponement`}
                      >
                        <span className="truncate px-1 font-mono">{postponed} P</span>
                      </div>
                    )}
                  </div>

                  {/* Connecting Dotted Reference Line to Next Step */}
                  {idx < steps.length - 1 && (
                    <div
                      className="hidden sm:block absolute right-0 w-full h-[1px] border-b border-dashed border-slate-400 pointer-events-none z-0"
                      style={{
                        bottom: `${(step.endY / maxVal) * 100}%`,
                        transform: 'translateX(50%)',
                      }}
                    />
                  )}

                  {/* Rich Hover Tooltip */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-10 z-30 w-56 p-3 bg-white border border-slate-300 rounded-xl shadow-lg text-left pointer-events-none">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-xs text-slate-900">
                          {step.label}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {step.displayVal}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                        {step.description}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-bold mt-2 pt-1 border-t border-slate-100 flex items-center space-x-1">
                        <span>Click to view student names</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* X-Axis Column Labels */}
        <div className="grid grid-cols-5 gap-2 sm:gap-4 mt-4 border-t border-slate-200 pt-3 pl-9 pr-2">
          {steps.map((step) => (
            <div
              key={step.id}
              onClick={() => handleOpenDrilldown(step.id)}
              className="text-center cursor-pointer hover:bg-white p-1 rounded-lg transition"
            >
              <div className="text-xs font-bold text-slate-900 truncate">
                {step.label}
              </div>
              <div className="text-[10px] text-slate-500 hidden sm:block truncate mt-0.5">
                {step.sublabel}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100 gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-none inline-block border border-slate-300" style={{ backgroundColor: '#c1a9e6' }} />
            <span>Opening Baseline</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-none inline-block border border-slate-300" style={{ backgroundColor: '#6dd95d' }} />
            <span>Additions (+)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-none inline-block border border-slate-300" style={{ backgroundColor: '#65acff' }} />
            <span>Reactivated (+)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-none inline-block border border-slate-300" style={{ backgroundColor: '#f77f73' }} />
            <span>Dropped (−)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-none inline-block border border-slate-300" style={{ backgroundColor: '#fdb01b' }} />
            <span>Closing Cohort</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-none inline-block border border-slate-300" style={{ backgroundColor: '#fdce1b' }} />
            <span>Postponed portion</span>
          </div>
        </div>

        <div className="text-slate-500 flex items-center space-x-1">
          <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>Click any bar to drill down into active records</span>
        </div>
      </div>

      {/* Student Drill-Down Modal */}
      {drilldownBucket && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  Student Roster — {activeBucketStep ? activeBucketStep.label.replace(/^[+=−-]\s*/, '') : drilldownBucket}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cohort Month: {formatDateOnly(selectedMonth)} • {drilldownStudents.length} student records found
                </p>
              </div>
              <button
                onClick={() => setDrilldownBucket(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {isLoadingStudents ? (
              <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
                <Clock className="h-4 w-4 animate-spin text-[#6dd95d]" />
                <span>Querying database records...</span>
              </div>
            ) : drilldownStudents.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs italic">
                No students recorded in this bucket for {formatDateOnly(selectedMonth)}.
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {drilldownStudents.map((st) => (
                  <div
                    key={st.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-700">{st.code}</span>
                        <span className="font-semibold text-slate-900">{st.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {st.guardian_name ? `Parent: ${st.guardian_name}` : 'Direct Lead'}
                        {st.first_paid_at && ` • First Paid: ${formatDateOnly(st.first_paid_at)}`}
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                          st.status === 'active'
                            ? 'bg-[#6dd95d]/20 text-emerald-950 border border-[#6dd95d]/40'
                            : st.status === 'postponed'
                            ? 'bg-[#fdb01b]/20 text-amber-950 border border-[#fdb01b]/40'
                            : 'bg-[#f77f73]/20 text-rose-950 border border-[#f77f73]/40'
                        }`}
                      >
                        {st.status}
                      </span>
                      {st.expected_return_date && (
                        <div className="text-[10px] text-amber-800 mt-0.5 font-mono">
                          Return: {formatDateOnly(st.expected_return_date)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setDrilldownBucket(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
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
