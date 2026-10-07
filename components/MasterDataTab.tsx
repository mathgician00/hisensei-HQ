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
    <div className="space-y-6 pb-12">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <span>Master Data & Configuration Matrix</span>
            <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded-full font-mono">
              PRD v0.4
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Effective-dated rates, package pricing, public holiday exclusions, and business engine parameters.
          </p>
        </div>

        {/* Sub tabs */}
        <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveSubTab('rates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'rates' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Teacher Rates
          </button>
          <button
            onClick={() => setActiveSubTab('packages')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'packages' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Package Pricing
          </button>
          <button
            onClick={() => setActiveSubTab('holidays')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'holidays' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Holidays
          </button>
          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'config' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Engine Config
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'users' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Users &amp; Roles
          </button>
        </div>
      </div>

      {/* SUBTAB: Teacher Rates Matrix */}
      {activeSubTab === 'rates' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white">Effective-Dated Teacher Rates Matrix</h3>
            <span className="text-xs text-slate-400">
              Classes require an active rate tuple matching teacher, subject, curriculum, level, and class type
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-700">
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
              <tbody className="divide-y divide-slate-800">
                {masterData.teacherRates.map((tr: any) => (
                  <tr key={tr.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">{tr.teacher_name}</td>
                    <td className="py-3 px-4 text-slate-300">
                      {masterData.subjects.find((s: any) => s.id === tr.subject_id)?.name}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {masterData.curricula.find((c: any) => c.id === tr.curriculum_id)?.name}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {masterData.levels.find((l: any) => l.id === tr.level_id)?.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                        {tr.class_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      {formatRupiah(tr.rate)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white">Student Package Pricing Matrix</h3>
            <span className="text-xs text-slate-400">
              List price snapshotted automatically upon invoice creation
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-700">
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
              <tbody className="divide-y divide-slate-800">
                {masterData.packagePrices.map((pp: any) => (
                  <tr key={pp.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">{pp.package_name}</td>
                    <td className="py-3 px-4 text-slate-300">
                      {masterData.subjects.find((s: any) => s.id === pp.subject_id)?.name}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {masterData.curricula.find((c: any) => c.id === pp.curriculum_id)?.name}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {masterData.levels.find((l: any) => l.id === pp.level_id)?.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                        {pp.class_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-cyan-400 text-sm">
                      {formatRupiah(pp.price)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white">Center Holiday Exclusions</h3>
            <span className="text-xs text-slate-400">
              Automatic slot generation skips these calendar dates during allocation
            </span>
          </div>

          <div className="p-4 space-y-3">
            {masterData.holidays.map((h: any, idx: number) => (
              <div
                key={idx}
                className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{h.note}</div>
                    <div className="font-mono text-[11px] text-slate-400">{formatDateOnly(h.day)}</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full">
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white">Operating System Configuration Parameters</h3>
            <span className="text-xs text-slate-400 font-mono">table config</span>
          </div>

          <div className="divide-y divide-slate-800 text-xs">
            {Object.entries(masterData.config).map(([k, v]: [string, any]) => (
              <div key={k} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition">
                <div>
                  <span className="font-mono font-bold text-indigo-400">{k}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {k === 'timezone' && 'Center operational timezone for business logic and session timestamps'}
                    {k === 'notice_hours' && 'Minimum hours of advance notice required to keep credit (≥ 4h)'}
                    {k === 'max_group_capacity' && 'Hard limit on group class cohort size'}
                    {k === 'checkin_grace_days' && 'Grace period window in days after session start for teacher check-in'}
                    {k === 'postponement_max_months' && 'Maximum allowable postponement duration before student is churned'}
                    {k === 'renewal_threshold' && 'Credit balance threshold for surfacing in renewal due radar (≤ 1)'}
                    {k === 'inactivity_months' && 'Months of silence before active student is counted as dropped in waterfall'}
                  </p>
                </div>
                <span className="px-3 py-1 font-mono font-extrabold text-sm rounded-xl bg-slate-800 border border-slate-700 text-white">
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
