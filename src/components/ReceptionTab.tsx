import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  AdvisorPickupRequest,
  Appointment,
  ReceptionEntry,
  ServiceAdvisor,
  UserAccount,
} from '../types/appointment';
import {
  Search,
  Plus,
  CheckCircle2,
  Clock,
  Car,
  Trash2,
  BellRing,
  Send,
  RotateCcw,
  UserCheck,
  AlertTriangle,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';

const RECEPTION_SERVICE_TYPES = [
  'Bảo Dưỡng',
  'Sửa Chữa Chung',
  'BG BHiểm',
  'Đồng Sơn',
];

interface ReceptionTabProps {
  currentDate: string; // YYYY-MM-DD
  appointments: Appointment[];
  receptionEntries: ReceptionEntry[];
  advisors: ServiceAdvisor[];
  advisorRequests: AdvisorPickupRequest[];
  currentUser?: UserAccount;
  now: Date;
  onAddReceptionEntry: (entry: ReceptionEntry) => Promise<void> | void;
  onUpdateReceptionEntry: (entry: ReceptionEntry) => Promise<void> | void;
  onTransferToAdvisor: (
    entry: ReceptionEntry,
    advisorName: string,
    requestIdToClear?: string
  ) => Promise<void>;
  onRecallFromAdvisor: (entry: ReceptionEntry) => Promise<void>;
  onDeleteReceptionEntry: (id: string) => Promise<void> | void;
}

function getElapsedMinutes(isoTimestamp: string | undefined, now: Date): number {
  if (!isoTimestamp) return 0;
  const parsed = new Date(isoTimestamp).getTime();
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 60000));
}

function inferBadgeType(
  hasAppointment: boolean,
  serviceTypes: string[]
): 'H' | 'S' | '' {
  if (!hasAppointment) return '';
  const hasRepair = serviceTypes.some(
    (s) =>
      s.toLowerCase().includes('sửa chữa') ||
      s.toLowerCase().includes('đồng sơn')
  );
  return hasRepair ? 'S' : 'H';
}

