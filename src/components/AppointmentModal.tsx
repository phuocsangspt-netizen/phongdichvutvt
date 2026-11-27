import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, AlertCircle, Lock } from 'lucide-react';
import { Appointment, CardColor, PriorityLevel, AppointmentStatus, ServiceAdvisor } from '../types/appointment';
import {
  ALL_TIME_SLOTS,
  AFTERNOON_SLOTS,
  LOCATION_OPTIONS,
  MORNING_SLOTS,
  PRIORITY_OPTIONS,
  SERVICE_BAYS,
  SERVICE_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from '../data/mockData';
import { getLocalDateString, isSlotInPast } from '../utils/timeSlots';

const CONFIRMED_TIME_LOCKED_STATUSES: AppointmentStatus[] = [
  'Đã Xác Nhận',
  'Chờ Tiếp Nhận',
  'Đang Làm',
  'Hoàn Thành',
];

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

function minutesToTime(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface AppointmentModalProps {
  isOpen: boolean;
  appointment: Partial<Appointment> | null;
  existingAppointments?: Appointment[];
  advisors: ServiceAdvisor[];
  selectedDate: string;
  defaultTimeSlot?: string;
  defaultBayId?: string;
  now?: Date;
  editMode?: 'full' | 'status_only' | 'read_only';
  canDelete?: boolean;
  onClose: () => void;
  onSave: (appointment: Appointment) => void;
  onDelete?: (id: string) => void;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  appointment,
  existingAppointments = [],
  advisors,
  selectedDate,
  defaultTimeSlot = '14:00',
  defaultBayId,
  now = new Date(),
  editMode = 'full',
  canDelete = false,
  onClose,
  onSave,
  onDelete,
}) => {
  const isEditing = Boolean(appointment && appointment.id);
  const isReadOnly = isEditing && editMode === 'read_only';
  const isStatusOnly = isEditing && editMode === 'status_only';
  const isGeneralFieldLocked = isReadOnly || isStatusOnly;
  const isConfirmedTimeLocked =
    isEditing &&
    Boolean(appointment?.status) &&
    CONFIRMED_TIME_LOCKED_STATUSES.includes(appointment!.status as AppointmentStatus);
  const isTimeFieldLocked = isGeneralFieldLocked || isConfirmedTimeLocked;
  const todayStr = getLocalDateString(now);

  const [licensePlate, setLicensePlate] = useState('');
  const [advisorName, setAdvisorName] = useState('Nguyễn Văn Toàn');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['Bảo Dưỡng']);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bookingStaff, setBookingStaff] = useState('Nguyễn Văn Toàn');
  const [status, setStatus] = useState<AppointmentStatus>('Đã Xác Nhận');
  const [priority, setPriority] = useState<PriorityLevel>('Thường');
  const [location, setLocation] = useState('Vũng Tàu');
  const [appointmentDate, setAppointmentDate] = useState(selectedDate);
  const [appointmentTime, setAppointmentTime] = useState(defaultTimeSlot);
  const [bayId, setBayId] = useState(defaultBayId || 'bay_bd_1');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const getStatusColorDot = (st: AppointmentStatus) => {
    switch (st) {
      case 'Chờ Tiếp Nhận':
        return 'bg-blue-500';
      case 'Đã Xác Nhận':
        return 'bg-purple-500';
      case 'Đang Làm':
        return 'bg-amber-500';
      case 'Hoàn Thành':
        return 'bg-emerald-500';
      case 'Đã Hủy':
        return 'bg-red-500';
      default:
        return 'bg-purple-500';
    }
  };

  const getCardColorByStatus = (st: AppointmentStatus): CardColor => {
    switch (st) {
      case 'Chờ Tiếp Nhận':
        return 'blue';
      case 'Đã Xác Nhận':
        return 'purple';
      case 'Đang Làm':
        return 'amber';
      case 'Hoàn Thành':
        return 'green';
      case 'Đã Hủy':
        return 'pink';
      default:
        return 'purple';
    }
  };

  const quickNotes = [
    'BD NHỎ',
    'BD 5.000km',
    'BD 10.000km',
    'BD 20.000km',
    'BD LỚN 40.000km',
  ];

  useEffect(() => {
    const firstAdvisorName = advisors[0]?.name || 'Cố Vấn Dịch Vụ';
    if (appointment) {
      setLicensePlate(appointment.licensePlate || '');
      setAdvisorName(appointment.advisorName || firstAdvisorName);
      setSelectedTypes(
        appointment.serviceTypes && appointment.serviceTypes.length > 0
          ? appointment.serviceTypes
          : ['Bảo Dưỡng']
      );
      setCustomerName(appointment.customerName || '');
      setPhoneNumber(appointment.phoneNumber || '');
      setBookingStaff(appointment.bookingStaff || appointment.advisorName || firstAdvisorName);
      setStatus(appointment.status || 'Đã Xác Nhận');
      setPriority(appointment.priority || 'Thường');
      setLocation(appointment.location || 'Vũng Tàu');
      setAppointmentDate(appointment.appointmentDate || selectedDate);
      setAppointmentTime(appointment.appointmentTime || defaultTimeSlot);
      setBayId(appointment.bayId || defaultBayId || 'bay_bd_1');
      setDurationMinutes(appointment.durationMinutes || 30);
      setContent(appointment.content || '');
    } else {
      setLicensePlate('');
      setAdvisorName(firstAdvisorName);
      setSelectedTypes(['Bảo Dưỡng']);
      setCustomerName('');
      setPhoneNumber('');
      setBookingStaff(firstAdvisorName);
      setStatus('Đã Xác Nhận');
      setPriority('Thường');
      setLocation('Vũng Tàu');
      setAppointmentDate(selectedDate);
      setAppointmentTime(defaultTimeSlot);
      setBayId(defaultBayId || 'bay_bd_1');
      setDurationMinutes(30);
      setContent('');
    }
    setError(null);
  }, [appointment, isOpen, selectedDate, defaultTimeSlot, defaultBayId, advisors]);

  const conflictingAppointment = useMemo(() => {
    if (!isOpen || isTimeFieldLocked) return null;
    const startMin = timeToMinutes(appointmentTime);
    if (startMin < 0) return null;
    const endMin = startMin + (durationMinutes || 30);

    return (
      existingAppointments.find((apt) => {
        if (apt.id === appointment?.id) return false;
        if (apt.status === 'Đã Hủy') return false;
        if (apt.appointmentDate !== appointmentDate) return false;
        if (apt.bayId !== bayId) return false;
        const otherStart = timeToMinutes(apt.appointmentTime);
        if (otherStart < 0) return false;
        const otherEnd = otherStart + (apt.durationMinutes || 30);
        return startMin < otherEnd && endMin > otherStart;
      }) || null
    );
  }, [
    isOpen,
    isTimeFieldLocked,
    existingAppointments,
    appointment?.id,
    appointmentDate,
    appointmentTime,
    durationMinutes,
    bayId,
  ]);

  if (!isOpen) return null;

  const handleToggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter((t) => t !== type));
      }
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const isSlotDisabledInModal = (dateStr: string, slot: string) => {
    if (
      isEditing &&
      appointment?.appointmentDate === dateStr &&
      appointment?.appointmentTime === slot
    ) {
      return false;
    }
    return isSlotInPast(dateStr, slot, now);
  };

  const handleDateInputChange = (newDate: string) => {
    if (isTimeFieldLocked) return;
    setAppointmentDate(newDate);
    setError(null);
    if (isSlotDisabledInModal(newDate, appointmentTime)) {
      const nextValid = ALL_TIME_SLOTS.find((s) => !isSlotDisabledInModal(newDate, s));
      if (nextValid) {
        setAppointmentTime(nextValid);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!licensePlate.trim()) {
      setError('Vui lòng nhập Biển Số xe');
      return;
    }

    const finalDate =
      isConfirmedTimeLocked && appointment?.appointmentDate
        ? appointment.appointmentDate
        : appointmentDate;
    const finalTime =
      isConfirmedTimeLocked && appointment?.appointmentTime
        ? appointment.appointmentTime
        : appointmentTime;
    const finalDuration =
      isConfirmedTimeLocked && appointment?.durationMinutes
        ? appointment.durationMinutes
        : durationMinutes;

    if (!finalTime) {
      setError('Vui lòng chọn Giờ Hẹn');
      return;
    }
    if (!isConfirmedTimeLocked && isSlotDisabledInModal(finalDate, finalTime)) {
      setError('Khung giờ này đã qua, không thể đặt hẹn. Vui lòng chọn ngày hoặc khung giờ khác!');
      return;
    }
    if (!isTimeFieldLocked && conflictingAppointment) {
      const cStart = timeToMinutes(conflictingAppointment.appointmentTime);
      const cEnd = minutesToTime(cStart + (conflictingAppointment.durationMinutes || 30));
      setError(
        `Khung giờ bị trùng với xe ${conflictingAppointment.licensePlate} (${conflictingAppointment.appointmentTime} – ${cEnd}) ở cùng khoang. Vui lòng chọn thời lượng ngắn hơn hoặc khung giờ/khoang khác.`
      );
      return;
    }

    const selectedBay = SERVICE_BAYS.find((b) => b.id === bayId);
    const selectedAdvisor = advisors.find((a) => a.name === advisorName);

    const payload: Appointment = {
      id: appointment?.id || `apt-${Date.now()}`,
      licensePlate: licensePlate.toUpperCase().trim(),
      advisorName,
      advisorAvatar:
        selectedAdvisor?.avatar ||
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4',
      serviceTypes: selectedTypes,
      customerName: customerName.trim() || 'KHÁCH HÀNG',
      phoneNumber: phoneNumber.trim(),
      bookingStaff: bookingStaff || advisorName,
      status,
      priority,
      location,
      appointmentDate: finalDate,
      appointmentTime: finalTime,
      durationMinutes: finalDuration,
      bayId,
      bayName: selectedBay ? selectedBay.code : 'EM 01',
      content: content.trim() || 'BD NHỎ',
      cardColor: getCardColorByStatus(status),
      createdAt: appointment?.createdAt,
      createdByUid: appointment?.createdByUid,
      createdByEmail: appointment?.createdByEmail,
      createdByName: appointment?.createdByName,
      updatedAt: new Date().toISOString(),
    };

    onSave(payload);
    onClose();
  };

  const inputClass =
    'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1a2538] border border-slate-200 dark:border-slate-700/90 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed';

  const labelClass =
    'block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden my-8"
        role="dialog"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#162032]">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-5 bg-blue-600 dark:bg-blue-500 rounded-xs" />
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {isEditing ? 'Chi Tiết & Cập Nhật Hẹn' : 'Đặt Hẹn Mới'}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isReadOnly && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Chế độ chỉ xem.</span>
            </div>
          )}

          {isStatusOnly && (
            <div className="p-3 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 rounded-lg text-blue-800 dark:text-blue-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                Chế độ Cố Vấn — cập nhật <strong>Trạng Thái</strong> và <strong>Nội Dung Hẹn</strong>.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/40 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Biển Số & Cố Vấn */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Biển Số <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={licensePlate}
                disabled={isGeneralFieldLocked}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                placeholder="VD: 51M-364.64"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1a2538] border border-slate-200 dark:border-slate-700/90 rounded-lg text-slate-900 dark:text-white font-mono text-base font-bold placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className={labelClass}>Cố Vấn</label>
              <select
                value={advisorName}
                disabled={isGeneralFieldLocked}
                onChange={(e) => {
                  setAdvisorName(e.target.value);
                  if (!isEditing) setBookingStaff(e.target.value);
                }}
                className={inputClass}
              >
                {advisorName && !advisors.some((a) => a.name === advisorName) && (
                  <option value={advisorName}>{advisorName}</option>
                )}
                {advisors.map((advisor) => (
                  <option key={advisor.id} value={advisor.name}>
                    {advisor.name} ({advisor.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Loại Hình */}
          <div>
            <label className={labelClass}>Loại Hình</label>
            <div
              className={`flex flex-wrap items-center gap-2 p-2 bg-slate-50 dark:bg-[#1a2538] border border-slate-200 dark:border-slate-700/90 rounded-lg min-h-[44px] ${
                isGeneralFieldLocked ? 'opacity-60' : ''
              }`}
            >
              {selectedTypes.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-slate-900/90 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-slate-700 text-xs font-semibold"
                >
                  {type}
                  {!isGeneralFieldLocked && (
                    <button
                      type="button"
                      onClick={() => handleToggleType(type)}
                      className="hover:text-red-500 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
              {!isGeneralFieldLocked && (
                <div className="flex items-center gap-1 ml-auto flex-wrap">
                  {SERVICE_TYPE_OPTIONS.filter((t) => !selectedTypes.includes(t)).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleToggleType(type)}
                      className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 text-xs border border-slate-200 dark:border-slate-700/60 cursor-pointer"
                    >
                      + {type}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Khách Hàng & Số Điện Thoại */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Khách Hàng</label>
              <input
                type="text"
                value={customerName}
                disabled={isGeneralFieldLocked}
                onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                placeholder="VD: ANH KHOA"
                className={`${inputClass} font-medium`}
              />
            </div>

            <div>
              <label className={labelClass}>Số Điện Thoại</label>
              <input
                type="tel"
                value={phoneNumber}
                disabled={isGeneralFieldLocked}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="VD: 0908123456"
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          {/* Row 4: Nhân Viên Hẹn & Trạng Thái */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nhân Viên Hẹn</label>
              <input
                type="text"
                value={bookingStaff}
                disabled={isGeneralFieldLocked}
                onChange={(e) => setBookingStaff(e.target.value)}
                placeholder="VD: Nguyễn Văn Toàn"
                className={inputClass}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                <span>Trạng Thái</span>
                <span className={`w-2.5 h-2.5 rounded-full ${getStatusColorDot(status)}`} />
              </label>
              <select
                value={status}
                disabled={isReadOnly}
                onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Ưu Tiên & Khu Vực */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ưu Tiên</label>
              <select
                value={priority}
                disabled={isGeneralFieldLocked}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className={inputClass}
              >
                {PRIORITY_OPTIONS.map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Khu Vực</label>
              <select
                value={location}
                disabled={isGeneralFieldLocked}
                onChange={(e) => setLocation(e.target.value)}
                className={inputClass}
              >
                {LOCATION_OPTIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 6: Ngày Giờ Hẹn & Khoang Hẹn */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                <span>Ngày Giờ Hẹn</span>
                {isConfirmedTimeLocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold normal-case tracking-normal text-amber-600 dark:text-amber-300">
                    <Lock className="w-3 h-3" />
                    Đã khóa thời gian
                  </span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={appointmentDate}
                  disabled={isTimeFieldLocked}
                  min={isEditing ? undefined : todayStr}
                  onChange={(e) => handleDateInputChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#1a2538] border border-slate-200 dark:border-slate-700/90 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <select
                  value={appointmentTime}
                  disabled={isTimeFieldLocked}
                  onChange={(e) => {
                    setAppointmentTime(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#1a2538] border border-slate-200 dark:border-slate-700/90 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <optgroup label="Sáng">
                    {MORNING_SLOTS.map((slot) => {
                      const disabled = isSlotDisabledInModal(appointmentDate, slot);
                      return (
                        <option key={slot} value={slot} disabled={disabled}>
                          {disabled ? `${slot} (Đã qua)` : slot}
                        </option>
                      );
                    })}
                  </optgroup>
                  <optgroup label="Chiều">
                    {AFTERNOON_SLOTS.map((slot) => {
                      const disabled = isSlotDisabledInModal(appointmentDate, slot);
                      return (
                        <option key={slot} value={slot} disabled={disabled}>
                          {disabled ? `${slot} (Đã qua)` : slot}
                        </option>
                      );
                    })}
                  </optgroup>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Khoang Hẹn</label>
              <select
                value={bayId}
                disabled={isGeneralFieldLocked}
                onChange={(e) => setBayId(e.target.value)}
                className={inputClass}
              >
                {SERVICE_BAYS.map((bay) => (
                  <option key={bay.id} value={bay.id}>
                    {bay.code} - {bay.category} ({bay.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 7: Thời Lượng Dự Kiến */}
          <div>
            <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              <span>Thời Lượng Dự Kiến</span>
              {isConfirmedTimeLocked && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold normal-case tracking-normal text-amber-600 dark:text-amber-300">
                  <Lock className="w-3 h-3" />
                  Đã khóa thời lượng
                </span>
              )}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[30, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  disabled={isTimeFieldLocked}
                  onClick={() => {
                    if (!isTimeFieldLocked) {
                      setDurationMinutes(mins);
                      setError(null);
                    }
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                    durationMinutes === mins
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 dark:bg-[#1a2538] border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {mins} phút
                </button>
              ))}
            </div>

            {isConfirmedTimeLocked && (
              <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Trạng thái <strong>{appointment?.status}</strong> — thời gian hẹn đã khóa để tránh ảnh hưởng xe phía sau.
                </span>
              </div>
            )}

            {!isTimeFieldLocked && conflictingAppointment && (
              <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/40 rounded-lg text-red-700 dark:text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                <span>
                  Trùng lịch với xe <strong>{conflictingAppointment.licensePlate}</strong> lúc{' '}
                  <strong>{conflictingAppointment.appointmentTime}</strong> ({conflictingAppointment.durationMinutes} phút) ở cùng khoang.
                </span>
              </div>
            )}
          </div>

          {/* Row 8: Nội Dung Hẹn */}
          <div>
            <label className={labelClass}>Nội Dung Hẹn</label>
            <textarea
              rows={3}
              value={content}
              disabled={isReadOnly}
              onChange={(e) => setContent(e.target.value)}
              placeholder="VD: BD NHỎ, thay nhớt hộp số, kiểm tra tiếng kêu..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1a2538] border border-slate-200 dark:border-slate-700/90 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-sans disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {!isReadOnly && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {quickNotes.map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => setContent(note)}
                    className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60 transition-colors cursor-pointer"
                  >
                    {note}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            {isEditing && canDelete && !isReadOnly && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (appointment?.id) onDelete(appointment.id);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/20 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Xóa Hẹn
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                {isReadOnly ? 'Đóng' : 'Hủy'}
              </button>
              {!isReadOnly && (
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  {isEditing ? 'Cập Nhật' : 'Lưu Đặt Hẹn'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
