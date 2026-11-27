import React, { useState, useEffect, useMemo } from 'react';
import {
  AdvisorPickupRequest,
  Appointment,
  ReceptionEntry,
  ReceptionStatus,
  ServiceAdvisor,
  UserAccount,
} from '../types/appointment';
import {
  BellRing,
  Clock,
  FileText,
  X,
  Lock,
  XCircle,
  Car,
  Hourglass,
  ArrowRightCircle,
  UserCheck,
  ChevronDown,
  Save,
  History,
  RotateCcw,
  AlertTriangle,
  Search,
  CheckCircle2,
} from 'lucide-react';

interface AdvisorTabProps {
  currentDate: string;
  appointments: Appointment[];
  receptionEntries: ReceptionEntry[];
  advisors: ServiceAdvisor[];
  advisorRequests: AdvisorPickupRequest[];
  currentUser: UserAccount;
  now: Date;
  onSelectAppointment: (appointment: Appointment) => void;
  onUpdateReceptionStatus: (entry: ReceptionEntry) => Promise<void> | void;
  onStartReceivingVehicle: (
    entry: ReceptionEntry,
    targetAdvisorName: string
  ) => Promise<void>;
  onReturnToWaitingQueue: (entry: ReceptionEntry) => Promise<void>;
  onRequestPickup: (note?: string) => Promise<void>;
  onCancelPickupRequest: (requestId: string) => Promise<void>;
}

const SERVICE_TYPE_OPTIONS = [
  'Bảo Dưỡng',
  'Sửa Chữa Chung',
  'Đồng Sơn',
  'BG BHiểm',
  'Kiểm Tra Xe',
  'Chăm Sóc & Làm Đẹp Xe',
];

const CAR_WASH_OPTIONS = [
  '',
  'Có Rửa Xe',
  'Không Rửa Xe',
  'Đang Rửa Xe',
  'Đã Rửa Xong',
];

const CUSTOMER_WAITING_OPTIONS = [
  '',
  'Khách Chờ Lấy Liền',
  'Khách Ở Phòng Chờ',
  'Khách Để Xe Lại',
  'Khách Không Chờ',
];

const ADVISOR_STATUS_OPTIONS: ReceptionStatus[] = [
  'Đang Tiếp Nhận',
  'Đã Tiếp Nhận',
  'Đã Vào Khoang',
  'Đang Sửa Chữa',
  'Chờ Rửa Xe',
  'Chờ Giao Xe',
  'Đã Giao Xe',
  'Hoàn Thành',
];

const PRIORITY_OPTIONS = [
  '',
  'Thường',
  'Ưu Tiên',
  'VIP',
  'Gấp',
  'Khách Chờ Lấy Liền',
];

function getElapsedMinutes(isoTimestamp: string | undefined, now: Date): number {
  if (!isoTimestamp) return 0;
  const parsed = new Date(isoTimestamp).getTime();
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 60000));
}

function isReceivingStatus(status: ReceptionEntry['status']): boolean {
  return status === 'Đang Tiếp Nhận' || status === 'Cố Vấn Đang Tiếp Nhận';
}

function isCompletedOrDeliveredStatus(status: ReceptionEntry['status']): boolean {
  return status === 'Đã Giao Xe' || status === 'Hoàn Thành';
}

function formatDeliveryDisplay(val?: string): string {
  if (!val) return '';
  if (val.includes('T')) {
    const [datePart, timePart] = val.split('T');
    const [, m, d] = datePart.split('-');
    if (d && m && timePart) {
      return `${d}/${m} ${timePart.slice(0, 5)}`;
    }
  }
  return val;
}

function getGjBpSummary(serviceTypes: string[]): { gj: string; bp: string } {
  const gjList = serviceTypes.filter(
    (s) =>
      !s.toLowerCase().includes('đồng sơn') &&
      !s.toLowerCase().includes('bhiểm') &&
      !s.toLowerCase().includes('bảo hiểm')
  );
  const bpList = serviceTypes.filter(
    (s) =>
      s.toLowerCase().includes('đồng sơn') ||
      s.toLowerCase().includes('bhiểm') ||
      s.toLowerCase().includes('bảo hiểm')
  );
  return {
    gj: gjList.join(', '),
    bp: bpList.join(', '),
  };
}

function getDeliveryCountdown(
  deliveryDate: string | undefined,
  now: Date
): { status: 'overdue' | 'soon' | 'ok'; diffMins: number } | null {
  if (!deliveryDate || !deliveryDate.trim()) return null;
  const targetMs = new Date(deliveryDate).getTime();
  if (Number.isNaN(targetMs)) return null;
  const diffMins = Math.floor((targetMs - now.getTime()) / 60000);
  if (diffMins < 0) return { status: 'overdue', diffMins };
  if (diffMins <= 30) return { status: 'soon', diffMins };
  return { status: 'ok', diffMins };
}