export const ReceptionTab: React.FC<ReceptionTabProps> = ({
  currentDate,
  appointments,
  receptionEntries,
  advisors,
  advisorRequests,
  currentUser,
  now,
  onAddReceptionEntry,
  onTransferToAdvisor,
  onRecallFromAdvisor,
  onDeleteReceptionEntry,
}) => {
  const canCheckIn =
    !currentUser ||
    currentUser.role === 'quan_ly' ||
    currentUser.permissions.canCheckInCars;
  const canDelete =
    !currentUser ||
    currentUser.role === 'quan_ly' ||
    currentUser.permissions.canDeleteReception;

  const [inputPlate, setInputPlate] = useState('');
  const [matchedAppointment, setMatchedAppointment] = useState<Appointment | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPlateSuggestionsOpen, setIsPlateSuggestionsOpen] = useState(false);
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState(0);
  const plateInputRef = useRef<HTMLInputElement>(null);
  const plateBoxRef = useRef<HTMLDivElement>(null);

  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedAdvisor, setSelectedAdvisor] = useState<string>('');
  const [selectedServices, setSelectedServices] = useState<string[]>(['Bảo Dưỡng']);
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
  const serviceDropdownRef = useRef<HTMLDivElement>(null);
  const [cardTicketNumber, setCardTicketNumber] = useState('');
  const [cardSlotCode, setCardSlotCode] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        serviceDropdownRef.current &&
        !serviceDropdownRef.current.contains(e.target as Node)
      ) {
        setIsServiceMenuOpen(false);
      }
      if (
        plateBoxRef.current &&
        !plateBoxRef.current.contains(e.target as Node)
      ) {
        setIsPlateSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!formSuccessMessage) return;
    const timer = setTimeout(() => setFormSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [formSuccessMessage]);

  const [activeRequestAdvisorId, setActiveRequestAdvisorId] = useState<string | null>(null);
  const [rowSelectedAdvisor, setRowSelectedAdvisor] = useState<Record<string, string>>({});
  const [transferringId, setTransferringId] = useState<string | null>(null);

  const [tableSearch, setTableSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'has_apt' | 'walk_in'>('all');

  const advisorActiveLoad = useMemo(() => {
    const counts: Record<string, number> = {};
    receptionEntries.forEach((e) => {
      if (
        e.advisorName &&
        (e.status === 'Đang Tiếp Nhận' || e.status === 'Cố Vấn Đang Tiếp Nhận')
      ) {
        counts[e.advisorName] = (counts[e.advisorName] || 0) + 1;
      }
    });
    return counts;
  }, [receptionEntries]);

  const priorityRequest: AdvisorPickupRequest | null = useMemo(() => {
    if (advisorRequests.length === 0) return null;
    if (activeRequestAdvisorId) {
      const matched = advisorRequests.find((r) => r.id === activeRequestAdvisorId);
      if (matched) return matched;
    }
    return advisorRequests[0];
  }, [advisorRequests, activeRequestAdvisorId]);

  const duplicateActiveEntry = useMemo(() => {
    const normalized = inputPlate.replace(/[\s.-]/g, '').toLowerCase();
    if (normalized.length < 4) return null;
    return (
      receptionEntries.find(
        (e) =>
          e.status !== 'Đã Giao Xe' &&
          e.status !== 'Hoàn Thành' &&
          e.licensePlate.replace(/[\s.-]/g, '').toLowerCase() === normalized
      ) || null
    );
  }, [inputPlate, receptionEntries]);

  const todayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.appointmentDate === currentDate && a.status !== 'Đã Hủy')
        .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime)),
    [appointments, currentDate]
  );

  const checkedInPlates = useMemo(
    () =>
      new Set(
        receptionEntries.map((e) => e.licensePlate.replace(/[\s.-]/g, '').toLowerCase())
      ),
    [receptionEntries]
  );

  const pendingAppointments = useMemo(
    () =>
      todayAppointments.filter(
        (a) => !checkedInPlates.has(a.licensePlate.replace(/[\s.-]/g, '').toLowerCase())
      ),
    [todayAppointments, checkedInPlates]
  );

  const plateSuggestions = useMemo(() => {
    const raw = inputPlate.trim();
    const norm = raw.replace(/[\s.-]/g, '').toLowerCase();
    if (!norm) {
      return pendingAppointments.slice(0, 6);
    }
    const qLower = raw.toLowerCase();
    return appointments
      .filter((a) => {
        if (a.status === 'Đã Hủy') return false;
        const plateNorm = a.licensePlate.replace(/[\s.-]/g, '').toLowerCase();
        const nameMatch = a.customerName.toLowerCase().includes(qLower);
        const phoneMatch = (a.phoneNumber || '').replace(/\s/g, '').includes(norm);
        return plateNorm.includes(norm) || nameMatch || phoneMatch;
      })
      .sort((a, b) => {
        const aToday = a.appointmentDate === currentDate ? 0 : 1;
        const bToday = b.appointmentDate === currentDate ? 0 : 1;
        if (aToday !== bToday) return aToday - bToday;
        return a.appointmentTime.localeCompare(b.appointmentTime);
      })
      .slice(0, 6);
  }, [inputPlate, pendingAppointments, appointments, currentDate]);

  const handleResetForm = (keepFocus = true) => {
    setInputPlate('');
    setMatchedAppointment(null);
    setHasSearched(false);
    setCustomerName('');
    setPhoneNumber('');
    setSelectedAdvisor('');
    setSelectedServices(['Bảo Dưỡng']);
    setIsServiceMenuOpen(false);
    setIsPlateSuggestionsOpen(false);
    setAllowDuplicateOverride(false);
    setCardTicketNumber('');
    if (keepFocus) {
      setTimeout(() => plateInputRef.current?.focus(), 0);
    }
  };

  const handlePlateChange = (val: string) => {
    const formatted = val.toUpperCase();
    setInputPlate(formatted);
    setFormSuccessMessage(null);
    setAllowDuplicateOverride(false);
    setHighlightedSuggestionIdx(0);
    setIsPlateSuggestionsOpen(true);

    if (formatted.trim().length >= 3) {
      const normalized = formatted.replace(/[\s.-]/g, '').toLowerCase();
      const exactToday = appointments.find(
        (a) =>
          a.appointmentDate === currentDate &&
          a.status !== 'Đã Hủy' &&
          a.licensePlate.replace(/[\s.-]/g, '').toLowerCase() === normalized
      );
      const anyMatch =
        exactToday ||
        appointments.find(
          (a) =>
            a.status !== 'Đã Hủy' &&
            a.licensePlate.replace(/[\s.-]/g, '').toLowerCase() === normalized
        );

      if (anyMatch) {
        setMatchedAppointment(anyMatch);
        setCustomerName(anyMatch.customerName);
        setPhoneNumber(anyMatch.phoneNumber || '');
        setSelectedAdvisor(anyMatch.advisorName || '');
        setSelectedServices(
          anyMatch.serviceTypes.length > 0 ? anyMatch.serviceTypes : ['Bảo Dưỡng']
        );
        setIsPlateSuggestionsOpen(false);
      } else {
        if (matchedAppointment) {
          setCustomerName('');
          setPhoneNumber('');
          setSelectedServices(['Bảo Dưỡng']);
        }
        setMatchedAppointment(null);
        setSelectedAdvisor('');
      }
      setHasSearched(true);
    } else {
      if (matchedAppointment) {
        setCustomerName('');
        setPhoneNumber('');
        setSelectedServices(['Bảo Dưỡng']);
      }
      setMatchedAppointment(null);
      setSelectedAdvisor('');
      setHasSearched(false);
    }
  };

  const handleSelectSingleService = (type: string) => {
    setSelectedServices([type]);
    setIsServiceMenuOpen(false);
  };

  const handleToggleService = (type: string) => {
    if (selectedServices.includes(type)) {
      if (selectedServices.length > 1) {
        setSelectedServices(selectedServices.filter((s) => s !== type));
      }
    } else {
      setSelectedServices([...selectedServices, type]);
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCheckIn || !inputPlate.trim() || isSubmitting) return;
    if (duplicateActiveEntry && !allowDuplicateOverride) return;

    const formattedPlate = inputPlate.trim().toUpperCase();

    let appointmentTimeStr: string | undefined = undefined;
    if (matchedAppointment) {
      const [, m, d] = (matchedAppointment.appointmentDate || currentDate).split('-');
      appointmentTimeStr = `${d}/${m} ${matchedAppointment.appointmentTime}`;
    }

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const checkInTimeStr = nowDate.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const chosenAdvisor = selectedAdvisor.trim();
    const ticketNum = cardTicketNumber.trim();

    const newEntry: ReceptionEntry = {
      id: `rec-${Date.now()}`,
      licensePlate: formattedPlate,
      hasAppointment: Boolean(matchedAppointment),
      appointmentId: matchedAppointment?.id,
      appointmentTime: appointmentTimeStr,
      appointmentContent: matchedAppointment?.content || undefined,
      suggestedAdvisorName: matchedAppointment?.advisorName || undefined,
      advisorName: chosenAdvisor,
      cardTicketNumber: ticketNum,
      cardSlotCode: cardSlotCode.trim() || '0',
      serviceTypes: selectedServices,
      customerName: customerName.trim() || 'KHÁCH HÀNG',
      phoneNumber: phoneNumber.trim(),
      checkInTime: checkInTimeStr,
      checkInDate: currentDate,
      status: 'Chờ Tiếp Nhận',
      badgeType: inferBadgeType(Boolean(matchedAppointment), selectedServices),
      priority: matchedAppointment?.priority || '',
      location: matchedAppointment?.location || 'Vũng Tàu',
      notes: '',
      createdAt: nowIso,
    };

    setIsSubmitting(true);
    try {
      await onAddReceptionEntry(newEntry);

      const ticketLabel = ticketNum ? ` (Thẻ #${ticketNum})` : '';
      setFormSuccessMessage(
        chosenAdvisor
          ? `Đã nhận ${formattedPlate}${ticketLabel} · CV: ${chosenAdvisor}`
          : `Đã nhận ${formattedPlate}${ticketLabel} vào hàng chờ`
      );

      setInputPlate('');
      setMatchedAppointment(null);
      setHasSearched(false);
      setCustomerName('');
      setPhoneNumber('');
      setSelectedAdvisor('');
      setSelectedServices(['Bảo Dưỡng']);
      setIsServiceMenuOpen(false);
      setIsPlateSuggestionsOpen(false);
      setAllowDuplicateOverride(false);
      setCardTicketNumber('');
      setCardSlotCode('0');
      setTimeout(() => plateInputRef.current?.focus(), 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSelectAppointment = (apt: Appointment) => {
    setInputPlate(apt.licensePlate);
    setMatchedAppointment(apt);
    setCustomerName(apt.customerName);
    setPhoneNumber(apt.phoneNumber || '');
    setSelectedAdvisor(apt.advisorName || '');
    setSelectedServices(apt.serviceTypes.length > 0 ? apt.serviceTypes : ['Bảo Dưỡng']);
    setIsServiceMenuOpen(false);
    setIsPlateSuggestionsOpen(false);
    setAllowDuplicateOverride(false);
    setHasSearched(true);
  };

  const handlePlateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (isPlateSuggestionsOpen) {
        e.preventDefault();
        setIsPlateSuggestionsOpen(false);
      } else if (inputPlate) {
        e.preventDefault();
        handleResetForm(true);
      }
      return;
    }

    if (!isPlateSuggestionsOpen || plateSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedSuggestionIdx((prev) => (prev + 1) % plateSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSuggestionIdx((prev) =>
        prev === 0 ? plateSuggestions.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter' && !matchedAppointment) {
      const candidate = plateSuggestions[highlightedSuggestionIdx];
      if (candidate) {
        const normInput = inputPlate.replace(/[\s.-]/g, '').toLowerCase();
        const normCand = candidate.licensePlate.replace(/[\s.-]/g, '').toLowerCase();
        if (normInput.length > 0 && normCand.includes(normInput) && normCand !== normInput) {
          e.preventDefault();
          handleQuickSelectAppointment(candidate);
        }
      }
    }
  };

  const handleTransferClick = async (
    entry: ReceptionEntry,
    targetAdvisorName: string,
    requestIdToClear?: string
  ) => {
    if (!targetAdvisorName.trim()) return;
    setTransferringId(entry.id);
    try {
      await onTransferToAdvisor(entry, targetAdvisorName.trim(), requestIdToClear);
    } finally {
      setTransferringId(null);
    }
  };

  const waitingEntries = receptionEntries.filter((e) => e.status === 'Chờ Tiếp Nhận');

  const filteredEntries = useMemo(() => {
    const list = waitingEntries.filter((entry) => {
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const matchPlate = entry.licensePlate.toLowerCase().includes(q);
        const matchName = entry.customerName.toLowerCase().includes(q);
        const matchAdvisor = (entry.advisorName || '').toLowerCase().includes(q);
        const matchSuggested = (entry.suggestedAdvisorName || '').toLowerCase().includes(q);
        const matchTicket = entry.cardTicketNumber.includes(q);
        const matchContent = (entry.appointmentContent || entry.notes || '')
          .toLowerCase()
          .includes(q);
        if (
          !matchPlate &&
          !matchName &&
          !matchAdvisor &&
          !matchSuggested &&
          !matchTicket &&
          !matchContent
        ) {
          return false;
        }
      }

      if (filterType === 'has_apt' && !entry.hasAppointment) return false;
      if (filterType === 'walk_in' && entry.hasAppointment) return false;
      return true;
    });

    return [...list].sort((a, b) =>
      (a.createdAt || a.checkInTime).localeCompare(b.createdAt || b.checkInTime)
    );
  }, [waitingEntries, tableSearch, filterType]);

  const fieldClass =
    'w-full h-9 px-3 bg-slate-50 dark:bg-[#182337] border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

  return (
    <div className="space-y-4">
      {/* LIVE 2-WAY BANNER: Service Advisors Currently Requesting Vehicles */}
      {advisorRequests.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-500/45 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-400/40 flex items-center justify-center text-amber-700 dark:text-amber-300">
                <BellRing className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Cố Vấn Đang Yêu Cầu Nhận Xe ({advisorRequests.length})
              </h3>
            </div>

            {priorityRequest &&
              waitingEntries.length > 0 &&
              canCheckIn &&
              (() => {
                const targetEntry =
                  waitingEntries.find((w) => w.advisorName === priorityRequest.advisorName) ||
                  waitingEntries.find((w) => !w.advisorName) ||
                  waitingEntries[0];
                return (
                  <button
                    type="button"
                    disabled={transferringId !== null}
                    onClick={() =>
                      handleTransferClick(
                        targetEntry,
                        priorityRequest.advisorName,
                        priorityRequest.id
                      )
                    }
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      Chuyển {targetEntry.licensePlate} → {priorityRequest.advisorName}
                    </span>
                  </button>
                );
              })()}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {advisorRequests.map((req, idx) => {
              const isSelected = priorityRequest?.id === req.id;
              const waitMins = getElapsedMinutes(req.createdAt, now);
              const load = advisorActiveLoad[req.advisorName] || 0;
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setActiveRequestAdvisorId(req.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 dark:border-amber-400 text-amber-950 dark:text-white'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:border-amber-400'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white dark:text-slate-950 font-bold text-[11px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>{req.advisorName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {load} đang làm
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-800/80 dark:text-amber-200/80 truncate max-w-[220px]">
                      {req.note || 'Sẵn sàng nhận xe'} • {waitMins}p trước
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2-Column Left/Right Split (active from 768px+): ~30% Left Form | ~70% Right Queue */}
      <div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[410px_minmax(0,1fr)] gap-4 items-start">
        {/* LEFT PANE: Nhập Thông Tin Xe Vào */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs md:sticky md:top-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Car className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Nhập Thông Tin Xe Vào
              </h2>
            </div>

            {inputPlate && canCheckIn && (
              <button
                type="button"
                onClick={() => handleResetForm(true)}
                title="Làm mới biểu mẫu (Esc)"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Mới</span>
              </button>
            )}
          </div>

          {formSuccessMessage && (
            <div className="mb-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 min-w-0">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium leading-snug">{formSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormSuccessMessage(null)}
                className="text-emerald-700 dark:text-slate-300 hover:text-emerald-900 dark:hover:text-white cursor-pointer shrink-0"
                title="Đóng"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {canCheckIn ? (
            <form onSubmit={handleCheckInSubmit} className="space-y-3">
              {/* 1. Biển Số Xe + Smart Autocomplete */}
              <div ref={plateBoxRef} className="relative">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Biển Số Xe <span className="text-red-500">*</span>
                  </label>
                  {matchedAppointment ? (
                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                      Có hẹn · {matchedAppointment.appointmentTime}
                    </span>
                  ) : hasSearched ? (
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      Khách vãng lai
                    </span>
                  ) : null}
                </div>

                <div className="relative">
                  <input
                    ref={plateInputRef}
                    type="text"
                    value={inputPlate}
                    onFocus={() => setIsPlateSuggestionsOpen(true)}
                    onChange={(e) => handlePlateChange(e.target.value)}
                    onKeyDown={handlePlateKeyDown}
                    placeholder="Gõ biển số hoặc 4 số cuối..."
                    required
                    autoComplete="off"
                    className={`w-full h-10 pl-3 pr-9 bg-white dark:bg-[#182337] border-2 rounded-lg text-slate-900 dark:text-white font-mono text-sm sm:text-base font-bold tracking-wider placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                      matchedAppointment
                        ? 'border-purple-500 focus:border-purple-500 focus:ring-purple-500/20'
                        : 'border-blue-500 focus:border-blue-600 focus:ring-blue-500/20'
                    }`}
                  />
                  {inputPlate ? (
                    <button
                      type="button"
                      onClick={() => handleResetForm(true)}
                      title="Xóa & nhập lại (Esc)"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  )}
                </div>

                {/* Instant Partial-Match Appointment Autocomplete */}
                {isPlateSuggestionsOpen && plateSuggestions.length > 0 && !matchedAppointment && (
                  <div className="absolute left-0 right-0 mt-1 z-40 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Lịch hẹn khớp ({plateSuggestions.length})</span>
                      <span>Enter để chọn</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {plateSuggestions.map((apt, i) => {
                        const isHighlighted = i === highlightedSuggestionIdx;
                        const isCheckedIn = checkedInPlates.has(
                          apt.licensePlate.replace(/[\s.-]/g, '').toLowerCase()
                        );
                        return (
                          <button
                            key={apt.id}
                            type="button"
                            onMouseEnter={() => setHighlightedSuggestionIdx(i)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleQuickSelectAppointment(apt);
                            }}
                            className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isHighlighted
                                ? 'bg-purple-50 dark:bg-purple-600/20'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                  {apt.licensePlate}
                                </span>
                                <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                                  {apt.customerName}
                                </span>
                                {isCheckedIn && (
                                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                    · Đã vào
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {apt.advisorName} · {apt.serviceTypes.join(', ')}
                              </div>
                            </div>
                            <span className="shrink-0 font-mono font-bold text-[11px] text-purple-700 dark:text-purple-300 tabular-nums">
                              {apt.appointmentTime}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Contextual Appointment Match */}
              {matchedAppointment && (
                <div className="px-2.5 py-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/40 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {inferBadgeType(true, matchedAppointment.serviceTypes) || 'H'}
                      </span>
                      <span className="font-bold text-purple-900 dark:text-purple-200 font-mono tabular-nums">
                        {matchedAppointment.appointmentTime}
                      </span>
                      {matchedAppointment.advisorName && (
                        <span className="text-slate-600 dark:text-slate-300 truncate">
                          · {matchedAppointment.advisorName}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                      Đã nạp
                    </span>
                  </div>
                  {matchedAppointment.content && (
                    <div className="text-[11px] text-purple-800 dark:text-purple-200/90 pl-6 line-clamp-2">
                      {matchedAppointment.content}
                    </div>
                  )}
                </div>
              )}

              {/* Duplicate Active Vehicle Guard */}
              {duplicateActiveEntry && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/50 rounded-lg space-y-1.5 text-xs">
                  <div className="flex items-start gap-1.5 text-red-800 dark:text-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">
                      Xe <strong className="font-mono">{duplicateActiveEntry.licensePlate}</strong> đang trong xưởng (
                      <strong>{duplicateActiveEntry.status}</strong>
                      {duplicateActiveEntry.cardTicketNumber?.trim()
                        ? ` · Thẻ #${duplicateActiveEntry.cardTicketNumber.trim()}`
                        : ''}
                      )
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white dark:bg-red-900/40 border border-red-300 dark:border-red-500/40 text-red-800 dark:text-red-100 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allowDuplicateOverride}
                      onChange={(e) => setAllowDuplicateOverride(e.target.checked)}
                      className="rounded border-red-400 text-red-600 focus:ring-red-500"
                    />
                    <span>Vẫn tạo phiếu mới</span>
                  </label>
                </div>
              )}

              {/* 3. Loại Hình + Số Thẻ */}
              <div className="grid grid-cols-12 gap-2">
                <div ref={serviceDropdownRef} className="col-span-8 relative">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Loại Hình
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsServiceMenuOpen((prev) => !prev)}
                    className={`${fieldClass} flex items-center justify-between gap-1.5 text-left cursor-pointer ${
                      isServiceMenuOpen ? 'border-blue-500 ring-1 ring-blue-500' : ''
                    }`}
                  >
                    <span className="truncate font-semibold text-slate-900 dark:text-white">
                      {selectedServices.join(', ')}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {selectedServices.length > 1 && (
                        <span className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-600/30 text-blue-700 dark:text-blue-200 font-mono text-[10px] font-bold">
                          {selectedServices.length}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                          isServiceMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isServiceMenuOpen && (
                    <div className="absolute left-0 right-0 mt-1 z-30 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 overflow-hidden">
                      {RECEPTION_SERVICE_TYPES.map((service) => {
                        const isSelected = selectedServices.includes(service);
                        return (
                          <div
                            key={service}
                            className={`flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-200 font-semibold'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectSingleService(service)}
                              className="flex-1 px-3 py-2 text-xs text-left truncate cursor-pointer"
                            >
                              {service}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleService(service);
                              }}
                              title="Chọn thêm / bỏ chọn nhiều loại hình"
                              className="px-2.5 py-2 flex items-center justify-center cursor-pointer"
                            >
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3" />}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="col-span-4">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Số Thẻ
                  </label>
                  <input
                    type="text"
                    value={cardTicketNumber}
                    onChange={(e) => setCardTicketNumber(e.target.value)}
                    placeholder="Nhập số"
                    className={`${fieldClass} font-bold font-mono text-center tabular-nums`}
                  />
                </div>
              </div>

              {/* 4. Phân Bổ Cố Vấn */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  <span>Phân Bổ Cố Vấn</span>
                  {matchedAppointment &&
                    matchedAppointment.advisorName &&
                    selectedAdvisor === matchedAppointment.advisorName && (
                      <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300">
                        Theo hẹn
                      </span>
                    )}
                </label>
                <select
                  value={selectedAdvisor}
                  onChange={(e) => setSelectedAdvisor(e.target.value)}
                  className={`${fieldClass} ${
                    selectedAdvisor ? 'border-blue-500/70 font-medium' : ''
                  }`}
                >
                  <option value="" className="bg-white dark:bg-[#111927]">
                    Chưa chỉ định (None)
                  </option>
                  {selectedAdvisor && !advisors.some((a) => a.name === selectedAdvisor) && (
                    <option value={selectedAdvisor} className="bg-white dark:bg-[#111927]">
                      {selectedAdvisor} (Theo hẹn)
                    </option>
                  )}
                  {advisors.map((adv) => (
                    <option
                      key={adv.id}
                      value={adv.name}
                      className="bg-white dark:bg-[#111927]"
                    >
                      {adv.name} ({advisorActiveLoad[adv.name] || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Tên Khách Hàng & Số Điện Thoại */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Tên Khách Hàng
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                    placeholder="VD: ANH KHOA"
                    className={`${fieldClass} font-medium`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Số Điện Thoại
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="090xxxxxxx"
                    className={`${fieldClass} font-mono tabular-nums`}
                  />
                </div>
              </div>

              {/* 6. Primary Submit Action */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !inputPlate.trim() ||
                    (Boolean(duplicateActiveEntry) && !allowDuplicateOverride)
                  }
                  className="w-full h-10 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>{isSubmitting ? 'Đang lưu...' : 'Nhận Xe Vào Hàng Chờ'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              Chế độ chỉ xem.
            </div>
          )}
        </div>

        {/* RIGHT PANE: Danh Sách Đang Chờ Tiếp Nhận */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col min-w-0 md:min-h-[520px]">
          {/* Header + Filter Tabs + Search */}
          <div className="px-4 py-3 bg-slate-50/80 dark:bg-[#111928] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Danh Sách Đang Chờ Tiếp Nhận
              </h3>
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                ({filteredEntries.length})
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-slate-100 dark:bg-[#172236] border border-slate-200 dark:border-slate-700/80 rounded-lg p-0.5 text-xs">
                {[
                  { key: 'all', label: `Đang chờ (${waitingEntries.length})` },
                  { key: 'has_apt', label: 'Có hẹn' },
                  { key: 'walk_in', label: 'Vãng lai' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilterType(tab.key as 'all' | 'has_apt' | 'walk_in')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      filterType === tab.key
                        ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 min-w-[160px] sm:w-52">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Tìm biển số, KH, CV..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-[#172236] border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Adaptive 5-Column Queue Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200">
              <thead className="bg-slate-50 dark:bg-[#131d30] text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-2 w-8 text-center font-mono">#</th>
                  <th className="py-2.5 px-3">BIỂN SỐ &amp; HẸN</th>
                  <th className="py-2.5 px-3">KHÁCH HÀNG &amp; LOẠI HÌNH</th>
                  <th className="py-2.5 px-3">TRẠNG THÁI</th>
                  <th className="py-2.5 px-3 text-right">CHUYỂN CỐ VẤN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500 dark:text-slate-400">
                      Không có xe nào đang chờ tiếp nhận.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry, index) => {
                    const isWaiting = entry.status === 'Chờ Tiếp Nhận';
                    const isReceiving =
                      entry.status === 'Đang Tiếp Nhận' ||
                      entry.status === 'Cố Vấn Đang Tiếp Nhận';
                    const isDone =
                      entry.status === 'Đã Tiếp Nhận' ||
                      entry.status === 'Đã Vào Khoang' ||
                      entry.status === 'Hoàn Thành';
                    const waitMins = getElapsedMinutes(entry.createdAt, now);
                    const receivingMins = getElapsedMinutes(
                      entry.assignedAt || entry.createdAt,
                      now
                    );

                    const defaultRowAdvisor =
                      rowSelectedAdvisor[entry.id] ||
                      entry.advisorName ||
                      (entry.suggestedAdvisorName &&
                      advisors.some((a) => a.name === entry.suggestedAdvisorName)
                        ? entry.suggestedAdvisorName
                        : priorityRequest?.advisorName || advisors[0]?.name || '');

                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-2 text-center font-bold text-slate-500 dark:text-slate-400 text-xs font-mono tabular-nums">
                          {index + 1}
                        </td>

                        {/* Biển số + Giờ vào + Giờ hẹn */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="inline-block relative">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-600 text-white shadow-xs">
                              {entry.badgeType || entry.hasAppointment ? (
                                <div className="w-4 h-4 rounded-full bg-white text-purple-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {entry.badgeType || 'H'}
                                </div>
                              ) : null}
                              <span className="font-mono font-bold text-xs tracking-wider pr-0.5">
                                {entry.licensePlate}
                              </span>
                            </div>
                            {entry.cardTicketNumber?.trim() && (
                              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 rounded-full bg-red-600 text-white font-mono font-bold text-[10px] shadow-xs border border-white leading-none tabular-nums">
                                {entry.cardTicketNumber.trim()}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 font-mono tabular-nums">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{entry.checkInTime}</span>
                            {entry.hasAppointment ? (
                              <span className="text-purple-700 dark:text-purple-300 font-semibold">
                                · Hẹn {entry.appointmentTime || 'ngày'}
                              </span>
                            ) : (
                              <span className="font-sans text-slate-400 dark:text-slate-500">
                                · Vãng lai
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Khách hàng + SĐT + Loại hình + Nội dung hẹn */}
                        <td className="py-3 px-3 max-w-[220px]">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase leading-snug truncate">
                            {entry.customerName}
                          </div>
                          <div className="text-[11px] text-blue-600 dark:text-blue-300 font-medium truncate">
                            {entry.serviceTypes.join(', ')}
                            {entry.phoneNumber && (
                              <span className="text-slate-500 dark:text-slate-400 font-mono font-normal tabular-nums">
                                {' '}· {entry.phoneNumber}
                              </span>
                            )}
                          </div>
                          {(entry.appointmentContent || entry.notes) && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {entry.appointmentContent || entry.notes}
                            </div>
                          )}
                        </td>

                        {/* Trạng thái & Thời gian chờ */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isWaiting && (
                            <div className="space-y-0.5">
                              <div className="text-amber-700 dark:text-amber-300 font-bold text-[11px]">
                                Chờ Tiếp Nhận
                              </div>
                              {entry.advisorName ? (
                                <div className="text-[11px] text-blue-600 dark:text-blue-300 font-semibold flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[105px]">{entry.advisorName}</span>
                                </div>
                              ) : entry.suggestedAdvisorName ? (
                                <div className="text-[10px] text-purple-600 dark:text-purple-300">
                                  Hẹn: <strong>{entry.suggestedAdvisorName}</strong>
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  CV: <span className="text-amber-700 dark:text-amber-200 font-semibold">Chưa gán</span>
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                Chờ {waitMins} phút
                              </div>
                            </div>
                          )}

                          {isReceiving && (
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-600 text-white font-semibold text-[11px]">
                                <span>Đang Tiếp Nhận</span>
                                <span className="font-mono font-bold text-[10px] tabular-nums">
                                  {receivingMins}p
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-purple-500" />
                                <span>{entry.advisorName}</span>
                              </div>
                            </div>
                          )}

                          {isDone && (
                            <div className="space-y-0.5">
                              <div className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đã Tiếp Nhận</span>
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                                CV: {entry.advisorName}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Chuyển Cố Vấn */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {isWaiting && canCheckIn && (
                              <>
                                {priorityRequest && (
                                  <button
                                    type="button"
                                    disabled={transferringId === entry.id}
                                    onClick={() =>
                                      handleTransferClick(
                                        entry,
                                        priorityRequest.advisorName,
                                        priorityRequest.id
                                      )
                                    }
                                    title={`Chuyển ngay cho ${priorityRequest.advisorName}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    <Send className="w-3 h-3" />
                                    <span>→ {priorityRequest.advisorName}</span>
                                  </button>
                                )}

                                <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-[#172236] border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                                  <select
                                    value={defaultRowAdvisor}
                                    onChange={(e) =>
                                      setRowSelectedAdvisor((prev) => ({
                                        ...prev,
                                        [entry.id]: e.target.value,
                                      }))
                                    }
                                    className="bg-transparent text-slate-800 dark:text-slate-200 text-xs px-1.5 py-1 focus:outline-none max-w-[125px] xl:max-w-[155px]"
                                  >
                                    {defaultRowAdvisor &&
                                      !advisors.some((a) => a.name === defaultRowAdvisor) && (
                                        <option
                                          value={defaultRowAdvisor}
                                          className="bg-white dark:bg-[#111927] text-slate-900 dark:text-slate-100"
                                        >
                                          {defaultRowAdvisor}
                                        </option>
                                      )}
                                    {advisors.map((adv) => (
                                      <option
                                        key={adv.id}
                                        value={adv.name}
                                        className="bg-white dark:bg-[#111927] text-slate-900 dark:text-slate-100"
                                      >
                                        {adv.name} ({advisorActiveLoad[adv.name] || 0})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={!defaultRowAdvisor || transferringId === entry.id}
                                    onClick={() => {
                                      const matchingReq = advisorRequests.find(
                                        (r) => r.advisorName === defaultRowAdvisor
                                      );
                                      handleTransferClick(
                                        entry,
                                        defaultRowAdvisor,
                                        matchingReq?.id
                                      );
                                    }}
                                    className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40"
                                  >
                                    Chuyển
                                  </button>
                                </div>
                              </>
                            )}

                            {isReceiving && canCheckIn && (
                              <button
                                type="button"
                                onClick={() => onRecallFromAdvisor(entry)}
                                title="Thu hồi về hàng chờ Lễ Tân"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/20 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Thu hồi</span>
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => onDeleteReceptionEntry(entry.id)}
                                title="Xóa khỏi danh sách"
                                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
};
