'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  UserPlus,
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Phone,
  Tag,
  Search,
  Filter,
  UserCheck,
  ChevronRight,
  AlertCircle,
  Clock,
  Sparkles,
  Building,
  LayoutGrid,
  GitMerge,
  BarChart2,
} from 'lucide-react';
import { Lead } from '@/src/services/tutoringService';
import { formatDateTime, tomorrowWitaInput } from '@/lib/formatters';
import { LeadFlowDiagram } from './LeadFlowDiagram';
import { LeadFlowChart } from './LeadFlowChart';

interface LeadsTabProps {
  leads: Lead[];
  masterData: any;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}

const STAGES = [
  { id: 'new', label: 'New Lead', color: 'border-slate-300 text-slate-800 bg-slate-100' },
  { id: 'contacted', label: 'Contacted', color: 'border-[#65acff]/40 text-blue-950 bg-[#65acff]/20' },
  { id: 'trial_booked', label: 'Trial Booked', color: 'border-[#c1a9e6]/40 text-purple-950 bg-[#c1a9e6]/20' },
  { id: 'trial_attended', label: 'Trial Attended', color: 'border-[#fdce1b]/40 text-amber-950 bg-[#fdce1b]/25' },
  { id: 'offer_made', label: 'Offer Made', color: 'border-[#fdb01b]/40 text-amber-950 bg-[#fdb01b]/25' },
  { id: 'converted', label: 'Converted Deal', color: 'border-[#6dd95d]/40 text-emerald-950 bg-[#6dd95d]/25' },
  { id: 'lost', label: 'Lost', color: 'border-[#f77f73]/40 text-rose-950 bg-[#f77f73]/25' },
];

