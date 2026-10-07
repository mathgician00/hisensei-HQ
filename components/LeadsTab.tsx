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
} from 'lucide-react';
import { Lead } from '@/src/services/tutoringService';
import { formatDateTime, tomorrowWitaInput } from '@/lib/formatters';

interface LeadsTabProps {
  leads: Lead[];
  masterData: any;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}

const STAGES = [
  { id: 'new', label: 'New Lead', color: 'border-slate-500 text-slate-400 bg-slate-500/10' },
  { id: 'contacted', label: 'Contacted', color: 'border-blue-500 text-blue-400 bg-blue-500/10' },
  { id: 'trial_booked', label: 'Trial Booked', color: 'border-indigo-500 text-indigo-400 bg-indigo-500/10' },
  { id: 'trial_attended', label: 'Trial Attended', color: 'border-cyan-500 text-cyan-400 bg-cyan-500/10' },
  { id: 'offer_made', label: 'Offer Made', color: 'border-amber-500 text-amber-400 bg-amber-500/10' },
  { id: 'converted', label: 'Converted Deal', color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' },
  { id: 'lost', label: 'Lost', color: 'border-rose-500 text-rose-400 bg-rose-500/10' },
];

export const LeadsTab: React.FC<LeadsTabProps> = ({
  leads,
  masterData,
  onRefresh,
  onNavigateTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('all');

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
  const filteredLeads = leads.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.guardian_name && l.guardian_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesChannel = selectedChannel === 'all' || l.source_channel === selectedChannel;
    return matchesSearch && matchesChannel;
  });

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
    <div className="space-y-6 pb-12">
      {/* Control Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex flex-1 items-center space-x-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student or parent name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Channel Filter */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Channels</option>
            <option value="instagram">Instagram</option>
            <option value="referral">Referral</option>
            <option value="event">School Fair / Event</option>
          </select>
        </div>

        <button
          onClick={() => setIsNewLeadOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition whitespace-nowrap"
        >
          <UserPlus className="h-4 w-4" />
          <span>New Lead Inquiry</span>
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageLeads = filteredLeads.filter((l) => l.current_stage === stage.id);
          return (
            <div key={stage.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col min-w-[240px]">
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${stage.color.split(' ')[0]}`} />
                  <span className="text-xs font-bold text-slate-200">{stage.label}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                  {stageLeads.length}
                </span>
              </div>

              {/* Lead Cards List */}
              <div className="mt-3 space-y-2.5 flex-1 overflow-y-auto max-h-[70vh] pr-0.5">
                {stageLeads.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-xs italic">
                    No leads
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 rounded-xl p-3 shadow-sm transition space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono text-[10px] font-bold text-indigo-400">
                            {lead.code}
                          </span>
                          <h4 className="text-xs font-bold text-white leading-tight mt-0.5">
                            {lead.name}
                          </h4>
                          {lead.guardian_name && (
                            <p className="text-[11px] text-slate-400">
                              Parent: {lead.guardian_name}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-medium capitalize px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                          {lead.source_channel}
                        </span>
                      </div>

                      {/* Contact & Campaign */}
                      <div className="text-[10px] text-slate-400 space-y-0.5 border-t border-slate-700/50 pt-1.5">
                        {lead.contact && (
                          <div className="flex items-center space-x-1.5">
                            <Phone className="h-3 w-3 text-slate-500" />
                            <span>{lead.contact}</span>
                          </div>
                        )}
                        {lead.campaign_name && (
                          <div className="flex items-center space-x-1.5 text-slate-400 truncate">
                            <Tag className="h-3 w-3 text-slate-500" />
                            <span className="truncate">{lead.campaign_name}</span>
                          </div>
                        )}
                        {lead.lost_reason && (
                          <div className="text-rose-400 font-medium">
                            Reason: {lead.lost_reason}
                          </div>
                        )}
                        {lead.student_code && (
                          <div className="text-emerald-400 font-bold font-mono">
                            Student: {lead.student_code}
                          </div>
                        )}
                      </div>

                      {/* Contextual Action Buttons */}
                      <div className="pt-2 border-t border-slate-700/50 flex flex-wrap gap-1">
                        {lead.current_stage === 'new' && (
                          <button
                            onClick={() => handleUpdateStage(lead.id, 'contacted')}
                            className="w-full py-1 text-[11px] bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white font-medium rounded-lg transition"
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
                            className="w-full py-1 text-[11px] bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white font-medium rounded-lg transition flex items-center justify-center space-x-1"
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
                            className="w-full py-1 text-[11px] bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition"
                          >
                            Record Trial Outcome
                          </button>
                        )}

                        {lead.current_stage === 'trial_attended' && (
                          <button
                            onClick={() => handleUpdateStage(lead.id, 'offer_made')}
                            className="w-full py-1 text-[11px] bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition"
                          >
                            Make Offer
                          </button>
                        )}

                        {['offer_made', 'trial_attended'].includes(lead.current_stage) && (
                          <button
                            onClick={() => handleConvertLead(lead)}
                            className="w-full py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center space-x-1"
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
                            className="text-[10px] text-slate-500 hover:text-rose-400 py-0.5 px-1 transition"
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

      {/* MODAL: New Lead */}
      {isNewLeadOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Create New Lead</h3>
              <button onClick={() => setIsNewLeadOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Student Name *</label>
                <input
                  type="text"
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Amanda Putri"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Parent / Guardian Name</label>
                <input
                  type="text"
                  value={leadForm.guardian_name}
                  onChange={(e) => setLeadForm({ ...leadForm, guardian_name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Ibu Amanda"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Contact (WhatsApp / Phone)</label>
                <input
                  type="text"
                  value={leadForm.contact}
                  onChange={(e) => setLeadForm({ ...leadForm, contact: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="+62 811 0000 1234"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">Source Channel *</label>
                  <select
                    value={leadForm.source_channel}
                    onChange={(e) => setLeadForm({ ...leadForm, source_channel: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="referral">Referral</option>
                    <option value="event">School Fair / Event</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Campaign</label>
                  <select
                    value={leadForm.campaign_name}
                    onChange={(e) => setLeadForm({ ...leadForm, campaign_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md"
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white">Book Trial Session</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lead: <span className="text-white font-medium">{selectedLead.name}</span> ({selectedLead.code})
                </p>
              </div>
              <button onClick={() => setIsBookTrialOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleBookTrial} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Teacher *</label>
                <select
                  value={trialForm.teacher_id}
                  onChange={(e) => setTrialForm({ ...trialForm, teacher_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
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
                  <label className="text-xs font-medium text-slate-300">Curriculum *</label>
                  <select
                    value={trialForm.curriculum_id}
                    onChange={(e) => setTrialForm({ ...trialForm, curriculum_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  >
                    {masterData.curricula.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Level *</label>
                  <select
                    value={trialForm.level_id}
                    onChange={(e) => setTrialForm({ ...trialForm, level_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
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
                <label className="text-xs font-medium text-slate-300">Subject *</label>
                <select
                  value={trialForm.subject_id}
                  onChange={(e) => setTrialForm({ ...trialForm, subject_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  {masterData.subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Trial Date & Time (GMT+8) *</label>
                <input
                  type="datetime-local"
                  required
                  value={trialForm.scheduled_at}
                  onChange={(e) => setTrialForm({ ...trialForm, scheduled_at: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 space-y-1">
                <div className="font-semibold flex items-center space-x-1">
                  <Sparkles className="h-3.5 w-3.5" />
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md"
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Record Trial Attendance Outcome</h3>
              <button onClick={() => setIsTrialOutcomeOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Outcome *</label>
                <select
                  value={trialOutcomeForm.outcome}
                  onChange={(e) => setTrialOutcomeForm({ ...trialOutcomeForm, outcome: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="attended">Attended (Lead advances to &apos;trial_attended&apos;)</option>
                  <option value="no_show">No Show</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Teacher / Academic Feedback</label>
                <textarea
                  rows={3}
                  value={trialOutcomeForm.feedback}
                  onChange={(e) => setTrialOutcomeForm({ ...trialOutcomeForm, feedback: e.target.value })}
                  placeholder="Notes on student diagnostic, motivation, curriculum fit..."
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsTrialOutcomeOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
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
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl"
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-rose-400">Mark Lead as Lost</h3>
              <button onClick={() => setIsLostModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Under PRD check constraint <code className="text-amber-300 font-mono">leads_lost_check</code>, moving to <span className="font-semibold text-rose-400">&apos;lost&apos;</span> strictly requires a valid reason.
            </p>

            <form onSubmit={handleMarkLost} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Lost Reason *</label>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
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
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
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
