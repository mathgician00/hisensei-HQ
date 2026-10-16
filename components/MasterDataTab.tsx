'use client';

import React, { useState } from 'react';
import {
  Database,
  Calendar,
  Layers,
  Sparkles,
  Settings,
  BookOpen,
  DollarSign,
  GraduationCap,
  Tag,
} from 'lucide-react';
import { formatRupiah, formatDateOnly } from '@/lib/formatters';
import { UsersPanel } from '@/components/UsersPanel';

interface MasterDataTabProps {
  masterData: any;
  currentEmail: string;
}

export const MasterDataTab: React.FC<MasterDataTabProps> = ({ masterData, currentEmail }) => {
  const [activeSubTab, setActiveSubTab] = useState<'rates' | 'packages' | 'holidays' | 'config' | 'users'>('rates');

  return (
    <div className="space-y-6 pb-12 text-slate-900">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <span>Master Data & Configuration Matrix</span>
            <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full font-mono font-bold">
              PRD v0.4
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Effective-dated rates, package pricing, public holiday exclusions, and business engine parameters.
          </p>
        </div>

        {/* Sub tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('rates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'rates' ? 'bg-[#6dd95d] text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Teacher Rates
          </button>
          <button
            onClick={() => setActiveSubTab('packages')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'packages' ? 'bg-[#6dd95d] text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Package Pricing
          </button>
          <button
            onClick={() => setActiveSubTab('holidays')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'holidays' ? 'bg-[#6dd95d] text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Holidays
          </button>
          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'config' ? 'bg-[#6dd95d] text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Engine Config
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'users' ? 'bg-[#6dd95d] text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Users &amp; Roles
          </button>
        </div>
      </div>

      {/* SUBTAB: Teacher Rates Matrix */}
      {activeSubTab === 'rates' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Effective-Dated Teacher Rates Matrix</h3>
            <span className="text-xs text-slate-500">
              Classes require an active rate tuple matching teacher, subject, curriculum, level, and class type
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Teacher</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Curriculum</th>
                  <th className="py-3 px-4">Level</th>
                  <th className="py-3 px-4">Class Type</th>
                  <th className="py-3 px-4 text-right">Rate / Session</th>
                  <th className="py-3 px-4">Effective Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {masterData.teacherRates.map((tr: any) => (
                  <tr key={tr.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">{tr.teacher_name}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {masterData.subjects.find((s: any) => s.id === tr.subject_id)?.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {masterData.curricula.find((c: any) => c.id === tr.curriculum_id)?.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {masterData.levels.find((l: any) => l.id === tr.level_id)?.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-800">
                        {tr.class_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 text-sm">
                      {formatRupiah(tr.rate)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {formatDateOnly(tr.effective_from)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: Package Pricing Matrix */}
      {activeSubTab === 'packages' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Student Package Pricing Matrix</h3>
            <span className="text-xs text-slate-500">
              List price snapshotted automatically upon invoice creation
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Package</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Curriculum</th>
                  <th className="py-3 px-4">Level</th>
                  <th className="py-3 px-4">Class Type</th>
                  <th className="py-3 px-4 text-right">Package Price</th>
                  <th className="py-3 px-4">Effective Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {masterData.packagePrices.map((pp: any) => (
                  <tr key={pp.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">{pp.package_name}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {masterData.subjects.find((s: any) => s.id === pp.subject_id)?.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {masterData.curricula.find((c: any) => c.id === pp.curriculum_id)?.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {masterData.levels.find((l: any) => l.id === pp.level_id)?.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-800">
                        {pp.class_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-blue-900 text-sm">
                      {formatRupiah(pp.price)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {formatDateOnly(pp.effective_from)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: Public Holidays */}
      {activeSubTab === 'holidays' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Center Holiday Exclusions</h3>
            <span className="text-xs text-slate-500">
              Automatic slot generation skips these calendar dates during allocation
            </span>
          </div>

          <div className="p-4 space-y-3">
            {masterData.holidays.map((h: any, idx: number) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-lg bg-[#f77f73]/20 text-rose-950 flex items-center justify-center border border-[#f77f73]/40">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{h.note}</div>
                    <div className="font-mono text-[11px] text-slate-500">{formatDateOnly(h.day)}</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#f77f73]/20 text-rose-950 border border-[#f77f73]/40 rounded-full">
                  Exclusion Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB: Users and roles (master admin only) */}
      {activeSubTab === 'users' && <UsersPanel teachers={masterData.teachers} currentEmail={currentEmail} />}

      {/* SUBTAB: Engine Config Parameters */}
      {activeSubTab === 'config' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Operating System Configuration Parameters</h3>
            <span className="text-xs text-slate-500 font-mono">table config</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {Object.entries(masterData.config).map(([k, v]: [string, any]) => (
              <div key={k} className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition">
                <div>
                  <span className="font-mono font-bold text-slate-900">{k}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {k === 'timezone' && 'Center operational timezone for business logic and session timestamps'}
                    {k === 'notice_hours' && 'Minimum hours of advance notice required to keep credit (≥ 4h)'}
                    {k === 'max_group_capacity' && 'Hard limit on group class cohort size'}
                    {k === 'checkin_grace_days' && 'Grace period window in days after session start for teacher check-in'}
                    {k === 'postponement_max_months' && 'Maximum allowable postponement duration before student is churned'}
                    {k === 'renewal_threshold' && 'Credit balance threshold for surfacing in renewal due radar (≤ 1)'}
                    {k === 'inactivity_months' && 'Months of silence before active student is counted as dropped in waterfall'}
                  </p>
                </div>
                <span className="px-3 py-1 font-mono font-extrabold text-sm rounded-xl bg-slate-100 border border-slate-200 text-slate-900">
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
