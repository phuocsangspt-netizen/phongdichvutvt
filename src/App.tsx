import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import {
  AccessRequest,
  AdvisorPickupRequest,
  Appointment,
  AuditLogEntry,
  GoogleSheetsConfig,
  ReceptionEntry,
  ServiceAdvisor,
  SystemSettings,
  UserAccount,
} from './types/appointment';
import {
  ALL_TIME_SLOTS,
  INITIAL_APPOINTMENTS,
  INITIAL_RECEPTION_ENTRIES,
  SERVICE_ADVISORS,
} from './data/mockData';
import {
  subscribeAuthState,
  signInWithGoogleApp,
  logout,
} from './services/firebaseAuth';
import {
  bootstrapAdminIfNeeded,
  subscribeMyStaffProfile,
  subscribeMyAccessRequest,
  subscribeAllStaff,
  subscribeAllAccessRequests,
  subscribeAdvisors,
  subscribeAdvisorRequests,
  subscribeAppointments,
  subscribeReceptionEntries,
  subscribeWorkshopSettings,
  subscribeAuditLogs,
  submitAccessRequest,
  deleteAccessRequest,
  upsertStaffAccount,
  deleteStaffAccount,
  saveAppointmentToFirestore,
  syncAppointmentStatusFromWorkflow,
  deleteAppointmentFromFirestore,
  saveReceptionToFirestore,
  advisorStartReceivingVehicle,
  returnVehicleToWaitingQueue,
  deleteReceptionFromFirestore,
  requestVehiclePickup,
  cancelVehiclePickupRequest,
  saveWorkshopSettingsToFirestore,
  bulkImportToFirestore,
  seedSampleWorkshopDataIfEmpty,
} from './services/firestoreService';
import {
  exportAllToGoogleSheets,
  importAllFromGoogleSheets,
} from './services/googleSheets';
import { getLocalDateString, getNextAvailableSlot, isSlotInPast } from './utils/timeSlots';
import { AuthGate } from './components/AuthGate';
import { Header } from './components/Header';
import { TimelineGrid } from './components/TimelineGrid';
import { TableView } from './components/TableView';
import { ReceptionTab } from './components/ReceptionTab';
import { AdvisorTab } from './components/AdvisorTab';
import { SettingsTab } from './components/SettingsTab';
import { AppointmentModal } from './components/AppointmentModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { useTheme } from './hooks/useTheme';

type MainTab = 'dat_hen' | 'le_tan' | 'co_van' | 'cai_dat';

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  workshopName: 'Hãng Xe Auto Service',
  branchName: 'Chi nhánh Vũng Tàu',
  phoneNumber: '0903123456',
  address: 'Vũng Tàu',
  autoSyncInterval: 15,
  allowReceptionCheckInWithoutAppointment: true,
  defaultDurationMinutes: 30,
};

const DEFAULT_SHEETS_CONFIG: GoogleSheetsConfig = {
  spreadsheetId: null,
  spreadsheetUrl: null,
  sheetTitle: 'CSDL Xưởng Dịch Vụ Ô Tô',
  lastSyncedAt: null,
  isAutoSyncEnabled: false,
  syncIntervalSeconds: 15,
  syncStatus: 'idle',
};

function getDefaultTabForUser(user: UserAccount): MainTab {
  if (user.role === 'le_tan' && user.permissions.canAccessLeTan) return 'le_tan';
  if (user.role === 'co_van' && user.permissions.canAccessCoVan) return 'co_van';
  if (user.role === 'dat_hen' && user.permissions.canAccessDatHen) return 'dat_hen';
  if (user.permissions.canAccessDatHen) return 'dat_hen';
  if (user.permissions.canAccessLeTan) return 'le_tan';
  if (user.permissions.canAccessCoVan) return 'co_van';
  if (user.permissions.canAccessSettings) return 'cai_dat';
  return 'dat_hen';
}

