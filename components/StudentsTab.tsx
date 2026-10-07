'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  GraduationCap,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  CreditCard,
  UserX,
  UserCheck,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';
import { Student } from '@/src/services/tutoringService';
import { formatDateOnly } from '@/lib/formatters';

interface StudentsTabProps {
  students: Student[];
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
  onSelectStudentForInvoice: (studentId: string, enrollmentId: string) => void;
}

export const StudentsTab: React.FC<StudentsTabProps> = ({
  students,
  onRefresh,
  onNavigateTab,
  onSelectStudentForInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'postponed' | 'churned'>('all');

  // Status Change Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [targetStatus, setTargetStatus] = useState<'active' | 'postponed' | 'churned'>('postponed');
  const [postponementReturnDate, setPostponementReturnDate] = useState('2026-11-15');
  const [statusReason, setStatusReason] = useState('Family travel');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Student Details Drawer
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.guardian_name && s.guardian_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenStatusModal = (student: Student) => {
    setSelectedStudent(student);
    setTargetStatus(student.status === 'active' ? 'postponed' : 'active');
    setErrorMessage('');
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_student_status',
          payload: {
            student_id: selectedStudent.id,
            status: targetStatus,
            reason: statusReason,
            expected_return_date: targetStatus === 'postponed' ? postponementReturnDate : null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsStatusModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetails = async (studentId: string) => {
    try {
      const res = await apiFetch(`/api/data?type=student_details&id=${studentId}`);
      const data = await res.json();
      setSelectedDetails(data);
      setIsDetailsOpen(true);
    } catch (err: any) {
      alert(`Failed to load student details: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex flex-1 items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or S-code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="postponed">Postponed</option>
            <option value="churned">Churned</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>Showing <strong className="text-white">{filteredStudents.length}</strong> of {students.length} students</span>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Student ID & Name</th>
                <th className="py-3 px-4">Guardian / Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Active Class</th>
                <th className="py-3 px-4 text-center">Purchased</th>
                <th className="py-3 px-4 text-center">Consumed</th>
                <th className="py-3 px-4 text-center font-bold">Credit Balance</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                    No students match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const balance = s.balance ?? 0;
                  const isLow = s.status === 'active' && s.purchased && s.purchased > 0 && balance <= 1;

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-indigo-400">{s.code}</span>
                          <span className="font-semibold text-white">{s.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Joined {formatDateOnly(s.created_at)}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        {s.guardian_name || '—'}
                      </td>

                      <td className="py-3 px-4">
                        {s.status === 'active' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                            Active
                          </span>
                        )}
                        {s.status === 'postponed' && (
                          <div>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                              Postponed
                            </span>
                            {s.expected_return_date && (
                              <div className="text-[10px] text-amber-300/80 mt-0.5">
                                Return: {formatDateOnly(s.expected_return_date)}
                              </div>
                            )}
                          </div>
                        )}
                        {s.status === 'churned' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full">
                            Churned
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {s.class_code ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-xs text-cyan-300 font-semibold">{s.class_code}</span>
                            <span className="capitalize text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              {s.class_type}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => onNavigateTab('classes')}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                          >
                            + Enroll in class
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-300">
                        {s.purchased ?? 0}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-300">
                        {s.consumed ?? 0}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-full ${
                            balance <= 0
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {balance} {balance === 1 ? 'credit' : 'credits'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetails(s.id)}
                          className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition"
                        >
                          Ledger
                        </button>

                        <button
                          onClick={() => handleOpenStatusModal(s)}
                          className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-400 font-medium rounded-lg transition"
                        >
                          Status
                        </button>

                        {s.enrollment_id && (
                          <button
                            onClick={() => onSelectStudentForInvoice(s.id, s.enrollment_id!)}
                            className="px-2.5 py-1 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition"
                          >
                            Bill
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Status Change (Enforcing Postponement Constraints) */}
      {isStatusModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Update Student Status</h3>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Student: <span className="font-bold text-white">{selectedStudent.name}</span> ({selectedStudent.code})
            </p>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Target Status *</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as any)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="active">Active (Resume sessions & pending slots)</option>
                  <option value="postponed">Postponed (Requires return date ≤ 3 months)</option>
                  <option value="churned">Churned (Inactive/Left)</option>
                </select>
              </div>

              {targetStatus === 'postponed' && (
                <div>
                  <label className="text-xs font-medium text-slate-300">
                    Expected Return Date * (Max 3 months per PRD rule)
                  </label>
                  <input
                    type="date"
                    required
                    value={postponementReturnDate}
                    onChange={(e) => setPostponementReturnDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  />
                  <p className="text-[11px] text-amber-400 mt-1">
                    * If student stays postponed beyond 3 months, automated job <code className="font-mono">fn_expire_postponements</code> transitions them to churned.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-300">Reason / Notes</label>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Exam break, travel, medical leave..."
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                >
                  {isSubmitting ? 'Saving...' : 'Apply Status Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: Student Details & Attendance Ledger */}
      {isDetailsOpen && selectedDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white">
                  Student Profile & Attendance Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedDetails.student.name} ({selectedDetails.student.code}) — {selectedDetails.student.status.toUpperCase()}
                </p>
              </div>
              <button onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Attendance History */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Session Attendance History ({selectedDetails.attendances.length} slots)
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-800/40">
                <table className="w-full text-left text-[11px] text-slate-300">
                  <thead className="bg-slate-800 text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Date & Time</th>
                      <th className="py-2 px-3">Class</th>
                      <th className="py-2 px-3">Teacher</th>
                      <th className="py-2 px-3">Outcome</th>
                      <th className="py-2 px-3 text-center">Credit Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {selectedDetails.attendances.map((att: any) => (
                      <tr key={att.id} className="hover:bg-slate-800/60">
                        <td className="py-1.5 px-3 font-mono">{formatDateOnly(att.scheduled_start)}</td>
                        <td className="py-1.5 px-3 font-mono text-cyan-300">{att.class_code}</td>
                        <td className="py-1.5 px-3">{att.teacher_name}</td>
                        <td className="py-1.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            att.outcome === 'attended'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : att.outcome === 'no_show'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}>
                            {att.outcome}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          {att.consumes_credit ? (
                            <span className="text-emerald-400 font-bold">YES</span>
                          ) : (
                            <span className="text-slate-500">NO</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Status History */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Status Audit Log (Append-Only)
              </h4>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {selectedDetails.history.map((h: any) => (
                  <div key={h.id} className="p-2 rounded-lg bg-slate-800/50 border border-slate-800 text-[11px] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white capitalize">{h.status}</span>
                      <span className="text-slate-400 ml-2">Reason: {h.reason || 'None'}</span>
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      Effective: {formatDateOnly(h.effective_from)} (Actor: {h.actor})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
