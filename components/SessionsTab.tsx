'use client';

import React, { useState } from 'react';
import type { UserRole } from '@/components/Navbar';
import { apiFetch } from '@/lib/api';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  UserCheck,
  Calendar,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  BellRing,
  RotateCcw,
  Check,
  Shield,
} from 'lucide-react';
import { SessionItem } from '@/src/services/tutoringService';
import { formatDateTime, formatRupiah, nowWitaInput } from '@/lib/formatters';
import { WeeklyTimetableMatrix } from './WeeklyTimetableMatrix';

interface SessionsTabProps {
  sessions: SessionItem[];
  currentRole: UserRole;
  selectedTeacherId?: string;
  masterData: any;
  onRefresh: () => void;
}

export const SessionsTab: React.FC<SessionsTabProps> = ({
  sessions,
  currentRole,
  selectedTeacherId,
  masterData,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');
  const [filterTeacher, setFilterTeacher] = useState<string>(
    currentRole === 'teacher' && selectedTeacherId ? selectedTeacherId : 'all'
  );
  const [statusFilter, setStatusFilter] = useState('all');

  // Check-In Modal
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [checkInOutcome, setCheckInOutcome] = useState<'held' | 'teacher_absent'>('held');
  const [attendeeOutcomes, setAttendeeOutcomes] = useState<Record<string, 'attended' | 'no_show'>>({});
  const [adminBypass, setAdminBypass] = useState((currentRole === 'admin' || currentRole === 'master_admin'));

  // Notice Modal
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [activeAttendance, setActiveAttendance] = useState<{ id: string; studentName: string; sessionTime: string } | null>(null);
  const [noticeTime, setNoticeTime] = useState(nowWitaInput());

  // Make-Up Modal
  const [isMakeUpOpen, setIsMakeUpOpen] = useState(false);
  const [makeUpTargetAttId, setMakeUpTargetAttId] = useState('');
  const [makeUpDateTime, setMakeUpDateTime] = useState('2026-10-05T16:00');

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If role is teacher, lock or prioritize selected teacher
  const effectiveTeacherFilter = currentRole === 'teacher' && selectedTeacherId ? selectedTeacherId : filterTeacher;

  const filteredSessions = sessions.filter((s) => {
    const matchesTeacher = effectiveTeacherFilter === 'all' || s.teacher_id === effectiveTeacherFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesTeacher && matchesStatus;
  });

  const handleOpenCheckIn = (s: SessionItem) => {
    setActiveSession(s);
    setCheckInOutcome('held');
    setErrorMessage('');
    const initialAttendees: Record<string, 'attended' | 'no_show'> = {};
    s.attendees.forEach((a) => {
      // Default to attended unless notice was late
      initialAttendees[a.student_id] = a.notice_received_at ? 'no_show' : 'attended';
    });
    setAttendeeOutcomes(initialAttendees);
    setIsCheckInOpen(true);
  };

  const handleExecuteCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkin_session',
          payload: {
            session_id: activeSession.id,
            outcome: checkInOutcome,
            attendees: checkInOutcome === 'held' ? attendeeOutcomes : null,
            admin: adminBypass,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsCheckInOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAttendance) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_notice',
          payload: {
            attendance_id: activeAttendance.id,
            received_at: noticeTime,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Notice recorded! Outcome calculated: ${data.outcome}`);
      setIsNoticeOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookMakeUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!makeUpTargetAttId) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'book_makeup',
          payload: {
            orig_attendance_id: makeUpTargetAttId,
            scheduled_at: makeUpDateTime,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert('Make-up class successfully booked with unconsumed invoice credit!');
      setIsMakeUpOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-slate-900">
      {/* Controls & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {currentRole !== 'teacher' && (
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#6dd95d]"
            >
              <option value="all">All Teachers</option>
              {masterData.teachers.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#6dd95d]"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled (Pending Check-in)</option>
            <option value="held">Held</option>
            <option value="teacher_absent">Teacher Absent</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cards View
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center space-x-1 ${
                viewMode === 'matrix'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              <span>Weekly Calendar Matrix</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <span>Showing <strong className="text-slate-900">{filteredSessions.length}</strong> sessions</span>
        </div>
      </div>

      {/* Main View: Matrix View vs Cards Grid */}
      {viewMode === 'matrix' ? (
        <WeeklyTimetableMatrix
          sessions={filteredSessions}
          currentRole={currentRole}
          selectedTeacherId={selectedTeacherId}
          masterData={masterData}
          onRefresh={onRefresh}
          onSelectSession={(s) => handleOpenCheckIn(s)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSessions.map((s) => {
          const isHeld = s.status === 'held';
          const isAbsent = s.status === 'teacher_absent';
          const isCancelled = s.status === 'cancelled';
          const isScheduled = s.status === 'scheduled';
          const isLocked = !!s.payroll_run_id;

          return (
            <div
              key={s.id}
              className={`bg-white border rounded-2xl p-5 shadow-xs space-y-4 transition flex flex-col justify-between text-slate-900 ${
                isLocked ? 'border-[#c1a9e6]/50 bg-purple-50/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Top Badge & Session Code */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                      {s.code}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {s.class_type}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {isLocked && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#c1a9e6]/25 text-purple-950 border border-[#c1a9e6]/40">
                        Payroll Locked
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        isHeld
                          ? 'bg-[#6dd95d]/20 text-emerald-950 border border-[#6dd95d]/40'
                          : isScheduled
                          ? 'bg-[#65acff]/20 text-blue-950 border border-[#65acff]/40'
                          : isAbsent
                          ? 'bg-[#f77f73]/20 text-rose-950 border border-[#f77f73]/40'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                </div>

                {/* Date & Subject */}
                <div className="mt-3">
                  <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-600" />
                    <span>{formatDateTime(s.scheduled_start)}</span>
                  </div>
                  <div className="text-xs text-slate-800 font-bold mt-1">
                    {s.subject_name} ({s.curriculum_name} — {s.level_name})
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Teacher: <span className="text-slate-800 font-semibold">{s.teacher_name}</span> | Pay:{' '}
                    <span className="font-mono text-emerald-800 font-bold">{formatRupiah(s.teacher_pay_amount)}</span>
                  </div>
                </div>

                {/* Attendees Roster */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Student Attendees:
                  </span>
                  <div className="mt-1.5 space-y-1.5">
                    {s.attendees.map((att) => (
                      <div
                        key={att.attendance_id}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{att.student_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Slot #{att.sequence_no} • {att.student_code}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              att.outcome === 'attended'
                                ? 'bg-[#6dd95d]/20 text-emerald-950'
                                : att.outcome === 'no_show'
                                ? 'bg-[#f77f73]/20 text-rose-950'
                                : att.outcome === 'cancelled_notice'
                                ? 'bg-[#fdb01b]/20 text-amber-950'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {att.outcome}
                          </span>

                          {/* Quick Notice logger for scheduled sessions */}
                          {isScheduled && !isLocked && (
                            <button
                              onClick={() => {
                                setActiveAttendance({
                                  id: att.attendance_id,
                                  studentName: att.student_name,
                                  sessionTime: formatDateTime(s.scheduled_start),
                                });
                                setIsNoticeOpen(true);
                              }}
                              className="p-1 hover:bg-slate-200 text-slate-500 hover:text-amber-800 rounded transition"
                              title="Log Cancellation Notice"
                            >
                              <BellRing className="h-3 w-3" />
                            </button>
                          )}

                          {/* If released (cancelled_notice or void), allow admin make-up booking */}
                          {(att.outcome === 'cancelled_notice' || att.outcome === 'void') && (currentRole === 'admin' || currentRole === 'master_admin') && (
                            <button
                              onClick={() => {
                                setMakeUpTargetAttId(att.attendance_id);
                                setIsMakeUpOpen(true);
                              }}
                              className="p-1 hover:bg-slate-200 text-blue-700 rounded transition"
                              title="Schedule Make-up"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button: Check In */}
              <div className="pt-3 border-t border-slate-100">
                {isScheduled && !isLocked ? (
                  <button
                    onClick={() => handleOpenCheckIn(s)}
                    className="w-full py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Check In Session</span>
                  </button>
                ) : isLocked ? (
                  <div className="text-center py-1.5 text-xs text-slate-500 italic bg-slate-100 rounded-xl border border-slate-200">
                    Frozen by Locked Payroll
                  </div>
                ) : (
                  <div className="text-center py-1.5 text-xs text-slate-500 bg-slate-100 rounded-xl">
                    Completed
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* MODAL: Check In Session */}
      {isCheckInOpen && activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Session Check-In Console</h3>
                <p className="text-xs text-slate-500">
                  {activeSession.code} • {activeSession.subject_name} • {formatDateTime(activeSession.scheduled_start)}
                </p>
              </div>
              <button onClick={() => setIsCheckInOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-[#f77f73]/15 border border-[#f77f73]/30 text-rose-900 text-xs rounded-xl flex items-center space-x-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleExecuteCheckIn} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Session Status Outcome *</label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setCheckInOutcome('held')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      checkInOutcome === 'held'
                        ? 'bg-[#6dd95d]/25 border-[#6dd95d] text-emerald-950'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Held (Conducted)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCheckInOutcome('teacher_absent')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      checkInOutcome === 'teacher_absent'
                        ? 'bg-[#f77f73]/25 border-[#f77f73] text-rose-950'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Teacher Absent (Voided)</span>
                  </button>
                </div>
              </div>

              {/* Attendee Status Toggles if Held */}
              {checkInOutcome === 'held' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Student Attendance Outcomes *</label>
                  <p className="text-[11px] text-slate-500">
                    Rule: Held sessions require ≥ 1 credit-consuming attendee. Single attendee in a group still runs at group rate.
                  </p>

                  <div className="space-y-2 pt-1">
                    {activeSession.attendees.map((a) => (
                      <div
                        key={a.student_id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{a.student_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {a.student_code}
                            {a.notice_received_at && (
                              <span className="text-amber-800 ml-1.5 font-sans font-semibold">(Late notice logged)</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              setAttendeeOutcomes({ ...attendeeOutcomes, [a.student_id]: 'attended' })
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              attendeeOutcomes[a.student_id] === 'attended'
                                ? 'bg-[#6dd95d] text-slate-950'
                                : 'bg-slate-200 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Attended
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAttendeeOutcomes({ ...attendeeOutcomes, [a.student_id]: 'no_show' })
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              attendeeOutcomes[a.student_id] === 'no_show'
                                ? 'bg-[#f77f73] text-white'
                                : 'bg-slate-200 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            No Show
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin check-in window bypass */}
              {(currentRole === 'admin' || currentRole === 'master_admin') && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div className="text-slate-700">
                    <span className="font-bold text-blue-900">Admin Bypass Mode</span>
                    <p className="text-[10px] text-slate-500">Bypass the -15 min / +2 day check-in window constraint</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={adminBypass}
                    onChange={(e) => setAdminBypass(e.target.checked)}
                    className="h-4 w-4 text-[#6dd95d] rounded bg-white border-slate-300 cursor-pointer"
                  />
                </div>
              )}

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCheckInOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl shadow-xs"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Check-In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Notice */}
      {isNoticeOpen && activeAttendance && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-amber-800">Log Student Cancellation Notice</h3>
              <button onClick={() => setIsNoticeOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              Student: <span className="font-bold text-slate-900">{activeAttendance.studentName}</span>
              <br />
              Session Time: <span className="font-mono text-blue-700">{activeAttendance.sessionTime}</span>
            </p>

            <form onSubmit={handleRecordNotice} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Notice Received Timestamp (GMT+8) *</label>
                <input
                  type="datetime-local"
                  required
                  value={noticeTime}
                  onChange={(e) => setNoticeTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                />
              </div>

              <div className="p-3 bg-[#fdb01b]/15 border border-[#fdb01b]/30 rounded-xl text-xs text-amber-950 space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Notice Boundary Rule</span>
                </div>
                <p>
                  ≥ 4 hours notice $\rightarrow$ Marks <code className="font-mono">cancelled_notice</code>. Credit is kept, private session auto-cancelled, teacher unpaid.
                  <br />
                  &lt; 4 hours notice $\rightarrow$ Too late; check-in converts to <code className="font-mono">no_show</code> (credit used, teacher paid).
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNoticeOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#fdb01b] hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl"
                >
                  {isSubmitting ? 'Processing...' : 'Record Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Book Make-Up */}
      {isMakeUpOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Book Make-Up Session (FR-7.9)</h3>
              <button onClick={() => setIsMakeUpOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              Draws on released credits from <code className="text-blue-700 font-mono">cancelled_notice</code> or <code className="text-blue-700 font-mono">void</code>. Verifies unconsumed credits remain on that invoice.
            </p>

            <form onSubmit={handleBookMakeUp} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Make-Up Target Datetime (GMT+8) *</label>
                <input
                  type="datetime-local"
                  required
                  value={makeUpDateTime}
                  onChange={(e) => setMakeUpDateTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsMakeUpOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl shadow-xs"
                >
                  {isSubmitting ? 'Allocating...' : 'Schedule Make-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
