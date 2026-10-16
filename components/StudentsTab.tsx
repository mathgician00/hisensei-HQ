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
import { SortHeader } from './SortHeader';

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

  // Sort State - Default is student name ASC per specification
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      if (['balance', 'purchased', 'consumed'].includes(field)) {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

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

  const filteredStudents = students
    .filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.guardian_name && s.guardian_name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
          break;
        case 'code':
          comparison = (a.code || '').localeCompare(b.code || '');
          break;
        case 'guardian_name':
          comparison = (a.guardian_name || '').localeCompare(b.guardian_name || '', undefined, { sensitivity: 'base' });
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'class_code':
          comparison = (a.class_code || '').localeCompare(b.class_code || '');
          break;
        case 'purchased':
          comparison = (a.purchased || 0) - (b.purchased || 0);
          break;
        case 'consumed':
          comparison = (a.consumed || 0) - (b.consumed || 0);
          break;
        case 'balance':
          comparison = (a.balance || 0) - (b.balance || 0);
          break;
        default:
          comparison = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }

      if (comparison !== 0) {
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
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
    <div className="space-y-6 pb-12 text-slate-900">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-1 items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or S-code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#6dd95d]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#6dd95d]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="postponed">Postponed</option>
            <option value="churned">Churned</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <span>Showing <strong className="text-slate-900">{filteredStudents.length}</strong> of {students.length} students</span>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">
                  <SortHeader label="Student ID & Name" field="name" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                </th>
                <th className="py-3 px-4">
                  <SortHeader label="Guardian / Contact" field="guardian_name" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                </th>
                <th className="py-3 px-4">
                  <SortHeader label="Status" field="status" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                </th>
                <th className="py-3 px-4">
                  <SortHeader label="Active Class" field="class_code" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                </th>
                <th className="py-3 px-4 text-center">
                  <SortHeader label="Purchased" field="purchased" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" />
                </th>
                <th className="py-3 px-4 text-center">
                  <SortHeader label="Consumed" field="consumed" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" />
                </th>
                <th className="py-3 px-4 text-center font-bold">
                  <SortHeader label="Credit Balance" field="balance" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" />
                </th>
                <th className="py-3 px-4 text-right text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                    No students match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const balance = s.balance ?? 0;
                  const isLow = s.status === 'active' && s.purchased && s.purchased > 0 && balance <= 1;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-slate-700">{s.code}</span>
                          <span className="font-semibold text-slate-900">{s.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Joined {formatDateOnly(s.created_at)}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {s.guardian_name || '—'}
                      </td>

                      <td className="py-3 px-4">
                        {s.status === 'active' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-[#6dd95d]/20 text-emerald-950 border border-[#6dd95d]/40 rounded-full">
                            Active
                          </span>
                        )}
                        {s.status === 'postponed' && (
                          <div>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#fdb01b]/20 text-amber-950 border border-[#fdb01b]/40 rounded-full">
                              Postponed
                            </span>
                            {s.expected_return_date && (
                              <div className="text-[10px] text-amber-800 mt-0.5 font-mono">
                                Return: {formatDateOnly(s.expected_return_date)}
                              </div>
                            )}
                          </div>
                        )}
                        {s.status === 'churned' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-[#f77f73]/20 text-rose-950 border border-[#f77f73]/40 rounded-full">
                            Churned
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {s.class_code ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-xs text-blue-700 font-bold">{s.class_code}</span>
                            <span className="capitalize text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                              {s.class_type}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => onNavigateTab('classes')}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline"
                          >
                            + Enroll in class
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-700">
                        {s.purchased ?? 0}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-700">
                        {s.consumed ?? 0}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                            balance <= 0
                              ? 'bg-[#f77f73]/20 text-rose-950 border border-[#f77f73]/40'
                              : isLow
                              ? 'bg-[#fdb01b]/20 text-amber-950 border border-[#fdb01b]/40'
                              : 'bg-[#6dd95d]/20 text-emerald-950 border border-[#6dd95d]/40'
                          }`}
                        >
                          {balance} {balance === 1 ? 'credit' : 'credits'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetails(s.id)}
                          className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                        >
                          Ledger
                        </button>

                        <button
                          onClick={() => handleOpenStatusModal(s)}
                          className="px-2.5 py-1 text-[11px] bg-[#fdb01b]/20 hover:bg-[#fdb01b]/30 text-amber-950 font-bold rounded-lg transition"
                        >
                          Status
                        </button>

                        {s.enrollment_id && (
                          <button
                            onClick={() => onSelectStudentForInvoice(s.id, s.enrollment_id!)}
                            className="px-2.5 py-1 text-[11px] bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 font-bold rounded-lg transition"
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

      {/* MODAL: Status Change */}
      {isStatusModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Update Student Status</h3>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              Student: <span className="font-bold text-slate-900">{selectedStudent.name}</span> ({selectedStudent.code})
            </p>

            {errorMessage && (
              <div className="p-3 bg-[#f77f73]/15 border border-[#f77f73]/30 text-rose-900 text-xs rounded-xl flex items-center space-x-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Target Status *</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as any)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                >
                  <option value="active">Active (Resume sessions & pending slots)</option>
                  <option value="postponed">Postponed (Requires return date ≤ 3 months)</option>
                  <option value="churned">Churned (Inactive/Left)</option>
                </select>
              </div>

              {targetStatus === 'postponed' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Expected Return Date * (Max 3 months per PRD rule)
                  </label>
                  <input
                    type="date"
                    required
                    value={postponementReturnDate}
                    onChange={(e) => setPostponementReturnDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                  />
                  <p className="text-[11px] text-amber-800 mt-1">
                    * If student stays postponed beyond 3 months, automated job <code className="font-mono">fn_expire_postponements</code> transitions them to churned.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700">Reason / Notes</label>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Exam break, travel, medical leave..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl shadow-xs"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-5 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Student Profile & Attendance Ledger
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDetails.student.name} ({selectedDetails.student.code}) — {selectedDetails.student.status.toUpperCase()}
                </p>
              </div>
              <button onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {/* Attendance History */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Session Attendance History ({selectedDetails.attendances.length} slots)
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
                <table className="w-full text-left text-[11px] text-slate-700">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Date & Time</th>
                      <th className="py-2 px-3">Class</th>
                      <th className="py-2 px-3">Teacher</th>
                      <th className="py-2 px-3">Outcome</th>
                      <th className="py-2 px-3 text-center">Credit Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedDetails.attendances.map((att: any) => (
                      <tr key={att.id} className="hover:bg-slate-100/70">
                        <td className="py-1.5 px-3 font-mono">{formatDateOnly(att.scheduled_start)}</td>
                        <td className="py-1.5 px-3 font-mono text-blue-700 font-bold">{att.class_code}</td>
                        <td className="py-1.5 px-3">{att.teacher_name}</td>
                        <td className="py-1.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            att.outcome === 'attended'
                              ? 'bg-[#6dd95d]/20 text-emerald-950'
                              : att.outcome === 'no_show'
                              ? 'bg-[#f77f73]/20 text-rose-950'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {att.outcome}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          {att.consumes_credit ? (
                            <span className="text-emerald-800 font-bold">YES</span>
                          ) : (
                            <span className="text-slate-400">NO</span>
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
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Status Audit Log (Append-Only)
              </h4>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {selectedDetails.history.map((h: any) => (
                  <div key={h.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 capitalize">{h.status}</span>
                      <span className="text-slate-600 ml-2">Reason: {h.reason || 'None'}</span>
                    </div>
                    <div className="text-slate-500 text-[10px]">
                      Effective: {formatDateOnly(h.effective_from)} (Actor: {h.actor})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
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