export const LeadsTab: React.FC<LeadsTabProps> = ({
  leads,
  masterData,
  onRefresh,
  onNavigateTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'diagram' | 'chart'>('kanban');

  // Modals state
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isBookTrialOpen, setIsBookTrialOpen] = useState(false);
  const [isTrialOutcomeOpen, setIsTrialOutcomeOpen] = useState(false);
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Forms state
  const [leadForm, setLeadForm] = useState({
    name: '',
    guardian_name: '',
    contact: '',
    source_channel: 'instagram',
    campaign_name: 'Instagram Jul-Sep',
  });

  const [trialForm, setTrialForm] = useState({
    teacher_id: masterData.teachers[0]?.id || '',
    subject_id: masterData.subjects[0]?.id || '',
    curriculum_id: masterData.curricula[0]?.id || '',
    level_id: masterData.levels[0]?.id || '',
    scheduled_at: tomorrowWitaInput('16:00'),
  });

  const [trialOutcomeForm, setTrialOutcomeForm] = useState({
    outcome: 'attended',
    feedback: '',
  });

  const [lostReason, setLostReason] = useState('price');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter leads
  const filteredLeads = leads
    .filter((l) => {
      const matchesSearch =
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.guardian_name && l.guardian_name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesChannel = selectedChannel === 'all' || l.source_channel === selectedChannel;
      return matchesSearch && matchesChannel;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  // Action handlers
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_lead',
          payload: leadForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsNewLeadOpen(false);
      setLeadForm({
        name: '',
        guardian_name: '',
        contact: '',
        source_channel: 'instagram',
        campaign_name: 'Instagram Jul-Sep',
      });
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStage = async (leadId: string, toStage: string) => {
    setErrorMessage('');
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_lead_stage',
          payload: { lead_id: leadId, to_stage: toStage },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRefresh();
    } catch (err: any) {
      alert(`Error updating stage: ${err.message}`);
    }
  };

  const handleBookTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'book_trial',
          payload: {
            lead_id: selectedLead.id,
            ...trialForm,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsBookTrialOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertLead = async (lead: Lead) => {
    setErrorMessage('');
    if (!confirm(`Convert lead ${lead.name} (${lead.code}) to Student? This triggers idempotent student record creation.`)) return;
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'convert_lead',
          payload: { lead_id: lead.id },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Student successfully converted! Student ID created.`);
      onRefresh();
    } catch (err: any) {
      alert(`Error converting lead: ${err.message}`);
    }
  };

  const handleMarkLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_lead_stage',
          payload: {
            lead_id: selectedLead.id,
            to_stage: 'lost',
            lost_reason: lostReason,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsLostModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-slate-900">
      {/* Control Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-1 items-center space-x-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student or parent name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#6dd95d]"
            />
          </div>

          {/* Channel Filter */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#6dd95d]"
          >
            <option value="all">All Channels</option>
            <option value="instagram">Instagram</option>
            <option value="referral">Referral</option>
            <option value="event">School Fair / Event</option>
          </select>
        </div>

        <button
          onClick={() => setIsNewLeadOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl shadow-xs transition whitespace-nowrap"
        >
          <UserPlus className="h-4 w-4" />
          <span>New Lead Inquiry</span>
        </button>
      </div>

      {/* Sub-view Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'kanban'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Kanban Board</span>
          </button>
          <button
            onClick={() => setViewMode('diagram')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'diagram'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Lead Flow Diagram</span>
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'chart'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Lead Flow Chart & Funnel</span>
          </button>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Total Leads: <strong className="text-slate-900 font-mono">{filteredLeads.length}</strong>
        </span>
      </div>

      {/* 1. Lead Flow Diagram View */}
      {viewMode === 'diagram' && (
        <LeadFlowDiagram
          leads={filteredLeads}
          onSelectLead={setSelectedLead}
          onUpdateStage={handleUpdateStage}
          onBookTrial={(lead) => {
            setSelectedLead(lead);
            setIsBookTrialOpen(true);
          }}
          onTrialOutcome={(lead) => {
            setSelectedLead(lead);
            setIsTrialOutcomeOpen(true);
          }}
          onConvert={handleConvertLead}
          onMarkLost={(lead) => {
            setSelectedLead(lead);
            setIsLostModalOpen(true);
          }}
        />
      )}

      {/* 2. Lead Flow Chart & Funnel View */}
      {viewMode === 'chart' && (
        <LeadFlowChart leads={filteredLeads} />
      )}

      {/* 3. Traditional Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageLeads = filteredLeads.filter((l) => l.current_stage === stage.id);
          return (
            <div key={stage.id} className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col min-w-[240px] shadow-xs">
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${stage.color.split(' ')[0]}`} />
                  <span className="text-xs font-bold text-slate-900">{stage.label}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {stageLeads.length}
                </span>
              </div>

              {/* Lead Cards List */}
              <div className="mt-3 space-y-2.5 flex-1 overflow-y-auto max-h-[70vh] pr-0.5">
                {stageLeads.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs italic">
                    No leads
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-3 shadow-xs transition space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono text-[10px] font-bold text-slate-600">
                            {lead.code}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 leading-tight mt-0.5">
                            {lead.name}
                          </h4>
                          {lead.guardian_name && (
                            <p className="text-[11px] text-slate-500">
                              Parent: {lead.guardian_name}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-medium capitalize px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                          {lead.source_channel}
                        </span>
                      </div>

                      {/* Contact & Campaign */}
                      <div className="text-[10px] text-slate-500 space-y-0.5 border-t border-slate-200 pt-1.5">
                        {lead.contact && (
                          <div className="flex items-center space-x-1.5">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{lead.contact}</span>
                          </div>
                        )}
                        {lead.campaign_name && (
                          <div className="flex items-center space-x-1.5 text-slate-500 truncate">
                            <Tag className="h-3 w-3 text-slate-400" />
                            <span className="truncate">{lead.campaign_name}</span>
                          </div>
                        )}
                        {lead.lost_reason && (
                          <div className="text-rose-700 font-semibold">
                            Reason: {lead.lost_reason}
                          </div>
                        )}
                        {lead.student_code && (
                          <div className="text-emerald-800 font-bold font-mono">
                            Student: {lead.student_code}
                          </div>
                        )}
                      </div>

                      {/* Contextual Action Buttons */}
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1">
                        {lead.current_stage === 'new' && (
                          <button
                            onClick={() => handleUpdateStage(lead.id, 'contacted')}
                            className="w-full py-1 text-[11px] bg-[#65acff]/20 hover:bg-[#65acff]/30 text-blue-950 font-bold rounded-lg transition"
                          >
                            Mark Contacted
                          </button>
                        )}

                        {['new', 'contacted'].includes(lead.current_stage) && (
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsBookTrialOpen(true);
                            }}
                            className="w-full py-1 text-[11px] bg-[#c1a9e6]/25 hover:bg-[#c1a9e6]/35 text-purple-950 font-bold rounded-lg transition flex items-center justify-center space-x-1"
                          >
                            <Calendar className="h-3 w-3" />
                            <span>Book Trial</span>
                          </button>
                        )}

                        {lead.current_stage === 'trial_booked' && (
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsTrialOutcomeOpen(true);
                            }}
                            className="w-full py-1 text-[11px] bg-[#fdce1b]/25 hover:bg-[#fdce1b]/35 text-amber-950 font-bold rounded-lg transition"
                          >
                            Record Trial Outcome
                          </button>
                        )}

                        {lead.current_stage === 'trial_attended' && (
                          <button
                            onClick={() => handleUpdateStage(lead.id, 'offer_made')}
                            className="w-full py-1 text-[11px] bg-[#fdb01b]/25 hover:bg-[#fdb01b]/35 text-amber-950 font-bold rounded-lg transition"
                          >
                            Make Offer
                          </button>
                        )}

                        {['offer_made', 'trial_attended'].includes(lead.current_stage) && (
                          <button
                            onClick={() => handleConvertLead(lead)}
                            className="w-full py-1 text-[11px] bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 font-bold rounded-lg transition flex items-center justify-center space-x-1"
                          >
                            <UserCheck className="h-3 w-3" />
                            <span>Convert to Student</span>
                          </button>
                        )}

                        {lead.current_stage !== 'lost' && lead.current_stage !== 'converted' && (
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsLostModalOpen(true);
                            }}
                            className="text-[10px] text-slate-500 hover:text-rose-700 py-0.5 px-1 font-medium transition"
                          >
                            Mark Lost...
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* MODAL: New Lead */}
      {isNewLeadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Create New Lead</h3>
              <button onClick={() => setIsNewLeadOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-[#f77f73]/15 border border-[#f77f73]/30 text-rose-900 text-xs rounded-xl font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Student Name *</label>
                <input
                  type="text"
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                  placeholder="e.g. Amanda Putri"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Parent / Guardian Name</label>
                <input
                  type="text"
                  value={leadForm.guardian_name}
                  onChange={(e) => setLeadForm({ ...leadForm, guardian_name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                  placeholder="e.g. Ibu Amanda"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Contact (WhatsApp / Phone)</label>
                <input
                  type="text"
                  value={leadForm.contact}
                  onChange={(e) => setLeadForm({ ...leadForm, contact: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                  placeholder="+62 811 0000 1234"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Source Channel *</label>
                  <select
                    value={leadForm.source_channel}
                    onChange={(e) => setLeadForm({ ...leadForm, source_channel: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#6dd95d]"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="referral">Referral</option>
                    <option value="event">School Fair / Event</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Campaign</label>
                  <select
                    value={leadForm.campaign_name}
                    onChange={(e) => setLeadForm({ ...leadForm, campaign_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#6dd95d]"
                  >
                    <option value="Instagram Jul-Sep">Instagram Jul-Sep</option>
                    <option value="Referral">Referral</option>
                    <option value="School fair Aug">School fair Aug</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewLeadOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl transition shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Book Trial */}
      {isBookTrialOpen && selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Book Trial Session</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lead: <span className="text-slate-900 font-bold">{selectedLead.name}</span> ({selectedLead.code})
                </p>
              </div>
              <button onClick={() => setIsBookTrialOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-[#f77f73]/15 border border-[#f77f73]/30 text-rose-900 text-xs rounded-xl flex items-center space-x-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleBookTrial} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Teacher *</label>
                <select
                  value={trialForm.teacher_id}
                  onChange={(e) => setTrialForm({ ...trialForm, teacher_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                >
                  {masterData.teachers.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Curriculum *</label>
                  <select
                    value={trialForm.curriculum_id}
                    onChange={(e) => setTrialForm({ ...trialForm, curriculum_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                  >
                    {masterData.curricula.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Level *</label>
                  <select
                    value={trialForm.level_id}
                    onChange={(e) => setTrialForm({ ...trialForm, level_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                  >
                    {masterData.levels
                      .filter((l: any) => l.curriculum_id === trialForm.curriculum_id)
                      .map((l: any) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Subject *</label>
                <select
                  value={trialForm.subject_id}
                  onChange={(e) => setTrialForm({ ...trialForm, subject_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                >
                  {masterData.subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Trial Date & Time (GMT+8) *</label>
                <input
                  type="datetime-local"
                  required
                  value={trialForm.scheduled_at}
                  onChange={(e) => setTrialForm({ ...trialForm, scheduled_at: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                />
              </div>

              <div className="p-3 bg-[#65acff]/15 border border-[#65acff]/30 rounded-xl text-xs text-blue-950 space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <span>Rule Verification</span>
                </div>
                <p>
                  Trial rate is snapshotted at 50% of the private teacher rate. Includes schedule collision prevention.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsBookTrialOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl transition shadow-xs"
                >
                  {isSubmitting ? 'Checking & Booking...' : 'Confirm Trial Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Trial Outcome */}
      {isTrialOutcomeOpen && selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Record Trial Attendance Outcome</h3>
              <button onClick={() => setIsTrialOutcomeOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Outcome *</label>
                <select
                  value={trialOutcomeForm.outcome}
                  onChange={(e) => setTrialOutcomeForm({ ...trialOutcomeForm, outcome: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                >
                  <option value="attended">Attended (Lead advances to &apos;trial_attended&apos;)</option>
                  <option value="no_show">No Show</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Teacher / Academic Feedback</label>
                <textarea
                  rows={3}
                  value={trialOutcomeForm.feedback}
                  onChange={(e) => setTrialOutcomeForm({ ...trialOutcomeForm, feedback: e.target.value })}
                  placeholder="Notes on student diagnostic, motivation, curriculum fit..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsTrialOutcomeOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // Fetch latest trial for lead
                    const res = await apiFetch(`/api/data?type=lead_details&id=${selectedLead.id}`);
                    const d = await res.json();
                    if (d.trials && d.trials.length > 0) {
                      await apiFetch('/api/data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'set_trial_outcome',
                          payload: {
                            trial_id: d.trials[0].id,
                            outcome: trialOutcomeForm.outcome,
                            feedback: trialOutcomeForm.feedback,
                          },
                        }),
                      });
                      setIsTrialOutcomeOpen(false);
                      onRefresh();
                    } else {
                      alert('No trial found for this lead.');
                    }
                  }}
                  className="px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Outcome
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Mark Lost (Requires reason) */}
      {isLostModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-rose-700">Mark Lead as Lost</h3>
              <button onClick={() => setIsLostModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              Under PRD check constraint <code className="text-amber-800 font-mono">leads_lost_check</code>, moving to <span className="font-bold text-rose-700">&apos;lost&apos;</span> strictly requires a valid reason.
            </p>

            <form onSubmit={handleMarkLost} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Lost Reason *</label>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none"
                >
                  <option value="price">Price / Budget</option>
                  <option value="no response">No Response / Unreachable</option>
                  <option value="trial no-show">Trial No-Show</option>
                  <option value="chose another provider">Chose Another Provider</option>
                  <option value="schedule conflict">Schedule Incompatible</option>
                  <option value="moved away">Relocated / Moved Away</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLostModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#f77f73] hover:bg-rose-600 text-white text-xs font-bold rounded-xl"
                >
                  {isSubmitting ? 'Updating...' : 'Confirm Lost'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
