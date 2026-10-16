'use client';

import React, { useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Percent,
  Users,
  CheckCircle2,
  AlertCircle,
  Award,
  Zap,
  Tag,
  ArrowDown,
} from 'lucide-react';
import { Lead } from '@/src/services/tutoringService';

interface LeadFlowChartProps {
  leads: Lead[];
}

interface FunnelStep {
  id: string;
  label: string;
  count: number;
  pctOfTotal: number;
  dropOffCount: number;
  dropOffPct: number;
  color: string;
}

export const LeadFlowChart: React.FC<LeadFlowChartProps> = ({ leads }) => {
  // Aggregate stats
  const metrics = useMemo(() => {
    const total = leads.length;

    // Counts of leads that reached or passed each stage
    // Stage order: new (all) -> contacted -> trial_booked -> trial_attended -> offer_made -> converted
    const stageCounts: Record<string, number> = {
      new: 0,
      contacted: 0,
      trial_booked: 0,
      trial_attended: 0,
      offer_made: 0,
      converted: 0,
      lost: 0,
    };

    const channelStats: Record<
      string,
      { total: number; converted: number; lost: number; inFlight: number }
    > = {};

    const lostReasons: Record<string, number> = {};

    leads.forEach((l) => {
      const stage = l.current_stage;
      if (stageCounts[stage] !== undefined) {
        stageCounts[stage]++;
      }

      // Channel breakdown
      const ch = l.source_channel || 'unknown';
      if (!channelStats[ch]) {
        channelStats[ch] = { total: 0, converted: 0, lost: 0, inFlight: 0 };
      }
      channelStats[ch].total++;
      if (stage === 'converted') {
        channelStats[ch].converted++;
      } else if (stage === 'lost') {
        channelStats[ch].lost++;
      } else {
        channelStats[ch].inFlight++;
      }

      // Lost reasons
      if (stage === 'lost') {
        const reason = l.lost_reason || 'unspecified';
        lostReasons[reason] = (lostReasons[reason] || 0) + 1;
      }
    });

    // Funnel steps calculation
    // A lead converted has reached all prior stages.
    // A lead at offer_made reached contacted, trial_booked, trial_attended.
    // A lead with trials_count > 0 or at trial_attended reached trial_booked.
    const reachedContacted =
      total - (stageCounts['new'] || 0) - (leads.filter((l) => l.current_stage === 'lost' && !l.trials_count).length > 0 ? 0 : 0);
    
    // Funnel progression values
    const funnelSteps: FunnelStep[] = [
      {
        id: 'inquiry',
        label: '1. Total Inquiries',
        count: total,
        pctOfTotal: 100,
        dropOffCount: 0,
        dropOffPct: 0,
        color: 'bg-slate-700',
      },
      {
        id: 'contacted',
        label: '2. Contacted & Qualified',
        count: total - stageCounts['new'],
        pctOfTotal: total > 0 ? Math.round(((total - stageCounts['new']) / total) * 100) : 0,
        dropOffCount: stageCounts['new'],
        dropOffPct: total > 0 ? Math.round((stageCounts['new'] / total) * 100) : 0,
        color: 'bg-blue-600',
      },
      {
        id: 'trial_booked',
        label: '3. Trial Booked',
        count:
          stageCounts['trial_booked'] +
          stageCounts['trial_attended'] +
          stageCounts['offer_made'] +
          stageCounts['converted'],
        pctOfTotal:
          total > 0
            ? Math.round(
                ((stageCounts['trial_booked'] +
                  stageCounts['trial_attended'] +
                  stageCounts['offer_made'] +
                  stageCounts['converted']) /
                  total) *
                  100
              )
            : 0,
        dropOffCount: 0,
        dropOffPct: 0,
        color: 'bg-purple-600',
      },
      {
        id: 'trial_attended',
        label: '4. Trial Attended',
        count:
          stageCounts['trial_attended'] +
          stageCounts['offer_made'] +
          stageCounts['converted'],
        pctOfTotal:
          total > 0
            ? Math.round(
                ((stageCounts['trial_attended'] +
                  stageCounts['offer_made'] +
                  stageCounts['converted']) /
                  total) *
                  100
              )
            : 0,
        dropOffCount: 0,
        dropOffPct: 0,
        color: 'bg-amber-600',
      },
      {
        id: 'offer_made',
        label: '5. Offer Made',
        count: stageCounts['offer_made'] + stageCounts['converted'],
        pctOfTotal:
          total > 0
            ? Math.round(
                ((stageCounts['offer_made'] + stageCounts['converted']) / total) * 100
              )
            : 0,
        dropOffCount: 0,
        dropOffPct: 0,
        color: 'bg-orange-500',
      },
      {
        id: 'converted',
        label: '6. Converted to Student',
        count: stageCounts['converted'],
        pctOfTotal:
          total > 0 ? Math.round((stageCounts['converted'] / total) * 100) : 0,
        dropOffCount: 0,
        dropOffPct: 0,
        color: 'bg-[#6dd95d]',
      },
    ];

    const conversionRate = total > 0 ? ((stageCounts['converted'] / total) * 100).toFixed(1) : '0.0';
    const trialWinRate =
      funnelSteps[3].count > 0
        ? ((stageCounts['converted'] / funnelSteps[3].count) * 100).toFixed(1)
        : '0.0';

    return {
      total,
      stageCounts,
      funnelSteps,
      channelStats,
      lostReasons,
      conversionRate,
      trialWinRate,
    };
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Overall Conversion Rate</span>
            <span className="p-1 rounded-md bg-emerald-100 text-emerald-800">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {metrics.conversionRate}%
            </span>
            <span className="text-[11px] text-slate-500">
              ({metrics.stageCounts['converted']} / {metrics.total} leads)
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Trial-to-Enrollment Win Rate</span>
            <span className="p-1 rounded-md bg-amber-100 text-amber-800">
              <Award className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {metrics.trialWinRate}%
            </span>
            <span className="text-[11px] text-slate-500">of attended trials enroll</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>In-Flight Pipeline</span>
            <span className="p-1 rounded-md bg-blue-100 text-blue-800">
              <Zap className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {metrics.total - metrics.stageCounts['converted'] - metrics.stageCounts['lost']}
            </span>
            <span className="text-[11px] text-slate-500">leads active now</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Lost Opportunities</span>
            <span className="p-1 rounded-md bg-rose-100 text-rose-800">
              <TrendingDown className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-700">
              {metrics.stageCounts['lost']}
            </span>
            <span className="text-[11px] text-slate-500">
              ({metrics.total > 0 ? ((metrics.stageCounts['lost'] / metrics.total) * 100).toFixed(0) : 0}% drop rate)
            </span>
          </div>
        </div>
      </div>

      {/* Visual Stepped Funnel Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-slate-900 text-sm">Lead Conversion Funnel Flow</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Stage retention & volume</span>
        </div>

        <div className="space-y-4 max-w-4xl mx-auto">
          {metrics.funnelSteps.map((step, idx) => {
            const widthPct = Math.max(step.pctOfTotal, 8);
            const prevStep = idx > 0 ? metrics.funnelSteps[idx - 1] : null;
            const dropDiff = prevStep ? prevStep.count - step.count : 0;
            const stepDropPct = prevStep && prevStep.count > 0 ? Math.round((dropDiff / prevStep.count) * 100) : 0;

            return (
              <div key={step.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{step.label}</span>
                    {idx > 0 && dropDiff > 0 && (
                      <span className="text-[10px] text-rose-600 font-mono bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                        -{dropDiff} ({stepDropPct}% drop-off)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-extrabold text-slate-900">
                      {step.count}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px] w-12 text-right">
                      {step.pctOfTotal}%
                    </span>
                  </div>
                </div>

                {/* Funnel Bar */}
                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden flex items-center">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${step.color}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Breakdown: Acquisition Channels & Lost Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Performance Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Acquisition Channel Efficiency
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Conversion %</span>
          </div>

          <div className="space-y-3">
            {Object.entries(metrics.channelStats).map(([ch, st]) => {
              const chConvPct = st.total > 0 ? Math.round((st.converted / st.total) * 100) : 0;
              return (
                <div key={ch} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 capitalize">{ch}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono text-[11px]">{st.total} leads</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#6dd95d]/20 text-emerald-950 font-bold font-mono text-xs">
                        {chConvPct}% win
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-slate-200">
                    <div
                      className="bg-[#6dd95d] h-full"
                      style={{ width: `${(st.converted / (st.total || 1)) * 100}%` }}
                      title={`Converted: ${st.converted}`}
                    />
                    <div
                      className="bg-blue-400 h-full"
                      style={{ width: `${(st.inFlight / (st.total || 1)) * 100}%` }}
                      title={`In Pipeline: ${st.inFlight}`}
                    />
                    <div
                      className="bg-rose-400 h-full"
                      style={{ width: `${(st.lost / (st.total || 1)) * 100}%` }}
                      title={`Lost: ${st.lost}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 font-mono">
                    <span className="text-emerald-700 font-semibold">{st.converted} enrolled</span>
                    <span className="text-blue-700 font-semibold">{st.inFlight} in-flight</span>
                    <span className="text-rose-700 font-semibold">{st.lost} lost</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lost Reasons Distribution Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Lost Opportunity Root Causes
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Loss analysis</span>
          </div>

          {Object.keys(metrics.lostReasons).length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs italic">
              No lost leads recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(metrics.lostReasons).map(([reason, count]) => {
                const totalLost = metrics.stageCounts['lost'] || 1;
                const reasonPct = Math.round((count / totalLost) * 100);

                return (
                  <div key={reason} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 capitalize">
                        {reason.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{count} leads</span>
                        <span className="font-mono text-slate-500 text-[11px]">({reasonPct}%)</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${reasonPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
