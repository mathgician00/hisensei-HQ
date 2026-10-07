'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Calendar,
  Users,
  Plus,
  Clock,
  BookOpen,
  GraduationCap,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import { ClassItem, Student } from '@/src/services/tutoringService';
import { getWeekdayName, formatTimeOnly } from '@/lib/formatters';

interface ClassesTabProps {
  classes: ClassItem[];
  students: Student[];
  masterData: any;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
  readOnly?: boolean;
}

export const ClassesTab: React.FC<ClassesTabProps> = ({
  classes,
  students,
  masterData,
  onRefresh,
  readOnly = false,
}) => {
  const [isNewClassOpen, setIsNewClassOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // New Class Form
  const [classForm, setClassForm] = useState({
    class_type: 'private' as 'private' | 'group',
    teacher_id: masterData.teachers[0]?.id || '',
    subject_id: masterData.subjects[0]?.id || '',
    curriculum_id: masterData.curricula[0]?.id || '',
    level_id: masterData.levels[0]?.id || '',
    capacity: 1,
    slots: [
      { weekday: 1, start_time: '16:00', duration_min: 60 },
      { weekday: 4, start_time: '16:00', duration_min: 60 },
    ],
  });

  // Enroll Form
  const [enrollForm, setEnrollForm] = useState({
    student_id: students[0]?.id || '',
    start_date: new Date().toISOString().split('T')[0],
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_class',
          payload: classForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsNewClassOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enroll_student',
          payload: {
            class_id: selectedClass.id,
            student_id: enrollForm.student_id,
            start_date: enrollForm.start_date,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsEnrollModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <span>Academic Classes & Timetable Matrix</span>
            <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded-full font-mono">
              {classes.length} classes
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict capacity enforcement: Private = 1, Group = 2–3 students. Automatic teacher rate verification.
          </p>
        </div>

        {!readOnly && <button
          onClick={() => {
            setErrorMessage('');
            setIsNewClassOpen(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Class</span>
        </button>}
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classes.map((cls) => {
          const isFull = cls.enrolled_count >= cls.capacity;

          return (
            <div
              key={cls.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-sm space-y-4 transition flex flex-col justify-between"
            >
              <div>
                {/* Top Badge & Code */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-extrabold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                      {cls.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        cls.class_type === 'private'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {cls.class_type}
                    </span>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      isFull
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {cls.enrolled_count} / {cls.capacity} Enrolled
                  </span>
                </div>

                {/* Subject & Curriculum */}
                <div className="mt-3">
                  <h3 className="font-bold text-white text-sm leading-snug">{cls.subject_name}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {cls.curriculum_name} — <span className="text-slate-300 font-medium">{cls.level_name}</span>
                  </div>
                </div>

                {/* Teacher */}
                <div className="mt-2.5 flex items-center space-x-2 text-xs text-slate-300 bg-slate-800/60 p-2 rounded-xl border border-slate-700/50">
                  <GraduationCap className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">{cls.teacher_name}</span>
                    <span className="font-mono text-[10px] text-slate-400 ml-1.5">({cls.teacher_code})</span>
                  </div>
                </div>

                {/* Recurring Slots */}
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Weekly Schedule Slots:
                  </span>
                  <div className="mt-1.5 space-y-1">
                    {cls.slots.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-800/40 px-2.5 py-1 rounded-lg"
                      >
                        <Clock className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="font-semibold text-white">{getWeekdayName(s.weekday)}</span>
                        <span className="text-slate-400">at {formatTimeOnly(s.start_time)} ({s.duration_min} min)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Enrolled Students Roster */}
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Enrolled Students:
                  </span>
                  {cls.enrolled_students && cls.enrolled_students.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {cls.enrolled_students.map((st, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-800/30 border border-slate-800"
                        >
                          <span className="text-slate-200 font-medium">{st.student_name}</span>
                          <span className="font-mono text-[10px] text-indigo-400">{st.student_code}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic mt-1">No students enrolled yet</p>
                  )}
                </div>
              </div>

              {/* Action Button */}
              {!readOnly && <div className="pt-3 border-t border-slate-800">
                <button
                  disabled={isFull}
                  onClick={() => {
                    setSelectedClass(cls);
                    setErrorMessage('');
                    setIsEnrollModalOpen(true);
                  }}
                  className={`w-full py-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 ${
                    isFull
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{isFull ? 'Class at Full Capacity' : 'Enroll Student'}</span>
                </button>
              </div>}
            </div>
          );
        })}
      </div>

      {/* MODAL: New Class */}
      {isNewClassOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Create Academic Class</h3>
              <button onClick={() => setIsNewClassOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateClass} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">Class Type *</label>
                  <select
                    value={classForm.class_type}
                    onChange={(e) => {
                      const ct = e.target.value as 'private' | 'group';
                      setClassForm({
                        ...classForm,
                        class_type: ct,
                        capacity: ct === 'private' ? 1 : 3,
                      });
                    }}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="private">Private (1-on-1, capacity=1)</option>
                    <option value="group">Group (Small cohort, capacity ≤ 3)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Capacity *</label>
                  <input
                    type="number"
                    min="1"
                    max={classForm.class_type === 'private' ? 1 : 3}
                    value={classForm.capacity}
                    onChange={(e) => setClassForm({ ...classForm, capacity: parseInt(e.target.value) || 1 })}
                    disabled={classForm.class_type === 'private'}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Teacher *</label>
                <select
                  value={classForm.teacher_id}
                  onChange={(e) => setClassForm({ ...classForm, teacher_id: e.target.value })}
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
                    value={classForm.curriculum_id}
                    onChange={(e) => setClassForm({ ...classForm, curriculum_id: e.target.value })}
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
                    value={classForm.level_id}
                    onChange={(e) => setClassForm({ ...classForm, level_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  >
                    {masterData.levels
                      .filter((l: any) => l.curriculum_id === classForm.curriculum_id)
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
                  value={classForm.subject_id}
                  onChange={(e) => setClassForm({ ...classForm, subject_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  {masterData.subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slot 1 */}
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-300">Recurring Slot 1</span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={classForm.slots[0].weekday}
                    onChange={(e) => {
                      const newSlots = [...classForm.slots];
                      newSlots[0].weekday = parseInt(e.target.value);
                      setClassForm({ ...classForm, slots: newSlots });
                    }}
                    className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                    <option value={7}>Sunday</option>
                  </select>
                  <input
                    type="time"
                    value={classForm.slots[0].start_time}
                    onChange={(e) => {
                      const newSlots = [...classForm.slots];
                      newSlots[0].start_time = e.target.value;
                      setClassForm({ ...classForm, slots: newSlots });
                    }}
                    className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              {/* Slot 2 */}
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-300">Recurring Slot 2</span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={classForm.slots[1].weekday}
                    onChange={(e) => {
                      const newSlots = [...classForm.slots];
                      newSlots[1].weekday = parseInt(e.target.value);
                      setClassForm({ ...classForm, slots: newSlots });
                    }}
                    className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                    <option value={7}>Sunday</option>
                  </select>
                  <input
                    type="time"
                    value={classForm.slots[1].start_time}
                    onChange={(e) => {
                      const newSlots = [...classForm.slots];
                      newSlots[1].start_time = e.target.value;
                      setClassForm({ ...classForm, slots: newSlots });
                    }}
                    className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewClassOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                >
                  {isSubmitting ? 'Validating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Enroll Student */}
      {isEnrollModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white">Enroll Student in Class</h3>
                <p className="text-xs text-slate-400">
                  Target: <span className="font-mono text-cyan-400">{selectedClass.code}</span> ({selectedClass.subject_name})
                </p>
              </div>
              <button onClick={() => setIsEnrollModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleEnrollStudent} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Select Student *</label>
                <select
                  value={enrollForm.student_id}
                  onChange={(e) => setEnrollForm({ ...enrollForm, student_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) — {s.status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Enrollment Start Date *</label>
                <input
                  type="date"
                  required
                  value={enrollForm.start_date}
                  onChange={(e) => setEnrollForm({ ...enrollForm, start_date: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs text-slate-400">
                Current capacity: {selectedClass.enrolled_count} of {selectedClass.capacity} filled.
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                >
                  {isSubmitting ? 'Enrolling...' : 'Confirm Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
