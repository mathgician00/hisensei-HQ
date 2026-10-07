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
    <div className="space-y-6 pb-12">
      {/* Controls & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-3">
          {currentRole !== 'teacher' && (
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
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
            className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled (Pending Check-in)</option>
            <option value="held">Held</option>
            <option value="teacher_absent">Teacher Absent</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>Showing <strong className="text-white">{filteredSessions.length}</strong> sessions</span>
        </div>
      </div>

      {/* Sessions Grid */}
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
              className={`bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4 transition flex flex-col justify-between ${
                isLocked ? 'border-indigo-500/40 bg-slate-900/90' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Top Badge & Session Code */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-extrabold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                      {s.code}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {s.class_type}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {isLocked && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Payroll Locked
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        isHeld
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isScheduled
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : isAbsent
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                </div>

                {/* Date & Subject */}
                <div className="mt-3">
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{formatDateTime(s.scheduled_start)}</span>
                  </div>
                  <div className="text-xs text-slate-300 font-semibold mt-1">
                    {s.subject_name} ({s.curriculum_name} — {s.level_name})
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Teacher: <span className="text-slate-200">{s.teacher_name}</span> | Pay:{' '}
                    <span className="font-mono text-emerald-400">{formatRupiah(s.teacher_pay_amount)}</span>
                  </div>
                </div>

                {/* Attendees Roster */}
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Student Attendees:
                  </span>
                  <div className="mt-1.5 space-y-1.5">
                    {s.attendees.map((att) => (
                      <div
                        key={att.attendance_id}
                        className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">{att.student_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Slot #{att.sequence_no} • {att.student_code}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              att.outcome === 'attended'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : att.outcome === 'no_show'
                                ? 'bg-rose-500/20 text-rose-400'
                                : att.outcome === 'cancelled_notice'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-700 text-slate-300'
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
                              className="p-1 hover:bg-slate-700 text-slate-400 hover:text-amber-300 rounded transition"
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
                              className="p-1 hover:bg-slate-700 text-indigo-400 rounded transition"
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
              <div className="pt-3 border-t border-slate-800">
                {isScheduled && !isLocked ? (
                  <button
                    onClick={() => handleOpenCheckIn(s)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Check In Session</span>
                  </button>
                ) : isLocked ? (
                  <div className="text-center py-1.5 text-xs text-slate-500 italic bg-slate-800/40 rounded-xl border border-slate-800">
                    Frozen by Locked Payroll
                  </div>
                ) : (
                  <div className="text-center py-1.5 text-xs text-slate-400 bg-slate-800/30 rounded-xl">
                    Completed
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Check In Session */}
      {isCheckInOpen && activeSession && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white">Session Check-In Console</h3>
                <p className="text-xs text-slate-400">
                  {activeSession.code} • {activeSession.subject_name} • {formatDateTime(activeSession.scheduled_start)}
                </p>
              </div>
              <button onClick={() => setIsCheckInOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleExecuteCheckIn} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300">Session Status Outcome *</label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setCheckInOutcome('held')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      checkInOutcome === 'held'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
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
                        ? 'bg-rose-600/20 border-rose-500 text-rose-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
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
                  <label className="text-xs font-medium text-slate-300">Student Attendance Outcomes *</label>
                  <p className="text-[11px] text-slate-400">
                    Rule: Held sessions require ≥ 1 credit-consuming attendee. Single attendee in a group still runs at group rate.
                  </p>

                  <div className="space-y-2 pt-1">
                    {activeSession.attendees.map((a) => (
                      <div
                        key={a.student_id}
                        className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{a.student_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {a.student_code}
                            {a.notice_received_at && (
                              <span className="text-amber-400 ml-1.5 font-sans">(Late notice logged)</span>
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
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-700 text-slate-400 hover:text-white'
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
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-700 text-slate-400 hover:text-white'
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
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                  <div className="text-slate-300">
                    <span className="font-bold text-indigo-400">Admin Bypass Mode</span>
                    <p className="text-[10px] text-slate-400">Bypass the -15 min / +2 day check-in window constraint</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={adminBypass}
                    onChange={(e) => setAdminBypass(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 rounded bg-slate-700 border-slate-600 cursor-pointer"
                  />
                </div>
              )}

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCheckInOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md"
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-amber-400">Log Student Cancellation Notice</h3>
              <button onClick={() => setIsNoticeOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Student: <span className="font-bold text-white">{activeAttendance.studentName}</span>
              <br />
              Session Time: <span className="font-mono text-cyan-300">{activeAttendance.sessionTime}</span>
            </p>

            <form onSubmit={handleRecordNotice} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Notice Received Timestamp (GMT+8) *</label>
                <input
                  type="datetime-local"
                  required
                  value={noticeTime}
                  onChange={(e) => setNoticeTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-1">
                <div className="font-semibold flex items-center space-x-1">
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
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl"
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Book Make-Up Session (FR-7.9)</h3>
              <button onClick={() => setIsMakeUpOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Draws on released credits from <code className="text-indigo-400 font-mono">cancelled_notice</code> or <code className="text-indigo-400 font-mono">void</code>. Verifies unconsumed credits remain on that invoice.
            </p>

            <form onSubmit={handleBookMakeUp} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Make-Up Target Datetime (GMT+8) *</label>
                <input
                  type="datetime-local"
                  required
                  value={makeUpDateTime}
                  onChange={(e) => setMakeUpDateTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsMakeUpOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
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
