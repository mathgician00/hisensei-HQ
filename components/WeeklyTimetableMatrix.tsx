'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Users,
  User,
  GraduationCap,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  LocateFixed,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { SessionItem } from '@/src/services/tutoringService';
import { formatTimeOnly, formatDateOnly, formatDateTime, formatRupiah } from '@/lib/formatters';
import { apiFetch } from '@/lib/api';

interface WeeklyTimetableMatrixProps {
  sessions: SessionItem[];
  currentRole?: string;
  selectedTeacherId?: string;
  masterData?: any;
  onRefresh?: () => void;
  onSelectSession?: (session: SessionItem) => void;
  filterType?: 'all' | 'private' | 'group';
}

const START_HOUR = 7; // 07:00
const END_HOUR = 22; // 22:00
const HOUR_HEIGHT = 68; // px per hour

// Helper to get start of week (Monday)
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDayHeader(date: Date): { dayName: string; dateNum: string; isToday: boolean } {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return {
    dayName: days[date.getDay()],
    dateNum: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
    isToday,
  };
}

export const WeeklyTimetableMatrix: React.FC<WeeklyTimetableMatrixProps> = ({
  sessions,
  currentRole,
  selectedTeacherId,
  masterData,
  onRefresh,
  onSelectSession,
  filterType: initialFilterType = 'all',
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [classTypeFilter, setClassTypeFilter] = useState<'all' | 'private' | 'group'>(initialFilterType);
  const [teacherFilter, setTeacherFilter] = useState<string>(
    currentRole === 'teacher' && selectedTeacherId ? selectedTeacherId : 'all'
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [selectedSessionDetails, setSelectedSessionDetails] = useState<SessionItem | null>(null);
  const [selectedClusterSessions, setSelectedClusterSessions] = useState<SessionItem[] | null>(null);

  // Check-In Modal state
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState<boolean>(false);
  const [sessionToCheckIn, setSessionToCheckIn] = useState<SessionItem | null>(null);
  const [checkInOutcome, setCheckInOutcome] = useState<'held' | 'teacher_absent'>('held');
  const [attendeeOutcomes, setAttendeeOutcomes] = useState<Record<string, 'attended' | 'no_show'>>({});
  const [adminBypass, setAdminBypass] = useState<boolean>(
    currentRole === 'admin' || currentRole === 'master_admin'
  );
  const [checkInError, setCheckInError] = useState<string>('');
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState<boolean>(false);
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState<string>('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync current time every 30 seconds for live red indicator
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Compute the 7 days of the week (Monday - Sunday)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const weekEnd = useMemo(() => addDays(currentWeekStart, 6), [currentWeekStart]);

  // Extract unique teachers for the filter
  const teachersList = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((s) => {
      if (s.teacher_name && s.teacher_id) {
        map.set(s.teacher_id, s.teacher_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sessions]);

  // Effective teacher filter (lock for teachers)
  const effectiveTeacherFilter =
    currentRole === 'teacher' && selectedTeacherId ? selectedTeacherId : teacherFilter;

  // Filter sessions matching the active week and filters
  const filteredWeekSessions = useMemo(() => {
    const startMs = currentWeekStart.getTime();
    const endMs = new Date(weekEnd).setHours(23, 59, 59, 999);

    return sessions.filter((s) => {
      const sessionDate = new Date(s.scheduled_start);
      const sessionMs = sessionDate.getTime();
      if (sessionMs < startMs || sessionMs > endMs) return false;

      if (classTypeFilter !== 'all' && s.class_type !== classTypeFilter) return false;
      if (effectiveTeacherFilter !== 'all' && s.teacher_id !== effectiveTeacherFilter) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesClass = s.class_code.toLowerCase().includes(query);
        const matchesTeacher = s.teacher_name.toLowerCase().includes(query);
        const matchesSubject = s.subject_name.toLowerCase().includes(query);
        const matchesStudent = s.attendees.some(
          (a) =>
            a.student_name.toLowerCase().includes(query) ||
            a.student_code.toLowerCase().includes(query)
        );
        if (!matchesClass && !matchesTeacher && !matchesSubject && !matchesStudent) return false;
      }

      return true;
    });
  }, [sessions, currentWeekStart, weekEnd, classTypeFilter, effectiveTeacherFilter, searchTerm]);

  // Navigation helpers
  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, 7));
  };

  const handleCurrentWeek = () => {
    setCurrentWeekStart(getMonday(new Date()));
    scrollToNowOrEarliest();
  };

  // Scroll to current time or earliest session
  const scrollToNowOrEarliest = () => {
    if (!scrollContainerRef.current) return;

    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    let targetHour = currentHour;
    if (targetHour < START_HOUR || targetHour > END_HOUR) {
      if (filteredWeekSessions.length > 0) {
        const earliestTime = Math.min(
          ...filteredWeekSessions.map((s) => {
            const d = new Date(s.scheduled_start);
            return d.getHours() + d.getMinutes() / 60;
          })
        );
        targetHour = earliestTime;
      } else {
        targetHour = 9; // 9:00 AM default
      }
    }

    const scrollOffset = Math.max(0, (targetHour - START_HOUR) * HOUR_HEIGHT - 60);
    scrollContainerRef.current.scrollTo({
      top: scrollOffset,
      behavior: 'smooth',
    });
  };

  // Auto-scroll on initial load and when week changes
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToNowOrEarliest();
    }, 150);
    return () => clearTimeout(timer);
  }, [currentWeekStart]);

  // Check if today falls in the displayed week
  const todayIndex = weekDays.findIndex((d) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  });

  // Calculate top offset for current time red indicator
  const currentNowHours = currentTime.getHours() + currentTime.getMinutes() / 60;
  const showCurrentTimeLine = todayIndex !== -1 && currentNowHours >= START_HOUR && currentNowHours <= END_HOUR;
  const currentTimeTop = (currentNowHours - START_HOUR) * HOUR_HEIGHT;

  // Hours array for rows
  const hourSlots = Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => START_HOUR + i);

  // Open Check-In modal
  const handleOpenCheckInModal = (session: SessionItem) => {
    setSessionToCheckIn(session);
    setCheckInOutcome('held');
    setCheckInError('');
    setCheckInSuccessMsg('');
    const initialAttendees: Record<string, 'attended' | 'no_show'> = {};
    session.attendees.forEach((a) => {
      initialAttendees[a.student_id] = a.notice_received_at ? 'no_show' : 'attended';
    });
    setAttendeeOutcomes(initialAttendees);
    setIsCheckInModalOpen(true);
  };

  // Submit Check-In
  const handleExecuteCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToCheckIn) return;
    setIsSubmittingCheckIn(true);
    setCheckInError('');

    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkin_session',
          payload: {
            session_id: sessionToCheckIn.id,
            outcome: checkInOutcome,
            attendees: checkInOutcome === 'held' ? attendeeOutcomes : null,
            admin: adminBypass,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit check-in');

      setCheckInSuccessMsg(`Session marked as ${checkInOutcome === 'held' ? 'Held' : 'Teacher Absent'}!`);
      setTimeout(() => {
        setIsCheckInModalOpen(false);
        setSelectedSessionDetails(null);
        setSessionToCheckIn(null);
        if (onRefresh) onRefresh();
      }, 700);
    } catch (err: any) {
      setCheckInError(err.message || 'Check-in failed');
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  return (
    <div className="space-y-4 text-slate-900 pb-12">
      {/* 1. Timetable Controls Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Week Selector */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
              title="Previous Week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={handleCurrentWeek}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-900 transition flex items-center space-x-1.5"
            >
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              <span>Today / This Week</span>
            </button>

            <button
              onClick={handleNextWeek}
              className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
              title="Next Week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="font-bold text-sm text-slate-900 ml-2">
              {formatDateOnly(currentWeekStart.toISOString())} – {formatDateOnly(weekEnd.toISOString())}
            </div>
          </div>

          {/* Class Type In-Tabs & Quick Jump */}
          <div className="flex flex-wrap items-center gap-2">
            {/* In-Tabs: All Classes, Private, Group */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setClassTypeFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  classTypeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Classes
              </button>
              <button
                onClick={() => setClassTypeFilter('private')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  classTypeFilter === 'private'
                    ? 'bg-white text-purple-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Private
              </button>
              <button
                onClick={() => setClassTypeFilter('group')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  classTypeFilter === 'group'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Group
              </button>
            </div>

            {/* Jump to now button */}
            <button
              onClick={scrollToNowOrEarliest}
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
              title="Auto-scroll to current time position"
            >
              <LocateFixed className="h-3.5 w-3.5 text-rose-500" />
              <span>Scroll to Now</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter Row: Search & Teacher Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search class, teacher, or student in this week..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#6dd95d]"
            />
          </div>

          {currentRole !== 'teacher' && teachersList.length > 0 && (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Teacher:</span>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#6dd95d] w-full sm:w-auto"
              >
                <option value="all">All Teachers</option>
                {teachersList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-xs text-slate-500 font-mono ml-auto whitespace-nowrap">
            <span>{filteredWeekSessions.length} sessions scheduled</span>
          </div>
        </div>
      </div>

      {/* 2. Google Calendar Weekly Matrix View with Unified Sticky Header */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
        {/* Scrollable Container (contains BOTH sticky header and grid for 100% column line alignment) */}
        <div
          ref={scrollContainerRef}
          className="relative overflow-y-auto max-h-[75vh] min-h-[520px] select-none"
        >
          {/* Sticky Days Header - Lives inside the scroll container so columns align with exact subpixel accuracy */}
          <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs sticky top-0 z-30 shadow-xs">
            {/* Time Gutter Header */}
            <div className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center border-r border-slate-200 flex items-center justify-center">
              GMT+8
            </div>

            {/* 7 Day Column Headers */}
            {weekDays.map((day, idx) => {
              const { dayName, dateNum, isToday } = formatDayHeader(day);
              return (
                <div
                  key={idx}
                  className={`p-2.5 text-center border-r border-slate-200 last:border-r-0 transition ${
                    isToday ? 'bg-emerald-50/80 text-emerald-950 font-extrabold' : 'text-slate-800'
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wider font-bold opacity-80">{dayName}</div>
                  <div
                    className={`text-sm font-extrabold mt-0.5 inline-block px-2.5 py-0.5 rounded-lg ${
                      isToday ? 'bg-[#6dd95d] text-slate-950 shadow-xs' : 'text-slate-900'
                    }`}
                  >
                    {dateNum}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Matrix Grid Body */}
          <div
            className="grid grid-cols-[64px_repeat(7,1fr)] relative"
            style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px` }}
          >
            {/* Continuous Full-Width Horizontal Grid Lines spanning across all 7 days */}
            <div className="absolute inset-0 pointer-events-none z-0">
              {hourSlots.map((hour) => {
                const topPx = (hour - START_HOUR) * HOUR_HEIGHT;
                return (
                  <React.Fragment key={hour}>
                    {/* Hour Solid Line spanning continuously from time gutter edge across all 7 days */}
                    <div
                      className="absolute left-[64px] right-0 border-t border-slate-200"
                      style={{ top: `${topPx}px` }}
                    />
                    {/* Half-Hour Dashed Guide Line */}
                    {hour < END_HOUR && (
                      <div
                        className="absolute left-[64px] right-0 border-t border-slate-100 border-dashed"
                        style={{ top: `${topPx + HOUR_HEIGHT / 2}px` }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Time Axis Column */}
            <div className="border-r border-slate-200 bg-slate-50/60 relative z-10">
              {hourSlots.map((hour) => {
                const topPx = (hour - START_HOUR) * HOUR_HEIGHT;
                return (
                  <div
                    key={hour}
                    className="absolute right-0 left-0 flex items-center justify-end pr-1.5 -translate-y-1/2"
                    style={{ top: `${topPx}px` }}
                  >
                    <span className="text-[10px] font-mono text-slate-500 font-semibold">
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                    <span className="w-1.5 border-t border-slate-300 ml-1 inline-block" />
                  </div>
                );
              })}
            </div>

            {/* 7 Day Columns with Event Cards */}
            {weekDays.map((day, dayIndex) => {
              const { isToday } = formatDayHeader(day);
              const dayDateStr = day.toISOString().split('T')[0];

              // Filter sessions for this specific day
              const daySessions = filteredWeekSessions.filter((s) => {
                const sDate = s.scheduled_start.split('T')[0];
                return sDate === dayDateStr;
              });

              return (
                <div
                  key={dayIndex}
                  className={`relative border-r border-slate-200 last:border-r-0 ${
                    isToday ? 'bg-emerald-50/15' : ''
                  }`}
                >
                  {/* Render Scheduled Class Cards & Overlap Clusters for This Day */}
                  {(() => {
                    // Compute overlap layout for sessions on this day
                    interface SessionPositioned {
                      session: SessionItem;
                      startHours: number;
                      endHours: number;
                      durationHours: number;
                      topOffset: number;
                      cardHeight: number;
                    }

                    const positionedList: SessionPositioned[] = daySessions
                      .map((s) => {
                        const sStart = new Date(s.scheduled_start);
                        const startH = sStart.getHours() + sStart.getMinutes() / 60;
                        const durH = (s.duration_min || 60) / 60;
                        const endH = startH + durH;
                        const top = (startH - START_HOUR) * HOUR_HEIGHT;
                        const height = Math.max(durH * HOUR_HEIGHT - 3, 44);
                        return {
                          session: s,
                          startHours: startH,
                          endHours: endH,
                          durationHours: durH,
                          topOffset: top,
                          cardHeight: height,
                        };
                      })
                      .sort((a, b) => a.startHours - b.startHours || a.endHours - b.endHours);

                    // Group into connected overlapping clusters
                    const clusters: SessionPositioned[][] = [];
                    let currentCluster: SessionPositioned[] = [];
                    let clusterEnd = -1;

                    positionedList.forEach((item) => {
                      if (currentCluster.length === 0) {
                        currentCluster.push(item);
                        clusterEnd = item.endHours;
                      } else {
                        // Check if overlaps with the current cluster
                        if (item.startHours < clusterEnd) {
                          currentCluster.push(item);
                          clusterEnd = Math.max(clusterEnd, item.endHours);
                        } else {
                          clusters.push(currentCluster);
                          currentCluster = [item];
                          clusterEnd = item.endHours;
                        }
                      }
                    });
                    if (currentCluster.length > 0) {
                      clusters.push(currentCluster);
                    }

                    return clusters.map((cluster, cIdx) => {
                      const count = cluster.length;

                      // CASE 1: 4 or more concurrent/overlapping sessions -> Render grouped summary card: "X classes"
                      if (count >= 4) {
                        const minTop = Math.min(...cluster.map((c) => c.topOffset));
                        const maxBottom = Math.max(...cluster.map((c) => c.topOffset + c.cardHeight));
                        const clusterHeight = Math.max(maxBottom - minTop, 52);

                        return (
                          <div
                            key={`cluster-overflow-${cIdx}`}
                            onClick={() => {
                              setSelectedClusterSessions(cluster.map((c) => c.session));
                            }}
                            style={{
                              top: `${minTop}px`,
                              height: `${clusterHeight}px`,
                            }}
                            className="absolute left-1 right-1 rounded-xl p-2.5 border-2 border-indigo-400 bg-indigo-50/95 text-indigo-950 shadow-xs cursor-pointer hover:shadow-md hover:bg-indigo-100 transition-all flex flex-col justify-center items-center text-center z-20 group"
                            title={`Click to view all ${count} concurrent classes`}
                          >
                            <div className="flex items-center space-x-1.5 font-extrabold text-xs text-indigo-900 group-hover:scale-105 transition-transform">
                              <Users className="h-4 w-4 text-indigo-600" />
                              <span>{count} classes</span>
                            </div>
                            <span className="text-[10px] font-semibold text-indigo-600 mt-0.5">
                              Click to view all
                            </span>
                          </div>
                        );
                      }

                      // CASE 2 & 3: 1 to 3 concurrent sessions
                      // When count is 1: full width, full details (Classcode - subject, teacher, student/group)
                      // When count is 2 or 3: side-by-side columns (50% or 33.3%), displaying ONLY class code for clean view
                      const isMulti = count > 1; // 2 or 3

                      return cluster.map((posItem, colIdx) => {
                        const { session, topOffset, cardHeight } = posItem;
                        const isHeld = session.status === 'held';
                        const isCancelled = session.status === 'cancelled';
                        const isPrivate = session.class_type === 'private';

                        const cardStyle = isCancelled
                          ? 'bg-[#f77f73]/15 border-[#f77f73]/50 text-rose-950 opacity-60 line-through'
                          : isHeld
                          ? 'bg-[#6dd95d]/25 border-[#6dd95d]/80 text-emerald-950'
                          : isPrivate
                          ? 'bg-[#c1a9e6]/25 border-[#c1a9e6]/80 text-purple-950'
                          : 'bg-[#65acff]/20 border-[#65acff]/80 text-blue-950';

                        // Calculate column width and left position
                        // Single item: full width (left 4px, right 4px)
                        // 2 items: 50% width each
                        // 3 items: 33.333% width each
                        let widthStyle = 'calc(100% - 8px)';
                        let leftStyle = '4px';

                        if (count === 2) {
                          widthStyle = 'calc(50% - 6px)';
                          leftStyle = colIdx === 0 ? '4px' : 'calc(50% + 2px)';
                        } else if (count === 3) {
                          widthStyle = 'calc(33.333% - 5px)';
                          if (colIdx === 0) leftStyle = '4px';
                          else if (colIdx === 1) leftStyle = 'calc(33.333% + 2px)';
                          else leftStyle = 'calc(66.666% + 1px)';
                        }

                        return (
                          <div
                            key={session.id}
                            onClick={() => {
                              setSelectedSessionDetails(session);
                              if (onSelectSession) onSelectSession(session);
                            }}
                            style={{
                              top: `${topOffset}px`,
                              height: `${cardHeight}px`,
                              width: widthStyle,
                              left: leftStyle,
                            }}
                            className={`absolute rounded-xl border shadow-xs cursor-pointer hover:shadow-md hover:brightness-95 transition-all overflow-hidden flex flex-col justify-between z-10 ${
                              isMulti ? 'p-1.5' : 'p-2'
                            } ${cardStyle}`}
                            title={`${session.class_code} - ${session.subject_name} (${session.teacher_name}) — Click to view details`}
                          >
                            {isMulti ? (
                              // 2 or 3 concurrent classes: clean card displaying ONLY the class code
                              <div className="flex flex-col items-center justify-center h-full text-center">
                                <span className="font-extrabold text-[11px] font-mono tracking-tight leading-tight truncate w-full px-0.5">
                                  {session.class_code}
                                </span>
                                <span className="text-[9px] font-medium opacity-75 truncate max-w-full leading-none mt-0.5">
                                  {session.subject_name}
                                </span>
                              </div>
                            ) : (
                              // Single session: 3-line format
                              <div className="space-y-0.5 overflow-hidden">
                                {/* Line 1: **Classcode - subject** (bold) */}
                                <div className="font-extrabold text-xs truncate leading-tight tracking-tight">
                                  {session.class_code} - {session.subject_name}
                                </div>

                                {/* Line 2: teacher */}
                                <div className="text-[11px] font-medium opacity-90 truncate leading-tight flex items-center gap-1">
                                  <GraduationCap className="h-3 w-3 shrink-0 opacity-70" />
                                  <span className="truncate">{session.teacher_name}</span>
                                </div>

                                {/* Line 3: student (for private) or group (if group) */}
                                <div className="text-[10px] font-semibold opacity-90 truncate leading-tight flex items-center gap-1">
                                  {isPrivate ? (
                                    <>
                                      <User className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                      <span className="truncate">
                                        {session.attendees && session.attendees.length > 0
                                          ? session.attendees.map((a) => a.student_name).join(', ')
                                          : 'Private Student'}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Users className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                      <span className="truncate">
                                        {session.attendees && session.attendees.length > 0
                                          ? `Group (${session.attendees.length} students)`
                                          : 'Group'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    });
                  })()}

                  {/* Red Current Time Line Indicator on Today's Column */}
                  {showCurrentTimeLine && todayIndex === dayIndex && (
                    <div
                      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                      style={{ top: `${currentTimeTop}px` }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1 shadow-xs ring-2 ring-white" />
                      <div className="h-0.5 bg-rose-500 w-full shadow-xs" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Cluster Expansion Modal (for 4+ concurrent classes) */}
      {selectedClusterSessions && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Simultaneous Classes ({selectedClusterSessions.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formatDateOnly(selectedClusterSessions[0]?.scheduled_start)} •{' '}
                    {formatTimeOnly(selectedClusterSessions[0]?.scheduled_start)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClusterSessions(null)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5">
              {selectedClusterSessions.map((session) => {
                const isHeld = session.status === 'held';
                const isCancelled = session.status === 'cancelled';
                const isPrivate = session.class_type === 'private';

                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      setSelectedClusterSessions(null);
                      setSelectedSessionDetails(session);
                      if (onSelectSession) onSelectSession(session);
                    }}
                    className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition bg-slate-50/50 hover:bg-white cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-extrabold text-xs text-slate-900 group-hover:text-blue-600 transition">
                          {session.class_code}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-700 truncate">
                          {session.subject_name}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            isPrivate
                              ? 'bg-[#c1a9e6]/25 text-purple-950 border border-[#c1a9e6]/40'
                              : 'bg-[#65acff]/20 text-blue-950 border border-[#65acff]/40'
                          }`}
                        >
                          {session.class_type}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            isHeld
                              ? 'bg-[#6dd95d]/25 text-emerald-950'
                              : isCancelled
                              ? 'bg-rose-100 text-rose-900'
                              : 'bg-blue-50 text-blue-900'
                          }`}
                        >
                          {session.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-1">
                        <div className="flex items-center space-x-1">
                          <GraduationCap className="h-3 w-3 opacity-70" />
                          <span>{session.teacher_name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {isPrivate ? (
                            <>
                              <User className="h-3 w-3 opacity-70" />
                              <span className="truncate">
                                {session.attendees?.map((a) => a.student_name).join(', ') || '1 Student'}
                              </span>
                            </>
                          ) : (
                            <>
                              <Users className="h-3 w-3 opacity-70" />
                              <span>{session.attendees?.length || 0} Students</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition shrink-0"
                    >
                      View
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedClusterSessions(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Session Quick Details Modal with Explicit Check-In */}
      {selectedSessionDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-extrabold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  {selectedSessionDetails.class_code}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    selectedSessionDetails.class_type === 'private'
                      ? 'bg-[#c1a9e6]/25 text-purple-950 border border-[#c1a9e6]/40'
                      : 'bg-[#65acff]/20 text-blue-950 border border-[#65acff]/40'
                  }`}
                >
                  {selectedSessionDetails.class_type}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    selectedSessionDetails.status === 'held'
                      ? 'bg-[#6dd95d]/20 text-emerald-950 border border-[#6dd95d]/40'
                      : selectedSessionDetails.status === 'scheduled'
                      ? 'bg-[#65acff]/20 text-blue-950 border border-[#65acff]/40'
                      : 'bg-[#f77f73]/20 text-rose-950 border border-[#f77f73]/40'
                  }`}
                >
                  {selectedSessionDetails.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedSessionDetails(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="font-bold text-base text-slate-900">
                {selectedSessionDetails.subject_name} ({selectedSessionDetails.curriculum_name} —{' '}
                {selectedSessionDetails.level_name})
              </h3>
              <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span>
                  {formatDateOnly(selectedSessionDetails.scheduled_start)} at{' '}
                  {formatTimeOnly(selectedSessionDetails.scheduled_start)} (
                  {selectedSessionDetails.duration_min} minutes)
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Teacher:</span>
                <span className="font-bold text-slate-900">
                  {selectedSessionDetails.teacher_name}
                </span>
              </div>
              {selectedSessionDetails.teacher_pay_amount !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Teacher Compensation:</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {formatRupiah(selectedSessionDetails.teacher_pay_amount)}
                  </span>
                </div>
              )}
            </div>

            {/* Attendees */}
            <div>
              <span className="text-xs font-semibold text-slate-700">Student Attendance Roster:</span>
              <div className="mt-2 space-y-1.5">
                {selectedSessionDetails.attendees && selectedSessionDetails.attendees.length > 0 ? (
                  selectedSessionDetails.attendees.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{att.student_name}</span>
                        <span className="font-mono text-slate-500 text-[10px] ml-2">
                          ({att.student_code})
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                          att.outcome === 'attended'
                            ? 'bg-[#6dd95d]/20 text-emerald-950 border border-[#6dd95d]/40'
                            : att.outcome === 'expected'
                            ? 'bg-blue-50 text-blue-900 border border-blue-200'
                            : 'bg-[#f77f73]/20 text-rose-950 border border-[#f77f73]/40'
                        }`}
                      >
                        {att.outcome}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No students assigned to this session.</p>
                )}
              </div>
            </div>

            {/* Action Buttons: Close + Explicit Check In Button */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedSessionDetails(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Close
              </button>

              {/* Explicit Check In Button */}
              {selectedSessionDetails.status === 'scheduled' && !selectedSessionDetails.payroll_run_id ? (
                <button
                  type="button"
                  onClick={() => handleOpenCheckInModal(selectedSessionDetails)}
                  className="px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Check In Session</span>
                </button>
              ) : selectedSessionDetails.payroll_run_id ? (
                <span className="text-xs text-slate-400 italic px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
                  Locked by Payroll
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-800 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center space-x-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Verified Held</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Full Check-In Modal Console */}
      {isCheckInModalOpen && sessionToCheckIn && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Session Check-In Console</h3>
                <p className="text-xs text-slate-500">
                  {sessionToCheckIn.class_code} • {sessionToCheckIn.subject_name} • {formatDateTime(sessionToCheckIn.scheduled_start)}
                </p>
              </div>
              <button onClick={() => setIsCheckInModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {checkInSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center space-x-2 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{checkInSuccessMsg}</span>
              </div>
            )}

            {checkInError && (
              <div className="p-3 bg-[#f77f73]/15 border border-[#f77f73]/30 text-rose-900 text-xs rounded-xl flex items-center space-x-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{checkInError}</span>
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
                    {sessionToCheckIn.attendees.map((a) => (
                      <div
                        key={a.student_id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-900">{a.student_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{a.student_code}</div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              setAttendeeOutcomes((prev) => ({ ...prev, [a.student_id]: 'attended' }))
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              attendeeOutcomes[a.student_id] === 'attended'
                                ? 'bg-[#6dd95d] text-slate-950 shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-600'
                            }`}
                          >
                            Attended
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAttendeeOutcomes((prev) => ({ ...prev, [a.student_id]: 'no_show' }))
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              attendeeOutcomes[a.student_id] === 'no_show'
                                ? 'bg-[#f77f73] text-rose-950 shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-600'
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

              {/* Admin Bypass Checkbox */}
              {(currentRole === 'admin' || currentRole === 'master_admin') && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Admin Bypass Rule</div>
                      <div className="text-[10px] text-slate-500">Allow check-in outside 2-hour window</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={adminBypass}
                    onChange={(e) => setAdminBypass(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCheckInModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCheckIn}
                  className="px-5 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl transition shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSubmittingCheckIn && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Confirm Check-In</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