function isTabAllowed(tab: MainTab, user: UserAccount): boolean {
  if (tab === 'dat_hen') return user.permissions.canAccessDatHen;
  if (tab === 'le_tan') return user.permissions.canAccessLeTan;
  if (tab === 'co_van') return user.permissions.canAccessCoVan;
  if (tab === 'cai_dat') return user.permissions.canAccessSettings;
  return false;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // Live clock updated every 30 seconds for real-time slot locking & live indicator line
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Auth & Staff RBAC state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [staffProfile, setStaffProfile] = useState<UserAccount | null>(null);
  const [myAccessRequest, setMyAccessRequest] = useState<AccessRequest | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Operational Firestore data (real-time)
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [receptionEntries, setReceptionEntries] = useState<ReceptionEntry[]>([]);
  const [firestoreAdvisors, setFirestoreAdvisors] = useState<ServiceAdvisor[]>([]);
  const [advisorRequests, setAdvisorRequests] = useState<AdvisorPickupRequest[]>([]);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(DEFAULT_SHEETS_CONFIG);

  // Navigation & UI filters
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString(new Date()));
  const [modalDefaultDate, setModalDefaultDate] = useState<string>(() => getLocalDateString(new Date()));
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('dat_hen');
  const [hasInitializedTab, setHasInitializedTab] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdvisorFilter, setSelectedAdvisorFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Modals
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Partial<Appointment> | null>(null);
  const [defaultSlot, setDefaultSlot] = useState<string>('14:00');
  const [defaultBayId, setDefaultBayId] = useState<string>('bay_bd_1');

  // Inline toast notifications (never use window.alert)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  // =========================================================================
  // 1. Firebase Auth Listener + Admin Bootstrap + Own Staff Profile Watcher
  // =========================================================================
  useEffect(() => {
    const unsubscribe = subscribeAuthState((user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (!user) {
        setStaffProfile(null);
        setMyAccessRequest(null);
        setProfileLoading(false);
        setHasInitializedTab(false);
        setAppointments([]);
        setReceptionEntries([]);
        setFirestoreAdvisors([]);
        setAdvisorRequests([]);
        setUserAccounts([]);
        setAccessRequests([]);
        setAuditLogs([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser?.email) {
      setStaffProfile(null);
      setMyAccessRequest(null);
      setProfileLoading(false);
      return;
    }

    let isMounted = true;
    let unsubProfile: (() => void) | null = null;
    let unsubRequest: (() => void) | null = null;

    setProfileLoading(true);
    setAuthError(null);

    (async () => {
      try {
        await bootstrapAdminIfNeeded(firebaseUser);
      } catch (err: any) {
        if (isMounted) {
          setAuthError(err?.message || 'Không thể xác thực hồ sơ nhân viên.');
        }
      }

      if (!isMounted || !firebaseUser.email) return;

      unsubProfile = subscribeMyStaffProfile(
        firebaseUser.email,
        (profile) => {
          if (!isMounted) return;
          setStaffProfile(profile);
          setProfileLoading(false);
        },
        (err) => {
          if (!isMounted) return;
          setAuthError(err?.message || 'Lỗi khi tải hồ sơ phân quyền.');
          setProfileLoading(false);
        }
      );

      unsubRequest = subscribeMyAccessRequest(firebaseUser.email, (req) => {
        if (!isMounted) return;
        setMyAccessRequest(req);
      });
    })();

    return () => {
      isMounted = false;
      if (unsubProfile) unsubProfile();
      if (unsubRequest) unsubRequest();
    };
  }, [firebaseUser]);

  // Keep active tab synced with user's permitted tabs
  useEffect(() => {
    if (!staffProfile || !staffProfile.isActive) return;

    if (!hasInitializedTab) {
      setActiveMainTab(getDefaultTabForUser(staffProfile));
      setHasInitializedTab(true);
      return;
    }

    if (!isTabAllowed(activeMainTab, staffProfile)) {
      setActiveMainTab(getDefaultTabForUser(staffProfile));
    }
  }, [staffProfile, activeMainTab, hasInitializedTab]);

  // =========================================================================
  // 2. Operational Real-time Firestore Subscriptions (ONLY for active staff)
  // =========================================================================
  const isApprovedActiveStaff = Boolean(firebaseUser && staffProfile && staffProfile.isActive);
  const isAdmin = isApprovedActiveStaff && staffProfile?.role === 'quan_ly';
  const canReadOperational =
    isApprovedActiveStaff &&
    Boolean(
      isAdmin ||
        staffProfile?.permissions.canAccessDatHen ||
        staffProfile?.permissions.canAccessLeTan ||
        staffProfile?.permissions.canAccessCoVan
    );

  useEffect(() => {
    if (!isApprovedActiveStaff) return;

    const unsubscribers: Array<() => void> = [];

    if (canReadOperational) {
      unsubscribers.push(subscribeAppointments(setAppointments));
      unsubscribers.push(subscribeReceptionEntries(setReceptionEntries));
    }
    unsubscribers.push(subscribeAdvisors(setFirestoreAdvisors));
    unsubscribers.push(subscribeAdvisorRequests(setAdvisorRequests));

    unsubscribers.push(
      subscribeWorkshopSettings((remote) => {
        if (!remote) return;
        setSystemSettings((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(remote.systemSettings).filter(([, v]) => v !== undefined)
          ),
        }));
        setSheetsConfig((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(remote.sheetsConfig).filter(([, v]) => v !== undefined)
          ),
        }));
      })
    );

    if (isAdmin) {
      unsubscribers.push(subscribeAllStaff(setUserAccounts));
      unsubscribers.push(subscribeAllAccessRequests(setAccessRequests));
      unsubscribers.push(subscribeAuditLogs(setAuditLogs));
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isApprovedActiveStaff, isAdmin, canReadOperational]);

  // =========================================================================
  // 3. Google Sheets Sync Engine (Optional backup/export for authorized staff)
  // =========================================================================
  const isSyncingRef = useRef(false);

  const performRealtimePull = useCallback(async () => {
    if (
      !staffProfile ||
      !staffProfile.isActive ||
      !staffProfile.permissions.canSyncSheets ||
      !sheetsConfig.spreadsheetId ||
      !sheetsConfig.isAutoSyncEnabled ||
      isSyncingRef.current
    ) {
      return;
    }

    try {
      isSyncingRef.current = true;
      setSheetsConfig((prev) => ({ ...prev, syncStatus: 'syncing' }));

      const imported = await importAllFromGoogleSheets(sheetsConfig.spreadsheetId);
      await bulkImportToFirestore(
        {
          appointments: imported.appointments,
          receptionEntries: imported.receptionEntries,
          userAccounts: staffProfile.role === 'quan_ly' ? imported.userAccounts : undefined,
        },
        staffProfile
      );

      const nowTime = new Date().toLocaleTimeString('vi-VN');
      setSheetsConfig((prev) => ({
        ...prev,
        syncStatus: 'success',
        lastSyncedAt: `${nowTime} (Tự động)`,
        syncErrorMessage: null,
      }));
    } catch (err: any) {
      console.warn('Real-time Sheets sync notice:', err?.message || err);
      setSheetsConfig((prev) => ({ ...prev, syncStatus: 'idle' }));
    } finally {
      isSyncingRef.current = false;
    }
  }, [staffProfile, sheetsConfig.spreadsheetId, sheetsConfig.isAutoSyncEnabled]);

  useEffect(() => {
    if (
      !staffProfile?.permissions.canSyncSheets ||
      !sheetsConfig.spreadsheetId ||
      !sheetsConfig.isAutoSyncEnabled
    ) {
      return;
    }

    const intervalMs = Math.max(10, sheetsConfig.syncIntervalSeconds || 15) * 1000;
    const timer = setInterval(() => {
      performRealtimePull();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [
    staffProfile?.permissions.canSyncSheets,
    sheetsConfig.spreadsheetId,
    sheetsConfig.isAutoSyncEnabled,
    sheetsConfig.syncIntervalSeconds,
    performRealtimePull,
  ]);

  const handleUpdateSheetsConfig = useCallback(
    (nextConfig: GoogleSheetsConfig) => {
      setSheetsConfig(nextConfig);
      if (staffProfile && (staffProfile.role === 'quan_ly' || staffProfile.permissions.canSyncSheets)) {
        saveWorkshopSettingsToFirestore(systemSettings, nextConfig, staffProfile).catch((err) => {
          console.warn('Save sheets config notice:', err);
        });
      }
    },
    [staffProfile, systemSettings]
  );

  const triggerFullPush = async () => {
    if (!staffProfile) throw new Error('Chưa đăng nhập');
    if (!sheetsConfig.spreadsheetId) throw new Error('Chưa liên kết file Google Sheets');
    isSyncingRef.current = true;
    setSheetsConfig((prev) => ({ ...prev, syncStatus: 'syncing' }));
    try {
      await exportAllToGoogleSheets(sheetsConfig.spreadsheetId, {
        appointments,
        receptionEntries,
        userAccounts,
        settings: systemSettings,
      });
      const nowStr =
        new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN');
      const nextConfig: GoogleSheetsConfig = {
        ...sheetsConfig,
        syncStatus: 'success',
        lastSyncedAt: nowStr,
        syncErrorMessage: null,
      };
      setSheetsConfig(nextConfig);
      await saveWorkshopSettingsToFirestore(systemSettings, nextConfig, staffProfile);
      showToast('success', `Đã sao lưu toàn bộ dữ liệu lên Google Sheets lúc ${nowStr}.`);
    } catch (err: any) {
      setSheetsConfig((prev) => ({
        ...prev,
        syncStatus: 'error',
        syncErrorMessage: err?.message || 'Lỗi đồng bộ',
      }));
      throw err;
    } finally {
      isSyncingRef.current = false;
    }
  };

  // =========================================================================
  // 4. Auth Gate Handlers
  // =========================================================================
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogleApp();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') return;
      setAuthError(err?.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
    }
  };

  const handleSignOut = async () => {
    await logout();
  };

  const handleSubmitAccessRequest = async (
    requestedRole: 'le_tan' | 'co_van' | 'dat_hen',
    fullName: string,
    note: string
  ) => {
    if (!firebaseUser) return;
    await submitAccessRequest(firebaseUser, requestedRole, fullName, note);
  };

  // Show AuthGate until authenticated AND verified active in Firestore `/staff`
  if (!isApprovedActiveStaff || !staffProfile) {
    return (
      <AuthGate
        firebaseUser={firebaseUser}
        authLoading={authLoading}
        profileLoading={profileLoading}
        staffProfile={staffProfile}
        myAccessRequest={myAccessRequest}
        authError={authError}
        theme={theme}
        onToggleTheme={toggleTheme}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onSubmitAccessRequest={handleSubmitAccessRequest}
      />
    );
  }

  // =========================================================================
  // 5. Authenticated Operational Handlers
  // =========================================================================
  const currentUser = staffProfile;

  // Dynamic Cố Vấn Dịch Vụ list:
  // Uses newly created active co_van accounts from Firestore (/advisors),
  // falling back to default SERVICE_ADVISORS only if no co_van account has been created yet.
  const activeAdvisors: ServiceAdvisor[] = (() => {
    const base = firestoreAdvisors.length > 0 ? [...firestoreAdvisors] : [...SERVICE_ADVISORS];
    if (
      currentUser.role === 'co_van' &&
      !base.some((a) => a.name === currentUser.fullName)
    ) {
      base.unshift({
        id: currentUser.id,
        name: currentUser.fullName,
        role: currentUser.roleTitle || 'Cố Vấn Dịch Vụ',
        avatar: currentUser.avatar,
      });
    }
    return base;
  })();

  const handleTabChange = (targetTab: MainTab) => {
    if (!isTabAllowed(targetTab, currentUser)) {
      showToast('error', 'Tài khoản của bạn chưa được cấp quyền truy cập phân hệ này.');
      return;
    }
    setActiveMainTab(targetTab);
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchPlate = apt.licensePlate.toLowerCase().includes(q);
      const matchCustomer = apt.customerName.toLowerCase().includes(q);
      const matchPhone = apt.phoneNumber.includes(q);
      const matchContent = apt.content.toLowerCase().includes(q);
      if (!matchPlate && !matchCustomer && !matchPhone && !matchContent) return false;
    }
    if (selectedAdvisorFilter && apt.advisorName !== selectedAdvisorFilter) return false;
    if (selectedStatusFilter && apt.status !== selectedStatusFilter) return false;
    return true;
  });

  const handleOpenNewModal = (bayId?: string, timeSlot?: string) => {
    if (!currentUser.permissions.canCreateAppointments) {
      showToast('error', 'Tài khoản của bạn không có quyền tạo mới lịch hẹn.');
      return;
    }

    const currentNow = new Date();
    setNow(currentNow);

    if (timeSlot && isSlotInPast(selectedDate, timeSlot, currentNow)) {
      return;
    }

    setDefaultBayId(bayId || 'bay_bd_1');

    if (timeSlot) {
      setModalDefaultDate(selectedDate);
      setDefaultSlot(timeSlot);
    } else {
      const nextOpen = getNextAvailableSlot(selectedDate, ALL_TIME_SLOTS, currentNow);
      setModalDefaultDate(nextOpen.date);
      setDefaultSlot(nextOpen.timeSlot);
    }

    setEditingAppointment(null);
    setIsAppointmentModalOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsAppointmentModalOpen(true);
  };

  // Determine modal edit mode matching firestore.rules Tier 1/2/3 & Terminal State Lock
  const getModalEditMode = (): 'full' | 'status_only' | 'read_only' => {
    if (!editingAppointment?.id) return 'full';
    if (currentUser.role === 'quan_ly') return 'full';

    const isTerminal =
      editingAppointment.status === 'Hoàn Thành' || editingAppointment.status === 'Đã Hủy';
    if (isTerminal) return 'read_only';

    if (currentUser.permissions.canEditAppointments) return 'full';

    if (
      currentUser.role === 'co_van' &&
      currentUser.permissions.canUpdateVehicleStatus &&
      editingAppointment.advisorName === currentUser.fullName
    ) {
      return 'status_only';
    }

    return 'read_only';
  };

  const handleSaveAppointment = async (savedApt: Appointment) => {
    const isNew = !appointments.some((a) => a.id === savedApt.id);
    try {
      await saveAppointmentToFirestore(savedApt, isNew, currentUser);
      showToast(
        'success',
        isNew
          ? `Đã lưu lịch hẹn xe ${savedApt.licensePlate} lên hệ thống.`
          : `Đã cập nhật lịch hẹn xe ${savedApt.licensePlate}.`
      );
    } catch (err: any) {
      showToast('error', 'Không có quyền hoặc dữ liệu lịch hẹn không hợp lệ.');
      console.error(err);
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!currentUser.permissions.canDeleteAppointments && currentUser.role !== 'quan_ly') {
      showToast('error', 'Tài khoản của bạn không có quyền xóa lịch hẹn.');
      return;
    }
    const target = appointments.find((a) => a.id === id);
    try {
      await deleteAppointmentFromFirestore(id, target?.licensePlate || id, currentUser);
      setIsAppointmentModalOpen(false);
      showToast('success', `Đã xóa lịch hẹn xe ${target?.licensePlate || ''}.`);
    } catch (err: any) {
      showToast('error', 'Không thể xóa lịch hẹn này.');
      console.error(err);
    }
  };

  const syncLinkedAppointments = async (
    entry: ReceptionEntry,
    nextStatus: 'Chờ Tiếp Nhận' | 'Đang Làm' | 'Hoàn Thành'
  ) => {
    if (!entry.hasAppointment) return;
    const normalizedPlate = entry.licensePlate.replace(/[\s.-]/g, '').toLowerCase();
    const matchingApts = appointments.filter((a) => {
      if (a.status === 'Hoàn Thành' || a.status === 'Đã Hủy') return false;
      if (entry.appointmentId && a.id === entry.appointmentId) return true;
      return (
        a.appointmentDate === entry.checkInDate &&
        a.licensePlate.replace(/[\s.-]/g, '').toLowerCase() === normalizedPlate
      );
    });
    for (const apt of matchingApts) {
      await syncAppointmentStatusFromWorkflow(apt, nextStatus, currentUser).catch(() => {});
    }
  };

  const handleAddReceptionEntry = async (entry: ReceptionEntry) => {
    if (!currentUser.permissions.canCheckInCars && currentUser.role !== 'quan_ly') {
      showToast('error', 'Tài khoản của bạn không có quyền tiếp nhận xe vào xưởng.');
      return;
    }
    try {
      await saveReceptionToFirestore(entry, true, currentUser);

      // Stage 2 Reverse Sync: Vehicle arrived at Reception -> Appointment becomes 'Chờ Tiếp Nhận' (Blue)
      await syncLinkedAppointments(entry, 'Chờ Tiếp Nhận');

      if (entry.advisorName && entry.status === 'Đang Tiếp Nhận') {
        const matchingReq = advisorRequests.find((r) => r.advisorName === entry.advisorName);
        if (matchingReq) {
          await cancelVehiclePickupRequest(matchingReq.id).catch(() => {});
        }
      }

      showToast(
        'success',
        entry.advisorName
          ? `Đã đưa xe ${entry.licensePlate} vào danh sách Chờ Tiếp Nhận của Cố Vấn ${entry.advisorName}.`
          : `Đã đưa xe ${entry.licensePlate} (None) vào danh sách Chờ Tiếp Nhận chung.`
      );
    } catch (err: any) {
      showToast('error', 'Lỗi khi lưu lượt tiếp nhận xe.');
      console.error(err);
    }
  };

  const handleUpdateReceptionEntry = async (updated: ReceptionEntry) => {
    try {
      await saveReceptionToFirestore(updated, false, currentUser);

      // Stage 4 Reverse Sync: Advisor clicked 'Giao Xe' / 'Hoàn Thành' -> Appointment becomes 'Hoàn Thành' (Green)
      if (updated.status === 'Đã Giao Xe' || updated.status === 'Hoàn Thành') {
        await syncLinkedAppointments(updated, 'Hoàn Thành');
      }

      showToast('success', `Đã cập nhật trạng thái xe ${updated.licensePlate}: ${updated.status}.`);
    } catch (err: any) {
      showToast('error', 'Bạn không có quyền cập nhật lượt tiếp nhận của xe này.');
      console.error(err);
    }
  };

  const handleTransferToAdvisor = async (
    entry: ReceptionEntry,
    targetAdvisorName: string,
    requestIdToClear?: string
  ) => {
    if (!currentUser.permissions.canCheckInCars && currentUser.role !== 'quan_ly') {
      showToast('error', 'Tài khoản của bạn không có quyền chuyển xe sang Cố Vấn.');
      return;
    }
    try {
      const updatedEntry: ReceptionEntry = {
        ...entry,
        advisorName: targetAdvisorName,
        status: 'Đang Tiếp Nhận',
        assignedAt: new Date().toISOString(),
        assignedByName: currentUser.fullName,
      };
      await saveReceptionToFirestore(updatedEntry, false, currentUser);

      if (requestIdToClear) {
        await cancelVehiclePickupRequest(requestIdToClear).catch(() => {});
      }

      // Stage 3 Reverse Sync: Transferred to Advisor -> Appointment becomes 'Đang Làm' (Amber)
      await syncLinkedAppointments(updatedEntry, 'Đang Làm');

      showToast(
        'success',
        `Đã chuyển xe ${entry.licensePlate} sang Cố Vấn ${targetAdvisorName}!`
      );
    } catch (err: any) {
      showToast('error', 'Không thể chuyển xe sang Cố Vấn. Vui lòng thử lại.');
      console.error(err);
    }
  };

  const handleAdvisorStartReceiving = async (
    entry: ReceptionEntry,
    targetAdvisorName: string
  ) => {
    try {
      await advisorStartReceivingVehicle(entry, targetAdvisorName, currentUser);

      const matchingReq = advisorRequests.find(
        (r) => r.advisorName === targetAdvisorName
      );
      if (matchingReq) {
        await cancelVehiclePickupRequest(matchingReq.id).catch(() => {});
      }

      // Stage 3 Reverse Sync: Advisor started receiving -> Appointment becomes 'Đang Làm' (Amber)
      await syncLinkedAppointments(entry, 'Đang Làm');

      showToast(
        'success',
        `Đã bắt đầu tiếp nhận xe ${entry.licensePlate} (${targetAdvisorName})!`
      );
    } catch (err: any) {
      showToast('error', 'Không thể bắt đầu tiếp nhận xe này. Vui lòng thử lại.');
      console.error(err);
    }
  };

  const handleReturnToWaitingQueue = async (entry: ReceptionEntry) => {
    try {
      await returnVehicleToWaitingQueue(entry, currentUser);
      await syncLinkedAppointments(entry, 'Chờ Tiếp Nhận');
      showToast(
        'success',
        `Đã trả xe ${entry.licensePlate} về hàng chờ Lễ Tân (None).`
      );
    } catch (err: any) {
      showToast('error', 'Không thể trả xe về hàng chờ. Vui lòng thử lại.');
      console.error(err);
    }
  };

  const handleRecallFromAdvisor = async (entry: ReceptionEntry) => {
    if (!currentUser.permissions.canCheckInCars && currentUser.role !== 'quan_ly') {
      showToast('error', 'Tài khoản của bạn không có quyền thu hồi xe.');
      return;
    }
    try {
      const recalled: ReceptionEntry = {
        ...entry,
        advisorName: '',
        status: 'Chờ Tiếp Nhận',
        assignedAt: '',
        assignedByName: '',
      };
      await saveReceptionToFirestore(recalled, false, currentUser);
      showToast('success', `Đã thu hồi xe ${entry.licensePlate} về hàng chờ Lễ Tân.`);
    } catch (err: any) {
      showToast('error', 'Không thể thu hồi xe về hàng chờ.');
      console.error(err);
    }
  };

  const handleRequestPickup = async (note?: string) => {
    try {
      await requestVehiclePickup(currentUser, note);
      showToast('success', 'Đã gửi yêu cầu nhận xe tới Bộ phận Lễ Tân!');
    } catch (err: any) {
      showToast('error', 'Không thể gửi yêu cầu nhận xe.');
      console.error(err);
    }
  };

  const handleCancelPickupRequest = async (requestId: string) => {
    try {
      await cancelVehiclePickupRequest(requestId);
      showToast('success', 'Đã hủy yêu cầu nhận xe.');
    } catch (err: any) {
      showToast('error', 'Không thể hủy yêu cầu nhận xe.');
      console.error(err);
    }
  };

  const handleDeleteReceptionEntry = async (id: string) => {
    if (!currentUser.permissions.canDeleteReception && currentUser.role !== 'quan_ly') {
      showToast('error', 'Tài khoản của bạn không có quyền xóa lượt tiếp nhận.');
      return;
    }
    const target = receptionEntries.find((e) => e.id === id);
    try {
      await deleteReceptionFromFirestore(id, target?.licensePlate || id, currentUser);
      showToast('success', `Đã xóa lượt tiếp nhận xe ${target?.licensePlate || ''}.`);
    } catch (err: any) {
      showToast('error', 'Không thể xóa lượt tiếp nhận.');
      console.error(err);
    }
  };

  // Manager Staff & Settings handlers
  const handleSaveStaffAccount = async (account: UserAccount, approvingRequestId?: string) => {
    await upsertStaffAccount(account, currentUser);
    if (approvingRequestId) {
      await deleteAccessRequest(approvingRequestId);
    }
  };

  const handleDeleteStaffAccount = async (staffId: string, label: string) => {
    await deleteStaffAccount(staffId, label, currentUser);
  };

  const handleRejectAccessRequest = async (requestId: string) => {
    await deleteAccessRequest(requestId);
  };

  const handleUpdateSystemSettings = async (nextSettings: SystemSettings) => {
    setSystemSettings(nextSettings);
    await saveWorkshopSettingsToFirestore(nextSettings, sheetsConfig, currentUser);
  };

  const handleSeedSampleData = async () => {
    const seeded = await seedSampleWorkshopDataIfEmpty(
      INITIAL_APPOINTMENTS,
      INITIAL_RECEPTION_ENTRIES,
      currentUser
    );
    if (seeded) {
      showToast('success', 'Đã nạp dữ liệu mẫu ban đầu vào Firestore thành công!');
    } else {
      showToast('error', 'Cơ sở dữ liệu hiện đã có sẵn dữ liệu nên không nạp đè dữ liệu mẫu.');
    }
  };

  const handleAllDataImported = async (data: {
    appointments: Appointment[];
    receptionEntries: ReceptionEntry[];
    userAccounts: UserAccount[];
  }) => {
    try {
      await bulkImportToFirestore(
        {
          appointments: data.appointments,
          receptionEntries: data.receptionEntries,
          userAccounts: currentUser.role === 'quan_ly' ? data.userAccounts : undefined,
        },
        currentUser
      );
      showToast('success', 'Đã đồng bộ dữ liệu từ Google Sheets vào Firestore.');
    } catch (err: any) {
      showToast('error', 'Không thể nạp dữ liệu từ Google Sheets vào Firestore.');
      console.error(err);
    }
  };

  const waitingCount = receptionEntries.filter((e) => e.status === 'Chờ Tiếp Nhận').length;
  const advisorReceivingCount = receptionEntries.filter((e) => {
    const isReceiving =
      e.status === 'Đang Tiếp Nhận' || e.status === 'Cố Vấn Đang Tiếp Nhận';
    if (!isReceiving || !e.advisorName) return false;
    if (currentUser.role === 'co_van') return e.advisorName === currentUser.fullName;
    return true;
  }).length;
  const pendingRequestsCount = accessRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header with Authenticated Employee Badge, Sign Out & Role-Gated Navigation */}
      <Header
        user={firebaseUser}
        currentUser={currentUser}
        systemSettings={systemSettings}
        appointments={appointments}
        advisors={activeAdvisors}
        selectedDate={selectedDate}
        viewMode={viewMode}
        activeMainTab={activeMainTab}
        waitingReceptionCount={waitingCount}
        advisorRequestsCount={advisorRequests.length}
        advisorReceivingCount={advisorReceivingCount}
        pendingRequestsCount={pendingRequestsCount}
        searchQuery={searchQuery}
        selectedAdvisorFilter={selectedAdvisorFilter}
        selectedStatusFilter={selectedStatusFilter}
        theme={theme}
        onToggleTheme={toggleTheme}
        onTabChange={handleTabChange}
        onSignOut={handleSignOut}
        onToggleViewMode={setViewMode}
        onSearchChange={setSearchQuery}
        onAdvisorFilterChange={setSelectedAdvisorFilter}
        onStatusFilterChange={setSelectedStatusFilter}
      />

      {/* Inline Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                : 'bg-red-50/95 dark:bg-red-950/95 border-red-200 dark:border-red-500/40 text-red-800 dark:text-red-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area based on Active Tab */}
      <main className="flex-1 w-full px-3 sm:px-4 py-4 space-y-5">
        {activeMainTab === 'le_tan' && currentUser.permissions.canAccessLeTan && (
          <ReceptionTab
            currentDate={selectedDate}
            appointments={appointments}
            receptionEntries={receptionEntries}
            advisors={activeAdvisors}
            advisorRequests={advisorRequests}
            currentUser={currentUser}
            now={now}
            onAddReceptionEntry={handleAddReceptionEntry}
            onUpdateReceptionEntry={handleUpdateReceptionEntry}
            onTransferToAdvisor={handleTransferToAdvisor}
            onRecallFromAdvisor={handleRecallFromAdvisor}
            onDeleteReceptionEntry={handleDeleteReceptionEntry}
          />
        )}

        {activeMainTab === 'dat_hen' &&
          currentUser.permissions.canAccessDatHen &&
          (viewMode === 'timeline' ? (
            <TimelineGrid
              currentDate={selectedDate}
              appointments={filteredAppointments}
              onDateChange={setSelectedDate}
              onSelectSlot={(bayId, timeSlot) => handleOpenNewModal(bayId, timeSlot)}
              onEditAppointment={handleEditAppointment}
              now={now}
            />
          ) : (
            <TableView
              appointments={filteredAppointments}
              selectedDate={selectedDate}
              onEditAppointment={handleEditAppointment}
              onOpenNewModal={() => handleOpenNewModal()}
            />
          ))}

        {activeMainTab === 'co_van' && currentUser.permissions.canAccessCoVan && (
          <AdvisorTab
            currentDate={selectedDate}
            appointments={appointments}
            receptionEntries={receptionEntries}
            advisors={activeAdvisors}
            advisorRequests={advisorRequests}
            currentUser={currentUser}
            now={now}
            onSelectAppointment={handleEditAppointment}
            onUpdateReceptionStatus={handleUpdateReceptionEntry}
            onStartReceivingVehicle={handleAdvisorStartReceiving}
            onReturnToWaitingQueue={handleReturnToWaitingQueue}
            onRequestPickup={handleRequestPickup}
            onCancelPickupRequest={handleCancelPickupRequest}
          />
        )}

        {activeMainTab === 'cai_dat' && currentUser.permissions.canAccessSettings && (
          <SettingsTab
            currentUser={currentUser}
            userAccounts={userAccounts}
            accessRequests={accessRequests}
            auditLogs={auditLogs}
            sheetsConfig={sheetsConfig}
            systemSettings={systemSettings}
            onSaveStaffAccount={handleSaveStaffAccount}
            onDeleteStaffAccount={handleDeleteStaffAccount}
            onRejectAccessRequest={handleRejectAccessRequest}
            onUpdateSheetsConfig={handleUpdateSheetsConfig}
            onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
            onTriggerSyncNow={triggerFullPush}
            onUpdateSystemSettings={handleUpdateSystemSettings}
            onSeedSampleData={handleSeedSampleData}
          />
        )}
      </main>

      {/* Appointment Modal (Create / Edit / Advisor Status Update / Read-Only) */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        appointment={editingAppointment}
        existingAppointments={appointments}
        advisors={activeAdvisors}
        selectedDate={modalDefaultDate}
        defaultTimeSlot={defaultSlot}
        defaultBayId={defaultBayId}
        now={now}
        editMode={getModalEditMode()}
        canDelete={
          currentUser.role === 'quan_ly' || currentUser.permissions.canDeleteAppointments
        }
        onClose={() => setIsAppointmentModalOpen(false)}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
      />

      {/* Google Sheets Integration Modal */}
      {currentUser.permissions.canSyncSheets && (
        <GoogleSheetsModal
          isOpen={isSheetsModalOpen}
          user={firebaseUser}
          config={sheetsConfig}
          appointments={appointments}
          receptionEntries={receptionEntries}
          userAccounts={userAccounts}
          onClose={() => setIsSheetsModalOpen(false)}
          onUpdateConfig={handleUpdateSheetsConfig}
          onDataImported={handleAllDataImported}
          onTriggerRealtimePush={triggerFullPush}
        />
      )}
    </div>
  );
}
