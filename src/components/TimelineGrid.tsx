import React, { useState } from 'react';
import { Appointment } from '../types/appointment';
import { MORNING_SLOTS, AFTERNOON_SLOTS, SERVICE_BAYS } from '../data/mockData';
import { ChevronLeft, ChevronRight, Plus, Clock, User, FileText, Lock } from 'lucide-react';
import {
  addDaysToDateString,
  getCurrentTimeString,
  getLocalDateString,
  getShiftLiveLinePercent,
  isPastDate,
  isSlotInPast,
} from '../utils/timeSlots';

interface TimelineGridProps {
  currentDate: string; // YYYY-MM-DD
  appointments: Appointment[];
  onDateChange: (date: string) => void;
  onSelectSlot: (bayId: string, timeSlot: string, bayCategory: string) => void;
  onEditAppointment: (appointment: Appointment) => void;
  now?: Date;
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  currentDate,
  appointments,
  onDateChange,
  onSelectSlot,
  onEditAppointment,
  now = new Date(),
}) => {
  const [hoveredAppointment, setHoveredAppointment] = useState<Appointment | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const todayStr = getLocalDateString(now);
  const isToday = currentDate === todayStr;
  const isDateInPast = isPastDate(currentDate, now);
  const currentTimeString = getCurrentTimeString(now);

  const formatDateDisplay = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}-${month}-${year}`;
    } catch {
      return dateStr;
    }
  };

  const handlePrevDay = () => {
    onDateChange(addDaysToDateString(currentDate, -1));
  };

  const handleNextDay = () => {
    onDateChange(addDaysToDateString(currentDate, 1));
  };

  const dayAppointments = appointments.filter((apt) => apt.appointmentDate === currentDate);

  const getLateMinutes = (apt: Appointment): number => {
    if (apt.status !== 'Đã Xác Nhận') return 0;
    const [y, m, d] = apt.appointmentDate.split('-').map(Number);
    const [hh, mm] = apt.appointmentTime.split(':').map(Number);
    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return 0;
    const scheduledTime = new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
    const diffMins = Math.floor((now.getTime() - scheduledTime) / 60000);
    return diffMins >= 15 ? diffMins : 0;
  };

  const lateCount = dayAppointments.filter((a) => getLateMinutes(a) >= 15).length;

  const getCardStyle = (apt: Appointment) => {
    switch (apt.status) {
      case 'Chờ Tiếp Nhận':
        return 'bg-[#dbeafe] border-[#60a5fa] text-[#1e3a8a] shadow-sm hover:brightness-95';
      case 'Đã Xác Nhận':
        return 'bg-[#ede9fe] border-[#a78bfa] text-[#3b0764] shadow-sm hover:brightness-95';
      case 'Đang Làm':
        return 'bg-[#fef3c7] border-[#f59e0b] text-[#78350f] shadow-sm hover:brightness-95';
      case 'Hoàn Thành':
        return 'bg-[#d1fae5] border-[#34d399] text-[#064e3b] shadow-sm hover:brightness-95';
      case 'Đã Hủy':
        return 'bg-[#fee2e2] border-[#f87171] text-[#7f1d1d] shadow-sm opacity-75 hover:opacity-95';
      default:
        return 'bg-[#ede9fe] border-[#a78bfa] text-[#3b0764] shadow-sm hover:brightness-95';
    }
  };

  const getTooltipStatusStyle = (status: string) => {
    switch (status) {
      case 'Chờ Tiếp Nhận':
        return 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30';
      case 'Đã Xác Nhận':
        return 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30';
      case 'Đang Làm':
        return 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30';
      case 'Hoàn Thành':
        return 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30';
      case 'Đã Hủy':
        return 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30';
      default:
        return 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30';
    }
  };

  const getSlotPosition = (timeStr: string, durationMinutes: number = 30, slots: string[]) => {
    const startIndex = slots.indexOf(timeStr);
    if (startIndex === -1) return null;

    const spanCount = Math.max(1, Math.round(durationMinutes / 30));
    const effectiveSpan = Math.min(spanCount, slots.length - startIndex);

    const slotWidthPercent = 100 / slots.length;
    const leftPercent = startIndex * slotWidthPercent;
    const widthPercent = effectiveSpan * slotWidthPercent;

    return { leftPercent, widthPercent, startIndex, spanCount };
  };

  const morningLivePercent = isToday ? getShiftLiveLinePercent(now, '08:00', '11:30') : null;
  const afternoonLivePercent = isToday ? getShiftLiveLinePercent(now, '13:00', '16:30') : null;

  const renderShiftSection = (
    title: string,
    slots: string[],
    livePercent: number | null,
    keyPrefix: string
  ) => (
    <div className="flex flex-col relative">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#121c2e]">
        <div className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
          {title}
        </div>
        <div className="grid grid-cols-[84px_repeat(7,1fr)] border-t border-slate-200 dark:border-slate-800/80 text-xs font-mono">
          <div className="py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Khoang</div>
          {slots.map((slot) => {
            const slotLocked = isSlotInPast(currentDate, slot, now);
            return (
              <div
                key={slot}
                className={`py-2 px-1 text-center border-l border-slate-200 dark:border-slate-800/70 font-semibold flex items-center justify-center gap-1 ${
                  slotLocked
                    ? 'text-slate-400 dark:text-slate-600 bg-slate-100/90 dark:bg-slate-950/50'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {slotLocked && <Lock className="w-2.5 h-2.5 text-slate-400 dark:text-slate-600" />}
                <span>{slot}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bays Rows */}
      <div className="divide-y divide-slate-200/80 dark:divide-slate-800/70 relative">
        {livePercent !== null && (
          <div
            style={{
              left: `calc(84px + (100% - 84px) * ${livePercent / 100})`,
            }}
            className="absolute top-0 bottom-0 w-[2px] bg-blue-600 dark:bg-blue-500 z-20 pointer-events-none"
          >
            <div className="w-2 h-2 -ml-[3px] -mt-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
          </div>
        )}

        {SERVICE_BAYS.map((bay, rowIdx) => {
          const bayApts = dayAppointments.filter(
            (a) => a.bayId === bay.id && slots.includes(a.appointmentTime)
          );

          return (
            <div
              key={`${keyPrefix}-${bay.id}-${rowIdx}`}
              className="grid grid-cols-[84px_repeat(7,1fr)] h-[72px] relative group hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors"
            >
              {/* Bay Label Column */}
              <div className="p-2 flex flex-col justify-center border-r border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#111928] text-xs leading-tight">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{bay.category}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{bay.code}</span>
              </div>

              {/* Time Slot Grid Cells */}
              {slots.map((slot) => {
                const slotLocked = isSlotInPast(currentDate, slot, now);
                return (
                  <div
                    key={`cell-${keyPrefix}-${bay.id}-${slot}`}
                    onClick={slotLocked ? undefined : () => onSelectSlot(bay.id, slot, bay.category)}
                    aria-disabled={slotLocked}
                    title={
                      slotLocked
                        ? `Khung giờ ${slot} đã qua — đã khóa đặt hẹn`
                        : `Đặt hẹn ${bay.category} (${bay.code}) lúc ${slot}`
                    }
                    className={`border-r border-slate-200/70 dark:border-slate-800/60 relative flex items-center justify-center transition-colors ${
                      slotLocked
                        ? 'bg-slate-100/80 dark:bg-[#080d18]/90 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.08),rgba(100,116,139,0.08)_4px,transparent_4px,transparent_8px)] dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.05),rgba(148,163,184,0.05)_4px,transparent_4px,transparent_8px)] cursor-not-allowed select-none'
                        : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-600/10'
                    }`}
                  >
                    {slotLocked ? (
                      <Lock className="w-3 h-3 text-slate-400/70 dark:text-slate-700/70" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                );
              })}

              {/* Appointment Cards */}
              <div className="absolute inset-y-0 left-[84px] right-0 pointer-events-none">
                {bayApts.map((apt) => {
                  const pos = getSlotPosition(apt.appointmentTime, apt.durationMinutes, slots);
                  if (!pos) return null;
                  const lateMins = getLateMinutes(apt);

                  return (
                    <div
                      key={apt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditAppointment(apt);
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPos({ x: rect.left, y: rect.bottom + 6 });
                        setHoveredAppointment(apt);
                      }}
                      onMouseLeave={() => setHoveredAppointment(null)}
                      style={{
                        left: `${pos.leftPercent}%`,
                        width: `calc(${pos.widthPercent}% - 3px)`,
                      }}
                      className={`absolute top-1.5 bottom-1.5 rounded-lg border px-1.5 py-1 flex items-center gap-1.5 pointer-events-auto cursor-pointer transition-all duration-150 z-10 ${getCardStyle(
                        apt
                      )} ${lateMins >= 15 ? 'ring-2 ring-red-500' : ''}`}
                    >
                      {lateMins >= 15 && (
                        <span
                          title={`Quá giờ hẹn ${lateMins} phút — chưa check-in`}
                          className="absolute -top-2 -right-1 px-1.5 py-0.2 rounded-full bg-red-600 text-white font-bold text-[9px] shadow border border-white/60 leading-tight"
                        >
                          Trễ
                        </span>
                      )}
                      <div className="shrink-0 w-6 h-6 rounded-full overflow-hidden border border-slate-900/15 bg-white/70">
                        <img
                          src={apt.advisorAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'}
                          alt={apt.advisorName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <div
                          className={`font-mono font-bold text-[11px] xl:text-xs tracking-normal truncate ${
                            apt.status === 'Đã Hủy' ? 'line-through' : ''
                          }`}
                        >
                          {apt.licensePlate}
                        </div>
                        <div className="text-[10px] opacity-80 truncate font-sans">
                          {apt.content || apt.customerName}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="w-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col">
      {/* Top Navigation Bar */}
      <div className="px-4 sm:px-6 py-3 bg-slate-50/80 dark:bg-[#121c2e] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-white dark:bg-[#182337] border border-slate-200 dark:border-slate-700/80 rounded-lg p-0.5">
            <button
              onClick={handlePrevDay}
              title="Ngày trước"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-4 py-1 text-sm font-bold font-mono text-slate-900 dark:text-white tracking-wider select-none">
              {formatDateDisplay(currentDate)}
            </div>
            <button
              onClick={handleNextDay}
              title="Ngày sau"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => onDateChange(getLocalDateString(new Date()))}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              isToday
                ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-300 dark:border-blue-500/50 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/70'
            }`}
          >
            Hôm Nay
          </button>

          {isDateInPast && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-medium">
              <Lock className="w-3.5 h-3.5" />
              Đã qua
            </span>
          )}

          {lateCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Trễ hẹn: {lateCount}
            </span>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#dbeafe] border border-[#60a5fa]" />
            <span>Chờ Tiếp Nhận</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ede9fe] border border-[#a78bfa]" />
            <span>Đã Xác Nhận</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#fef3c7] border border-[#f59e0b]" />
            <span>Đang Làm</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d1fae5] border border-[#34d399]" />
            <span>Hoàn Thành</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#fee2e2] border border-[#f87171]" />
            <span>Đã Hủy</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 pl-3 border-l border-slate-200 dark:border-slate-700">
            <Lock className="w-3 h-3" />
            <span>Đã qua</span>
          </div>
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold font-mono pl-3 border-l border-slate-200 dark:border-slate-700">
            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500" />
            <span>{currentTimeString}</span>
          </div>
        </div>
      </div>

      {/* Main Timeline Board */}
      <div className="overflow-x-auto w-full">
        <div className="w-full min-w-[1540px] grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800/90 bg-white dark:bg-[#0f172a]">
          {renderShiftSection('Sáng • 08:00–11:30', MORNING_SLOTS, morningLivePercent, 'morning')}
          {renderShiftSection('Chiều • 13:00–16:30', AFTERNOON_SLOTS, afternoonLivePercent, 'afternoon')}
        </div>
      </div>

      {/* Hover Popover */}
      {hoveredAppointment && tooltipPos && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(tooltipPos.x, window.innerWidth - 300)}px`,
            top: `${tooltipPos.y}px`,
          }}
          className="z-50 w-72 bg-white dark:bg-[#182337] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3.5 text-slate-700 dark:text-slate-200 text-xs pointer-events-none"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2 mb-2">
            <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
              {hoveredAppointment.licensePlate}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${getTooltipStatusStyle(hoveredAppointment.status)}`}>
              {hoveredAppointment.status}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-white">{hoveredAppointment.customerName}</span>
              {hoveredAppointment.phoneNumber && (
                <span className="text-slate-500 dark:text-slate-400 font-mono">({hoveredAppointment.phoneNumber})</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                {hoveredAppointment.appointmentTime} ({hoveredAppointment.durationMinutes} phút) - Khoang {hoveredAppointment.bayName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-amber-700 dark:text-amber-300 font-medium">{hoveredAppointment.content}</span>
            </div>

            {getLateMinutes(hoveredAppointment) >= 15 && (
              <div className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 font-semibold text-[11px]">
                Trễ hẹn {getLateMinutes(hoveredAppointment)} phút — chưa check-in
              </div>
            )}

            <div className="pt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-200 dark:border-slate-700/60 mt-2">
              <span>Cố vấn: <strong className="text-slate-800 dark:text-slate-200">{hoveredAppointment.advisorName}</strong></span>
              <span>Ưu tiên: {hoveredAppointment.priority}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