function formatClockTime(isoTimestamp?: string): string {
  if (!isoTimestamp) return '--:--';
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getDurationMinutes(startIso?: string, endIso?: string): number | null {
  if (!startIso || !endIso) return null;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return Math.max(0, Math.floor((e - s) / 60000));
}

function formatDurationLabel(mins: number | null): string {
  if (mins === null) return '';
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}g ${m}p` : `${h}g`;
  }
  return `${mins}p`;
}

export const AdvisorTab: React.FC<AdvisorTabProps> = ({
  currentDate,
  appointments,
  receptionEntries,
  advisors,
  advisorRequests,
  currentUser,
  now,
  onUpdateReceptionStatus,
  onStartReceivingVehicle,
  onReturnToWaitingQueue,
  onRequestPickup,
  onCancelPickupRequest,
}) => {
  const isAdvisorRole = currentUser.role === 'co_van';
  const isManager = currentUser.role === 'quan_ly';

  const [selectedAdvisor, setSelectedAdvisor] = useState<string>(
    isAdvisorRole ? currentUser.fullName : 'all'
  );
  const [pickupNote, setPickupNote] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [managerRowAdvisor, setManagerRowAdvisor] = useState<Record<string, string>>({});

  const [selectedEntry, setSelectedEntry] = useState<ReceptionEntry | null>(null);
  const [isUpdatingEntry, setIsUpdatingEntry] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyScope, setHistoryScope] = useState<'today' | 'all'>('today');
  const [historySearch, setHistorySearch] = useState('');

  const [formPlate, setFormPlate] = useState('');
  const [formAdvisor, setFormAdvisor] = useState('');
  const [formServiceTypes, setFormServiceTypes] = useState<string[]>(['Bảo Dưỡng']);
  const [formDeliveryDate, setFormDeliveryDate] = useState('');
  const [formCarWash, setFormCarWash] = useState('');
  const [formCustomerWaiting, setFormCustomerWaiting] = useState('');
  const [formStatus, setFormStatus] = useState<ReceptionStatus>('Đang Tiếp Nhận');
  const [formPriority, setFormPriority] = useState('');
  const [formLocation, setFormLocation] = useState('Vũng Tàu');
  const [formContent, setFormContent] = useState('');

  useEffect(() => {
    if (isAdvisorRole) {
      setSelectedAdvisor(currentUser.fullName);
    }
  }, [isAdvisorRole, currentUser.fullName]);

  const myPickupRequest = useMemo(
    () =>
      advisorRequests.find(
        (r) => r.id === currentUser.id || r.advisorName === currentUser.fullName
      ) || null,
    [advisorRequests, currentUser.id, currentUser.fullName]
  );

  const waitingVehicles = useMemo(() => {
    const waiting = receptionEntries.filter(
      (entry) => entry.status === 'Chờ Tiếp Nhận'
    );

    const scoped = isAdvisorRole
      ? waiting.filter(
          (e) =>
            !e.advisorName ||
            e.advisorName.trim() === '' ||
            e.advisorName === currentUser.fullName
        )
      : selectedAdvisor === 'all'
      ? waiting
      : waiting.filter(
          (e) =>
            !e.advisorName ||
            e.advisorName.trim() === '' ||
            e.advisorName === selectedAdvisor
        );

    return [...scoped].sort((a, b) => {
      const aAssigned = Boolean(a.advisorName && a.advisorName.trim());
      const bAssigned = Boolean(b.advisorName && b.advisorName.trim());
      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;
      return (a.createdAt || a.checkInTime).localeCompare(
        b.createdAt || b.checkInTime
      );
    });
  }, [receptionEntries, isAdvisorRole, currentUser.fullName, selectedAdvisor]);

  const advisorVehicles = useMemo(() => {
    const active = receptionEntries.filter(
      (entry) =>
        Boolean(entry.advisorName && entry.advisorName.trim()) &&
        entry.status !== 'Chờ Tiếp Nhận' &&
        !isCompletedOrDeliveredStatus(entry.status)
    );

    const scoped = isAdvisorRole
      ? active.filter((e) => e.advisorName === currentUser.fullName)
      : selectedAdvisor === 'all'
      ? active
      : active.filter((e) => e.advisorName === selectedAdvisor);

    return [...scoped].sort((a, b) => {
      const aReceiving = isReceivingStatus(a.status);
      const bReceiving = isReceivingStatus(b.status);
      if (aReceiving && !bReceiving) return -1;
      if (!aReceiving && bReceiving) return 1;
      if (aReceiving && bReceiving) {
        return (a.assignedAt || a.createdAt || '').localeCompare(
          b.assignedAt || b.createdAt || ''
        );
      }
      return (b.updatedAt || b.receivedAt || '').localeCompare(
        a.updatedAt || a.receivedAt || ''
      );
    });
  }, [receptionEntries, isAdvisorRole, currentUser.fullName, selectedAdvisor]);

  const receivingCount = advisorVehicles.filter((v) => isReceivingStatus(v.status)).length;
  const activeProgressCount = advisorVehicles.filter((v) => !isReceivingStatus(v.status)).length;

  const overdueKpiCount = useMemo(
    () =>
      advisorVehicles.filter(
        (v) =>
          isReceivingStatus(v.status) &&
          getElapsedMinutes(v.assignedAt || v.createdAt, now) >= 15
      ).length,
    [advisorVehicles, now]
  );

  const overdueDeliveryCount = useMemo(
    () =>
      advisorVehicles.filter(
        (v) => getDeliveryCountdown(v.deliveryDate, now)?.status === 'overdue'
      ).length,
    [advisorVehicles, now]
  );

  const deliveredVehicles = useMemo(() => {
    const list = receptionEntries.filter((entry) => {
      if (!isCompletedOrDeliveredStatus(entry.status)) return false;
      if (!entry.advisorName || !entry.advisorName.trim()) return false;
      if (isAdvisorRole) return entry.advisorName === currentUser.fullName;
      if (selectedAdvisor !== 'all') return entry.advisorName === selectedAdvisor;
      return true;
    });

    return [...list].sort((a, b) =>
      (b.deliveredAt || b.updatedAt || b.createdAt || '').localeCompare(
        a.deliveredAt || a.updatedAt || a.createdAt || ''
      )
    );
  }, [receptionEntries, isAdvisorRole, currentUser.fullName, selectedAdvisor]);

  const deliveredTodayVehicles = useMemo(
    () =>
      deliveredVehicles.filter(
        (e) =>
          e.checkInDate === currentDate ||
          (e.deliveredAt ? e.deliveredAt.slice(0, 10) === currentDate : false)
      ),
    [deliveredVehicles, currentDate]
  );

  const filteredHistoryVehicles = useMemo(() => {
    const base = historyScope === 'today' ? deliveredTodayVehicles : deliveredVehicles;
    const q = historySearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (e) =>
        e.licensePlate.toLowerCase().includes(q) ||
        e.customerName.toLowerCase().includes(q) ||
        (e.phoneNumber || '').toLowerCase().includes(q) ||
        (e.advisorName || '').toLowerCase().includes(q) ||
        (e.cardTicketNumber || '').toLowerCase().includes(q) ||
        (e.appointmentContent || e.notes || '').toLowerCase().includes(q)
    );
  }, [deliveredTodayVehicles, deliveredVehicles, historyScope, historySearch]);

  const canStartWaitingEntry = (entry: ReceptionEntry) => {
    if (entry.status !== 'Chờ Tiếp Nhận') return false;
    if (isManager) return true;
    if (isAdvisorRole && currentUser.permissions.canUpdateVehicleStatus) {
      return (
        !entry.advisorName ||
        entry.advisorName.trim() === '' ||
        entry.advisorName === currentUser.fullName
      );
    }
    return false;
  };

  const canModifyEntry = (entry: ReceptionEntry) => {
    if (isManager) return true;
    if (
      isAdvisorRole &&
      currentUser.permissions.canUpdateVehicleStatus &&
      entry.advisorName === currentUser.fullName &&
      entry.status !== 'Hoàn Thành'
    ) {
      return true;
    }
    return false;
  };

  const canReturnEntryToQueue = (entry: ReceptionEntry) => {
    if (entry.status === 'Chờ Tiếp Nhận') return false;
    if (isCompletedOrDeliveredStatus(entry.status)) return false;
    if (isManager) return true;
    if (
      isAdvisorRole &&
      currentUser.permissions.canUpdateVehicleStatus &&
      entry.advisorName === currentUser.fullName &&
      isReceivingStatus(entry.status)
    ) {
      return true;
    }
    return false;
  };

  const resolveTargetAdvisorForWaiting = (entry: ReceptionEntry): string => {
    if (isAdvisorRole) return currentUser.fullName;
    if (entry.advisorName && entry.advisorName.trim()) return entry.advisorName;
    if (managerRowAdvisor[entry.id]) return managerRowAdvisor[entry.id];
    if (selectedAdvisor !== 'all') return selectedAdvisor;
    return advisors[0]?.name || currentUser.fullName;
  };

  const findLinkedAppointment = (entry: ReceptionEntry) => {
    if (entry.appointmentId) {
      const byId = appointments.find((a) => a.id === entry.appointmentId);
      if (byId) return byId;
    }
    const norm = entry.licensePlate.replace(/[\s.-]/g, '').toLowerCase();
    return appointments.find(
      (a) => a.licensePlate.replace(/[\s.-]/g, '').toLowerCase() === norm
    );
  };

  const handleStartReceiving = async (
    entry: ReceptionEntry,
    overrideAdvisorName?: string
  ) => {
    if (!canStartWaitingEntry(entry)) return;
    const targetName = (
      overrideAdvisorName || resolveTargetAdvisorForWaiting(entry)
    ).trim();
    if (!targetName) return;

    setClaimingId(entry.id);
    try {
      await onStartReceivingVehicle(entry, targetName);
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry(null);
      }
    } finally {
      setClaimingId(null);
    }
  };

  const handleOpenDetail = (entry: ReceptionEntry) => {
    const linkedApt = findLinkedAppointment(entry);
    setSelectedEntry(entry);
    setIsServiceDropdownOpen(false);
    setFormPlate(entry.licensePlate);
    setFormAdvisor(entry.advisorName || '');
    setFormServiceTypes(
      entry.serviceTypes && entry.serviceTypes.length > 0
        ? [...entry.serviceTypes]
        : ['Bảo Dưỡng']
    );
    setFormDeliveryDate(entry.deliveryDate || '');
    setFormCarWash(entry.carWash || '');
    setFormCustomerWaiting(entry.customerWaiting || '');
    setFormStatus(
      entry.status === 'Cố Vấn Đang Tiếp Nhận' ? 'Đang Tiếp Nhận' : entry.status
    );
    setFormPriority(entry.priority ?? linkedApt?.priority ?? '');
    setFormLocation(entry.location || linkedApt?.location || 'Vũng Tàu');
    setFormContent(
      entry.appointmentContent ?? linkedApt?.content ?? entry.notes ?? ''
    );
  };

  const handleRemoveServiceChip = (service: string) => {
    if (formServiceTypes.length <= 1) return;
    setFormServiceTypes((prev) => prev.filter((s) => s !== service));
  };

  const handleToggleServiceOption = (service: string) => {
    setFormServiceTypes((prev) => {
      if (prev.includes(service)) {
        return prev.length > 1 ? prev.filter((s) => s !== service) : prev;
      }
      return [...prev, service];
    });
  };

  const handleSaveProgress = async (overrideStatus?: ReceptionStatus) => {
    if (!selectedEntry || !canModifyEntry(selectedEntry)) return;

    const finalStatus: ReceptionStatus = overrideStatus || formStatus;
    const nowIso = new Date().toISOString();

    const updatedPayload: ReceptionEntry = {
      ...selectedEntry,
      licensePlate:
        isManager && formPlate.trim()
          ? formPlate.trim().toUpperCase()
          : selectedEntry.licensePlate,
      advisorName:
        isManager && formAdvisor.trim()
          ? formAdvisor.trim()
          : selectedEntry.advisorName,
      serviceTypes: formServiceTypes.length > 0 ? formServiceTypes : ['Bảo Dưỡng'],
      deliveryDate: formDeliveryDate.trim(),
      carWash: formCarWash.trim(),
      customerWaiting: formCustomerWaiting.trim(),
      status: finalStatus,
      priority: formPriority.trim(),
      location: formLocation.trim() || 'Vũng Tàu',
      appointmentContent: formContent.trim(),
      notes: formContent.trim(),
      receivedAt:
        finalStatus === 'Đã Tiếp Nhận' && !selectedEntry.receivedAt
          ? nowIso
          : selectedEntry.receivedAt,
      deliveredAt:
        finalStatus === 'Đã Giao Xe' || finalStatus === 'Hoàn Thành'
          ? nowIso
          : selectedEntry.deliveredAt,
    };

    setIsUpdatingEntry(true);
    try {
      await onUpdateReceptionStatus(updatedPayload);
      setSelectedEntry(null);
    } finally {
      setIsUpdatingEntry(false);
    }
  };

  const handleReturnToQueue = async () => {
    if (!selectedEntry || !canReturnEntryToQueue(selectedEntry)) return;
    setIsReturning(true);
    try {
      await onReturnToWaitingQueue(selectedEntry);
      setSelectedEntry(null);
    } finally {
      setIsReturning(false);
    }
  };

  const handleTriggerPickupRequest = async () => {
    setIsSubmittingRequest(true);
    try {
      await onRequestPickup(pickupNote.trim() || 'Sẵn sàng nhận xe tiếp theo');
      setPickupNote('');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleCancelMyRequest = async () => {
    if (!myPickupRequest) return;
    setIsSubmittingRequest(true);
    try {
      await onCancelPickupRequest(myPickupRequest.id);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const showAdvisorColumn = !isAdvisorRole && selectedAdvisor === 'all';
  const gjBp = getGjBpSummary(formServiceTypes);

  const modalInputClass =
    'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1a2436] border border-slate-200 dark:border-slate-600/80 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-65 disabled:cursor-not-allowed';

  const modalOptionClass = 'bg-white dark:bg-[#111927] text-slate-900 dark:text-slate-100';

  return (
    <div className="space-y-4">
      {/* Top Control & 2-Way Pickup Request Bar */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Bảng Theo Dõi Cố Vấn
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold">
              {isAdvisorRole
                ? currentUser.fullName
                : selectedAdvisor === 'all'
                ? 'Tất cả Cố Vấn'
                : selectedAdvisor}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
            <span>
              Chờ TN:{' '}
              <strong className="text-amber-700 dark:text-amber-300 font-mono text-sm">
                {waitingVehicles.length}
              </strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>
              Đang TN:{' '}
              <strong className="text-purple-700 dark:text-purple-300 font-mono text-sm">
                {receivingCount}
              </strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>
              Đang xử lý:{' '}
              <strong className="text-emerald-700 dark:text-emerald-300 font-mono text-sm">
                {activeProgressCount}
              </strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 border border-sky-200 dark:border-sky-500/35 text-sky-700 dark:text-sky-200 font-semibold transition-colors cursor-pointer"
              title="Xem lịch sử xe đã giao"
            >
              <History className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300" />
              <span>Đã Giao Hôm Nay:</span>
              <strong className="text-sky-900 dark:text-white font-mono text-xs">
                {deliveredTodayVehicles.length}
              </strong>
              {deliveredVehicles.length > deliveredTodayVehicles.length && (
                <span className="text-[10px] text-sky-600/80 dark:text-sky-300/80">
                  (Tổng {deliveredVehicles.length})
                </span>
              )}
            </button>
            {overdueKpiCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/45 text-red-700 dark:text-red-200 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span>Quá KPI TN (≥15p): {overdueKpiCount}</span>
              </span>
            )}
            {overdueDeliveryCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-500/20 border border-orange-200 dark:border-orange-500/45 text-orange-700 dark:text-orange-200 font-bold">
                <Clock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                <span>Quá giờ giao: {overdueDeliveryCount}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {isAdvisorRole ? (
            myPickupRequest ? (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/40">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-amber-900 dark:text-amber-200">
                    Đang yêu cầu Lễ Tân chuyển xe
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300/80">
                    {getElapsedMinutes(myPickupRequest.createdAt, now)} phút trước
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelMyRequest}
                  disabled={isSubmittingRequest}
                  className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900/90 hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Hủy</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={pickupNote}
                  onChange={(e) => setPickupNote(e.target.value)}
                  placeholder="Ghi chú nhanh..."
                  className="px-3 py-2 bg-slate-50 dark:bg-[#182337] border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-52 sm:w-60"
                />
                <button
                  type="button"
                  onClick={handleTriggerPickupRequest}
                  disabled={isSubmittingRequest}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <BellRing className="w-4 h-4" />
                  <span>{isSubmittingRequest ? 'Đang gửi...' : 'Yêu Cầu Nhận Xe'}</span>
                </button>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2.5 flex-wrap">
              {advisorRequests.length > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  <BellRing className="w-3.5 h-3.5" />
                  <span>
                    {advisorRequests.length} CV gọi xe:{' '}
                    {advisorRequests.map((r) => r.advisorName).join(', ')}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Cố Vấn:
                </span>
                <select
                  value={selectedAdvisor}
                  onChange={(e) => setSelectedAdvisor(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-[#182337] border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="all" className={modalOptionClass}>
                    Tất cả Cố Vấn ({advisors.length})
                  </option>
                  {advisors.map((a) => (
                    <option key={a.id} value={a.name} className={modalOptionClass}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WAITING RECEPTION QUEUE */}
      <div className="bg-white dark:bg-[#111827] border border-amber-200 dark:border-amber-500/35 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-amber-50/70 dark:bg-amber-950/35 border-b border-amber-200/80 dark:border-amber-500/25 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-400/40 flex items-center justify-center text-amber-700 dark:text-amber-300">
              <Hourglass className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <span>Xe Đang Chờ Tiếp Nhận</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/25 border border-amber-300 dark:border-amber-400/40 text-amber-800 dark:text-amber-200 font-mono text-xs">
                {waitingVehicles.length} xe
              </span>
            </h3>
          </div>
        </div>

        {waitingVehicles.length === 0 ? (
          <div className="py-6 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Không có xe đang chờ tiếp nhận.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#121b2d] text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 min-w-[180px]">BIỂN SỐ</th>
                  <th className="py-3 px-4 min-w-[170px]">PHÂN BỔ CỐ VẤN</th>
                  <th className="py-3 px-4 min-w-[140px]">LOẠI HÌNH</th>
                  <th className="py-3 px-4 min-w-[160px]">TÊN KH</th>
                  <th className="py-3 px-4 min-w-[170px]">GIỜ HẸN / NỘI DUNG</th>
                  <th className="py-3 px-4 text-right min-w-[170px]">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {waitingVehicles.map((entry, idx) => {
                  const waitMins = getElapsedMinutes(entry.createdAt, now);
                  const isAssignedToAdvisor = Boolean(
                    entry.advisorName && entry.advisorName.trim()
                  );
                  const linkedApt = findLinkedAppointment(entry);
                  const bookedContent = entry.appointmentContent || linkedApt?.content;
                  const canStart = canStartWaitingEntry(entry);
                  const targetManagerAdvisor = resolveTargetAdvisorForWaiting(entry);

                  return (
                    <tr
                      key={entry.id}
                      onClick={() => handleOpenDetail(entry)}
                      className="bg-white dark:bg-[#0f1829] hover:bg-slate-50 dark:hover:bg-[#162238] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-500 dark:text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {entry.hasAppointment || entry.badgeType ? (
                            <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                              {entry.badgeType || 'H'}
                            </span>
                          ) : null}
                          <span className="font-mono font-bold text-sm text-slate-900 dark:text-white tracking-wider">
                            {entry.licensePlate}
                          </span>
                          {entry.cardTicketNumber && (
                            <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-mono font-bold text-[10px]">
                              #{entry.cardTicketNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-amber-700 dark:text-amber-300/85 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            {entry.checkInTime} • Chờ {waitMins}p
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {isAssignedToAdvisor ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-400/40 text-blue-700 dark:text-blue-200 font-semibold text-[11px]">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>
                              {isAdvisorRole && entry.advisorName === currentUser.fullName
                                ? entry.hasAppointment
                                  ? 'Hẹn với bạn'
                                  : 'Chỉ định cho bạn'
                                : entry.advisorName}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-200 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>None</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-200 font-medium">
                        {entry.serviceTypes.join(', ')}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white uppercase">
                          {entry.customerName}
                        </div>
                        {entry.phoneNumber && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {entry.phoneNumber}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-[240px]">
                        {entry.appointmentTime ? (
                          <div className="font-mono font-semibold text-purple-700 dark:text-purple-300 text-[11px]">
                            Hẹn: {entry.appointmentTime}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500">Vãng lai</div>
                        )}
                        {(bookedContent || entry.notes) && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[230px] mt-0.5">
                            {bookedContent || entry.notes}
                          </div>
                        )}
                      </td>

                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canStart ? (
                          <div className="inline-flex items-center gap-1.5">
                            {isManager && !isAssignedToAdvisor && selectedAdvisor === 'all' && (
                              <select
                                value={targetManagerAdvisor}
                                onChange={(e) =>
                                  setManagerRowAdvisor((prev) => ({
                                    ...prev,
                                    [entry.id]: e.target.value,
                                  }))
                                }
                                className="px-2 py-1.5 bg-slate-50 dark:bg-[#182337] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs focus:outline-none max-w-[130px]"
                              >
                                {advisors.map((a) => (
                                  <option key={a.id} value={a.name} className={modalOptionClass}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              disabled={claimingId === entry.id}
                              onClick={() =>
                                handleStartReceiving(entry, targetManagerAdvisor)
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <ArrowRightCircle className="w-3.5 h-3.5" />
                              <span>
                                {claimingId === entry.id ? 'Đang nhận...' : 'Tiếp Nhận'}
                              </span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Đang chờ</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Main Dealership Advisor Tracking Table */}
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-emerald-900/70 shadow-xs bg-white dark:bg-[#073b2f]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#111927] text-slate-500 dark:text-slate-300 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-emerald-900/70">
                <th className="py-3.5 px-5 w-14 text-center">#</th>
                <th className="py-3.5 px-5 min-w-[200px]">BIỂN SỐ</th>
                <th className="py-3.5 px-5 text-center min-w-[190px]">TRẠNG THÁI</th>
                {showAdvisorColumn && (
                  <th className="py-3.5 px-5 min-w-[160px]">CỐ VẤN</th>
                )}
                <th className="py-3.5 px-5 min-w-[180px]">LOẠI HÌNH</th>
                <th className="py-3.5 px-5 min-w-[210px]">TÊN KH</th>
                <th className="py-3.5 px-5 min-w-[145px]">NGÀY HẸN / GIAO</th>
              </tr>
            </thead>
            <tbody>
              {advisorVehicles.length === 0 ? (
                <tr className="bg-white dark:bg-[#094738]">
                  <td
                    colSpan={showAdvisorColumn ? 7 : 6}
                    className="py-14 px-6 text-center"
                  >
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-700/50 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-300">
                        <Car className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">
                        Chưa có xe đang tiếp nhận hoặc xử lý
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                advisorVehicles.map((entry, idx) => {
                  const receiving = isReceivingStatus(entry.status);
                  const delivered = isCompletedOrDeliveredStatus(entry.status);
                  const elapsedMins = getElapsedMinutes(
                    entry.assignedAt || entry.createdAt,
                    now
                  );
                  const isOverKpi = receiving && elapsedMins >= 15;
                  const deliveryCountdown = getDeliveryCountdown(
                    entry.deliveryDate,
                    now
                  );
                  const isDeliveryOverdue = deliveryCountdown?.status === 'overdue';
                  const isDeliverySoon = deliveryCountdown?.status === 'soon';
                  const canEdit = canModifyEntry(entry);
                  const linkedApt = findLinkedAppointment(entry);
                  const bookedContent = entry.appointmentContent || linkedApt?.content;

                  const rowBg = isDeliveryOverdue
                    ? 'bg-red-50 hover:bg-red-100/80 dark:bg-[#3d1722] dark:hover:bg-[#4c1d2b] ring-1 ring-inset ring-red-300 dark:ring-red-500/50'
                    : idx % 2 === 0
                    ? 'bg-white hover:bg-emerald-50/60 dark:bg-[#085341] dark:hover:bg-[#0a614c]'
                    : 'bg-emerald-50/35 hover:bg-emerald-50/80 dark:bg-[#074435] dark:hover:bg-[#095542]';

                  return (
                    <tr
                      key={entry.id}
                      onClick={() => handleOpenDetail(entry)}
                      className={`${rowBg} border-b border-slate-200 dark:border-emerald-950/70 transition-colors cursor-pointer group`}
                    >
                      <td className="py-4 px-5 text-center text-sm font-semibold text-slate-500 dark:text-emerald-100/90 font-mono">
                        {idx + 1}
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {entry.hasAppointment || entry.badgeType ? (
                            <span
                              title={
                                (entry.badgeType || 'H') === 'S'
                                  ? 'Xe hẹn Sửa Chữa'
                                  : 'Xe có lịch hẹn trước'
                              }
                              className="w-6 h-6 rounded-full bg-emerald-600 dark:bg-white text-white dark:text-[#064e3b] font-bold text-xs flex items-center justify-center shrink-0"
                            >
                              {entry.badgeType || 'H'}
                            </span>
                          ) : null}
                          <div>
                            <div className="font-mono font-bold text-base text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
                              <span>{entry.licensePlate}</span>
                              {entry.priority && entry.priority !== 'Thường' && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/25 border border-amber-300 dark:border-amber-400/40 text-amber-800 dark:text-amber-200 font-sans font-bold text-[10px]">
                                  {entry.priority}
                                </span>
                              )}
                            </div>
                            {(bookedContent || entry.notes) && (
                              <div className="text-[11px] text-slate-500 dark:text-emerald-200/80 truncate max-w-[240px] flex items-center gap-1 mt-0.5">
                                <FileText className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-300/80" />
                                <span className="truncate">
                                  {bookedContent || entry.notes}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        {receiving ? (
                          <div className="inline-flex flex-col items-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDetail(entry);
                              }}
                              title={
                                canEdit
                                  ? 'Nhấp để cập nhật tiến độ tiếp nhận xe'
                                  : 'Đang tiếp nhận'
                              }
                              className="relative inline-flex items-center justify-center min-w-[144px] px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                              <span>Đang Tiếp Nhận</span>
                              <span
                                title={`Đã tiếp nhận ${elapsedMins} phút${
                                  isOverKpi ? ' (Vượt KPI 15 phút)' : ''
                                }`}
                                className={`absolute -top-2.5 -right-2.5 min-w-[24px] h-[24px] px-1.5 rounded-full text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs border border-white/60 ${
                                  isOverKpi
                                    ? 'bg-red-600 ring-2 ring-red-300'
                                    : 'bg-red-500'
                                }`}
                              >
                                {elapsedMins}
                              </span>
                            </button>
                            {isOverKpi && (
                              <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-600/35 border border-red-200 dark:border-red-400/50 px-2 py-0.5 rounded-md">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Quá KPI 15p</span>
                              </span>
                            )}
                          </div>
                        ) : entry.status === 'Đã Tiếp Nhận' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/30 text-emerald-800 dark:text-emerald-50 text-xs font-semibold">
                            Đã Tiếp Nhận
                          </span>
                        ) : delivered ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-md bg-sky-50 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-400/40 text-sky-700 dark:text-sky-200 text-xs font-bold">
                            {entry.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-md bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-400/40 text-amber-800 dark:text-amber-200 text-xs font-bold">
                            {entry.status}
                          </span>
                        )}
                      </td>

                      {showAdvisorColumn && (
                        <td className="py-4 px-5 whitespace-nowrap text-sm font-semibold text-slate-700 dark:text-emerald-100">
                          {entry.advisorName}
                        </td>
                      )}

                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-800 dark:text-emerald-50">
                          {entry.serviceTypes.join(', ')}
                        </div>
                        {(entry.carWash || entry.customerWaiting) && (
                          <div className="text-[11px] text-slate-500 dark:text-emerald-200/75 mt-0.5 flex items-center gap-1.5">
                            {entry.carWash && <span>• {entry.carWash}</span>}
                            {entry.customerWaiting && (
                              <span>• {entry.customerWaiting}</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-white tracking-wide uppercase">
                        {entry.customerName}
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap font-mono text-sm text-slate-700 dark:text-emerald-100/95">
                        <div>{entry.appointmentTime || ''}</div>
                        {entry.deliveryDate && (
                          <div className="text-[11px] text-sky-700 dark:text-sky-300 mt-0.5">
                            Giao: {formatDeliveryDisplay(entry.deliveryDate)}
                          </div>
                        )}
                        {isDeliveryOverdue && deliveryCountdown && (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white font-sans font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                              Quá giờ giao {Math.abs(deliveryCountdown.diffMins)}p
                            </span>
                          </div>
                        )}
                        {isDeliverySoon && deliveryCountdown && (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/25 border border-amber-300 dark:border-amber-400/50 text-amber-800 dark:text-amber-200 font-sans font-bold text-[10px]">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>Còn {deliveryCountdown.diffMins}p giao xe</span>
                          </div>
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

      {/* Advisor Progress Form Modal ("Tiếp Nhận") */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="w-full max-w-[660px] bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-[#111a2e] border-b border-slate-200 dark:border-slate-700/70 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Tiếp Nhận
              </h3>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="p-6 space-y-4 text-sm">
              {/* Row 1: Biển Số | Cố Vấn */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Biển Số
                  </label>
                  <input
                    type="text"
                    value={formPlate}
                    disabled={!isManager}
                    onChange={(e) => setFormPlate(e.target.value.toUpperCase())}
                    className={`${modalInputClass} font-mono font-bold`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Cố Vấn
                  </label>
                  <select
                    value={formAdvisor}
                    disabled={!isManager}
                    onChange={(e) => setFormAdvisor(e.target.value)}
                    className={modalInputClass}
                  >
                    {!formAdvisor && (
                      <option value="" className={modalOptionClass}>
                        None
                      </option>
                    )}
                    {formAdvisor && !advisors.some((a) => a.name === formAdvisor) && (
                      <option value={formAdvisor} className={modalOptionClass}>
                        {formAdvisor}
                      </option>
                    )}
                    {advisors.map((a) => (
                      <option key={a.id} value={a.name} className={modalOptionClass}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Loại Hình */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Loại Hình
                </label>
                <div
                  onClick={() => {
                    if (
                      selectedEntry.status !== 'Chờ Tiếp Nhận' &&
                      canModifyEntry(selectedEntry)
                    ) {
                      setIsServiceDropdownOpen((v) => !v);
                    }
                  }}
                  className={`min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-[#121b2d] border border-slate-200 dark:border-slate-600/80 rounded-lg flex items-center justify-between gap-2 ${
                    selectedEntry.status !== 'Chờ Tiếp Nhận' &&
                    canModifyEntry(selectedEntry)
                      ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-500'
                      : 'opacity-70 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {formServiceTypes.map((st) => (
                      <span
                        key={st}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-[#1e293b] border border-blue-200 dark:border-slate-600/60 text-blue-700 dark:text-slate-100 text-xs font-semibold"
                      >
                        <span>{st}</span>
                        {selectedEntry.status !== 'Chờ Tiếp Nhận' &&
                          canModifyEntry(selectedEntry) &&
                          formServiceTypes.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveServiceChip(st);
                              }}
                              className="text-blue-500 dark:text-slate-400 hover:text-red-500 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 shrink-0">
                    {selectedEntry.status !== 'Chờ Tiếp Nhận' &&
                      canModifyEntry(selectedEntry) &&
                      formServiceTypes.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormServiceTypes(['Bảo Dưỡng']);
                          }}
                          title="Đặt lại mặc định"
                          className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {isServiceDropdownOpen &&
                  selectedEntry.status !== 'Chờ Tiếp Nhận' &&
                  canModifyEntry(selectedEntry) && (
                    <div className="mt-1.5 p-2 bg-white dark:bg-[#162033] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg flex flex-wrap gap-1.5">
                      {SERVICE_TYPE_OPTIONS.map((opt) => {
                        const active = formServiceTypes.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleToggleServiceOption(opt)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                              active
                                ? 'bg-blue-50 dark:bg-blue-600/30 border-blue-300 dark:border-blue-500 text-blue-700 dark:text-blue-200'
                                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {active ? '✓ ' : '+ '}
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                <div className="mt-1.5 text-xs font-mono text-emerald-600 dark:text-emerald-500">
                  GJ : {gjBp.gj || ''} {gjBp.gj ? ' | ' : ''}BP : {gjBp.bp || ''}
                </div>
              </div>

              {/* Row 3: Ngày Giao Xe | Rửa Xe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Ngày Giao Xe
                  </label>
                  <input
                    type="datetime-local"
                    value={formDeliveryDate}
                    disabled={
                      selectedEntry.status === 'Chờ Tiếp Nhận' ||
                      !canModifyEntry(selectedEntry)
                    }
                    onChange={(e) => setFormDeliveryDate(e.target.value)}
                    className={`${modalInputClass} font-mono`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Rửa Xe
                  </label>
                  <select
                    value={formCarWash}
                    disabled={
                      selectedEntry.status === 'Chờ Tiếp Nhận' ||
                      !canModifyEntry(selectedEntry)
                    }
                    onChange={(e) => setFormCarWash(e.target.value)}
                    className={modalInputClass}
                  >
                    {CAR_WASH_OPTIONS.map((opt) => (
                      <option key={opt || 'empty'} value={opt} className={modalOptionClass}>
                        {opt || '— Chọn trạng thái rửa xe —'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Khách Chờ | Trạng Thái */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Khách Chờ
                  </label>
                  <select
                    value={formCustomerWaiting}
                    disabled={
                      selectedEntry.status === 'Chờ Tiếp Nhận' ||
                      !canModifyEntry(selectedEntry)
                    }
                    onChange={(e) => setFormCustomerWaiting(e.target.value)}
                    className={modalInputClass}
                  >
                    {CUSTOMER_WAITING_OPTIONS.map((opt) => (
                      <option key={opt || 'empty'} value={opt} className={modalOptionClass}>
                        {opt || '— Chọn tình trạng khách chờ —'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Trạng Thái
                  </label>
                  <select
                    value={formStatus}
                    disabled={
                      selectedEntry.status === 'Chờ Tiếp Nhận' ||
                      !canModifyEntry(selectedEntry)
                    }
                    onChange={(e) =>
                      setFormStatus(e.target.value as ReceptionStatus)
                    }
                    className={modalInputClass}
                  >
                    {selectedEntry.status === 'Chờ Tiếp Nhận' && (
                      <option value="Chờ Tiếp Nhận" className={modalOptionClass}>
                        Chờ Tiếp Nhận
                      </option>
                    )}
                    {ADVISOR_STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st} className={modalOptionClass}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 5: Ưu Tiên | Khu Vực */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Ưu Tiên
                  </label>
                  <select
                    value={formPriority}
                    disabled={
                      selectedEntry.status === 'Chờ Tiếp Nhận' ||
                      !canModifyEntry(selectedEntry)
                    }
                    onChange={(e) => setFormPriority(e.target.value)}
                    className={modalInputClass}
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p || 'empty'} value={p} className={modalOptionClass}>
                        {p || ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Khu Vực
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    disabled={
                      selectedEntry.status === 'Chờ Tiếp Nhận' ||
                      !canModifyEntry(selectedEntry)
                    }
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Vũng Tàu"
                    className={modalInputClass}
                  />
                </div>
              </div>

              {/* Row 6: Nội Dung Hẹn */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Nội Dung Hẹn
                </label>
                <textarea
                  rows={4}
                  value={formContent}
                  disabled={
                    selectedEntry.status === 'Chờ Tiếp Nhận' ||
                    !canModifyEntry(selectedEntry)
                  }
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Nhập nội dung công việc / ghi chú tiến độ..."
                  className={`${modalInputClass} resize-y`}
                />
              </div>

              {selectedEntry.status !== 'Chờ Tiếp Nhận' &&
                !canModifyEntry(selectedEntry) && (
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {selectedEntry.status === 'Hoàn Thành'
                        ? 'Phiếu tiếp nhận đã hoàn thành.'
                        : 'Chế độ chỉ xem.'}
                    </span>
                  </div>
                )}

              {/* Bottom Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2.5 flex-wrap">
                {selectedEntry.status === 'Chờ Tiếp Nhận' ? (
                  <div className="flex items-center gap-2.5">
                    {canStartWaitingEntry(selectedEntry) && (
                      <button
                        type="button"
                        disabled={claimingId === selectedEntry.id}
                        onClick={() => handleStartReceiving(selectedEntry)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <ArrowRightCircle className="w-4 h-4" />
                        <span>
                          {claimingId === selectedEntry.id
                            ? 'Đang nhận xe...'
                            : 'Bắt Đầu Tiếp Nhận'}
                        </span>
                      </button>
                    )}
                  </div>
                ) : (
                  canModifyEntry(selectedEntry) && (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={isUpdatingEntry || isReturning}
                          onClick={() => handleSaveProgress('Đã Tiếp Nhận')}
                          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUpdatingEntry ? 'Đang lưu...' : 'Kết Thúc Tiếp Nhận'}
                        </button>

                        <button
                          type="button"
                          disabled={isUpdatingEntry || isReturning}
                          onClick={() => handleSaveProgress('Đã Giao Xe')}
                          className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Giao Xe
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {canReturnEntryToQueue(selectedEntry) && (
                          <button
                            type="button"
                            disabled={isUpdatingEntry || isReturning}
                            onClick={handleReturnToQueue}
                            title="Trả xe về hàng chờ (None)"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>
                              {isReturning ? 'Đang trả...' : 'Trả Về Hàng Chờ'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isUpdatingEntry || isReturning}
                          onClick={() => handleSaveProgress()}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/80 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Lưu Tiến Độ</span>
                        </button>
                      </div>
                    </>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivered History Modal */}
      {isHistoryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[88vh] flex flex-col bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-[#111a2e] border-b border-slate-200 dark:border-slate-700/70 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-400/40 flex items-center justify-center text-sky-600 dark:text-sky-300">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Lịch Sử Xe Đã Giao</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    {currentDate}
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="px-6 py-3 bg-white dark:bg-[#101827] border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryScope('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    historyScope === 'today'
                      ? 'bg-sky-50 dark:bg-sky-600/30 border-sky-300 dark:border-sky-400/60 text-sky-700 dark:text-sky-100'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Hôm nay ({deliveredTodayVehicles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryScope('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    historyScope === 'all'
                      ? 'bg-sky-50 dark:bg-sky-600/30 border-sky-300 dark:border-sky-400/60 text-sky-700 dark:text-sky-100'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Tất cả ({deliveredVehicles.length})
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Tìm biển số, khách hàng, cố vấn..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#182337] border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* History Table */}
            <div className="flex-1 overflow-auto">
              {filteredHistoryVehicles.length === 0 ? (
                <div className="py-16 px-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  {historyScope === 'today'
                    ? 'Chưa có xe nào được giao trong ngày hôm nay.'
                    : 'Không tìm thấy lịch sử xe đã giao phù hợp.'}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#121b2d] text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4 min-w-[165px]">BIỂN SỐ</th>
                      <th className="py-3 px-4 min-w-[130px]">CỐ VẤN</th>
                      <th className="py-3 px-4 min-w-[170px]">KHÁCH HÀNG &amp; LHSC</th>
                      <th className="py-3 px-4 min-w-[170px]">NỘI DUNG</th>
                      <th className="py-3 px-4 min-w-[270px]">MỐC GIỜ KPI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                    {filteredHistoryVehicles.map((entry, idx) => {
                      const receptionMins = getDurationMinutes(
                        entry.assignedAt || entry.createdAt,
                        entry.receivedAt
                      );
                      const totalStayMins = getDurationMinutes(
                        entry.createdAt,
                        entry.deliveredAt || entry.updatedAt
                      );
                      const linkedApt = findLinkedAppointment(entry);
                      const content =
                        entry.appointmentContent ||
                        linkedApt?.content ||
                        entry.notes ||
                        '';

                      return (
                        <tr
                          key={entry.id}
                          onClick={() => {
                            setIsHistoryOpen(false);
                            handleOpenDetail(entry);
                          }}
                          className="bg-white dark:bg-[#0f1829] hover:bg-slate-50 dark:hover:bg-[#162238] transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-4 text-center font-mono text-slate-500 dark:text-slate-400 font-semibold">
                            {idx + 1}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {entry.hasAppointment || entry.badgeType ? (
                                <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {entry.badgeType || 'H'}
                                </span>
                              ) : null}
                              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                {entry.licensePlate}
                              </span>
                              {entry.cardTicketNumber && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                                  #{entry.cardTicketNumber}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              {entry.checkInDate}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-emerald-700 dark:text-emerald-300">
                            {entry.advisorName}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white uppercase">
                              {entry.customerName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {entry.serviceTypes.join(', ')}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-[220px]">
                            <div className="text-slate-700 dark:text-slate-300 line-clamp-2">
                              {content || '—'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                                Vào: {entry.checkInTime || '--:--'}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/35 text-purple-700 dark:text-purple-200">
                                Nhận: {formatClockTime(entry.assignedAt)}
                              </span>
                              {entry.receivedAt && (
                                <span
                                  className={`px-2 py-0.5 rounded border ${
                                    receptionMins !== null && receptionMins > 15
                                      ? 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-200'
                                      : 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-200'
                                  }`}
                                >
                                  Xong TN: {formatClockTime(entry.receivedAt)}
                                  {receptionMins !== null
                                    ? ` (${formatDurationLabel(receptionMins)})`
                                    : ''}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-400/45 text-sky-700 dark:text-sky-200 font-semibold">
                                Giao:{' '}
                                {formatClockTime(
                                  entry.deliveredAt || entry.updatedAt
                                )}
                                {totalStayMins !== null
                                  ? ` • Tổng ${formatDurationLabel(totalStayMins)}`
                                  : ''}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
