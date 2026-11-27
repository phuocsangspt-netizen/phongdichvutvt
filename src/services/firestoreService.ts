import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, auth, emailToStaffId, BOOTSTRAPPED_ADMIN_EMAIL } from './firebaseAuth';
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
  UserPermissions,
  UserRole,
} from '../types/appointment';
import { DEFAULT_ROLE_PERMISSIONS } from '../data/mockData';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper: strip undefined fields and clamp string lengths to match firebase-blueprint.json
function clampStr(val: string | undefined | null, maxLen: number): string {
  if (!val) return '';
  return String(val).trim().slice(0, maxLen);
}

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

function cleanObject<T extends Record<string, any>>(obj: T): Record<string, any> {
  const out: Record<string, any> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out;
}

function normalizePermissions(p?: Partial<UserPermissions>, role: UserRole = 'le_tan'): UserPermissions {
  const base = DEFAULT_ROLE_PERMISSIONS[role];
  return {
    canAccessDatHen: Boolean(p?.canAccessDatHen ?? base.canAccessDatHen),
    canCreateAppointments: Boolean(p?.canCreateAppointments ?? base.canCreateAppointments),
    canEditAppointments: Boolean(p?.canEditAppointments ?? base.canEditAppointments),
    canDeleteAppointments: Boolean(p?.canDeleteAppointments ?? base.canDeleteAppointments),
    canAccessLeTan: Boolean(p?.canAccessLeTan ?? base.canAccessLeTan),
    canCheckInCars: Boolean(p?.canCheckInCars ?? base.canCheckInCars),
    canDeleteReception: Boolean(p?.canDeleteReception ?? base.canDeleteReception),
    canAccessCoVan: Boolean(p?.canAccessCoVan ?? base.canAccessCoVan),
    canUpdateVehicleStatus: Boolean(p?.canUpdateVehicleStatus ?? base.canUpdateVehicleStatus),
    canAccessSettings: Boolean(p?.canAccessSettings ?? base.canAccessSettings),
    canSyncSheets: Boolean(p?.canSyncSheets ?? base.canSyncSheets),
  };
}

// =============================================================================
// Staff Profile & Bootstrapping
// =============================================================================

export async function bootstrapAdminIfNeeded(firebaseUser: User): Promise<UserAccount | null> {
  if (!firebaseUser.email || !firebaseUser.emailVerified) return null;
  const emailLower = firebaseUser.email.trim().toLowerCase();
  const staffId = emailToStaffId(emailLower);
  const path = `staff/${staffId}`;

  try {
    const snap = await getDoc(doc(db, 'staff', staffId));
    if (snap.exists()) {
      const existing = snap.data() as UserAccount;
      // Sync login metadata (uid, lastLoginAt, Google photo) if active
      if (existing.isActive) {
        try {
          await updateDoc(doc(db, 'staff', staffId), {
            uid: firebaseUser.uid,
            lastLoginAt: new Date().toISOString(),
            avatar: clampStr(firebaseUser.photoURL || existing.avatar, 500),
            updatedAt: new Date().toISOString(),
          });
        } catch {
          // Non-fatal metadata update
        }
      }
      return existing;
    }

    // Auto-provision the bootstrapped dealership manager on first login
    if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL) {
      const nowIso = new Date().toISOString();
      const adminProfile: UserAccount = {
        id: staffId,
        email: emailLower,
        fullName: clampStr(firebaseUser.displayName || 'Quản Lý Xưởng Dịch Vụ', 120),
        role: 'quan_ly',
        roleTitle: 'Quản Lý Xưởng (Chủ Hệ Thống)',
        avatar: clampStr(
          firebaseUser.photoURL ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(staffId)}&backgroundColor=b6e3f4`,
          500
        ),
        phone: '',
        department: 'Ban Quản Lý',
        employeeCode: 'QL-001',
        uid: firebaseUser.uid,
        isActive: true,
        permissions: normalizePermissions(DEFAULT_ROLE_PERMISSIONS.quan_ly, 'quan_ly'),
        createdAt: nowIso.split('T')[0],
        updatedAt: nowIso,
        lastLoginAt: nowIso,
        approvedBy: emailLower,
      };
      await setDoc(doc(db, 'staff', staffId), cleanObject(adminProfile));
      return adminProfile;
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeMyStaffProfile(
  email: string,
  onData: (profile: UserAccount | null) => void,
  onError?: (err: Error) => void
) {
  const staffId = emailToStaffId(email);
  const path = `staff/${staffId}`;
  return onSnapshot(
    doc(db, 'staff', staffId),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as UserAccount);
      } else {
        onData(null);
      }
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Logged via handleFirestoreError
      }
    }
  );
}

export function subscribeAllStaff(
  onData: (accounts: UserAccount[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'staff';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: UserAccount[] = snapshot.docs.map((d) => d.data() as UserAccount);
      list.sort((a, b) => {
        if (a.role === 'quan_ly' && b.role !== 'quan_ly') return -1;
        if (b.role === 'quan_ly' && a.role !== 'quan_ly') return 1;
        return a.fullName.localeCompare(b.fullName, 'vi');
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeAdvisors(
  onData: (advisors: ServiceAdvisor[]) => void
) {
  const path = 'advisors';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: ServiceAdvisor[] = snapshot.docs
        .map((d) => d.data() as ServiceAdvisor & { isActive?: boolean })
        .filter((a) => a.isActive !== false)
        .map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role || 'Cố Vấn Dịch Vụ',
          avatar:
            a.avatar ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.id)}&backgroundColor=b6e3f4`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged
      }
    }
  );
}

export async function upsertStaffAccount(
  account: UserAccount,
  actor: UserAccount
): Promise<void> {
  const emailLower = account.email.trim().toLowerCase();
  const staffId = emailToStaffId(emailLower);
  const path = `staff/${staffId}`;
  const nowIso = new Date().toISOString();
  const safeAvatar = clampStr(
    account.avatar ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(staffId)}&backgroundColor=b6e3f4`,
    500
  );
  const safeFullName = clampStr(account.fullName, 120);
  const safeRoleTitle = clampStr(account.roleTitle || 'Nhân Viên', 100);

  const payload = cleanObject({
    id: staffId,
    email: clampStr(emailLower, 160),
    fullName: safeFullName,
    role: account.role,
    roleTitle: safeRoleTitle,
    avatar: safeAvatar,
    phone: clampStr(account.phone, 30),
    department: clampStr(account.department, 80),
    employeeCode: clampStr(account.employeeCode, 40),
    uid: account.uid ? clampStr(account.uid, 128) : undefined,
    isActive: Boolean(account.isActive),
    permissions: normalizePermissions(account.permissions, account.role),
    createdAt: clampStr(account.createdAt || nowIso.split('T')[0], 64),
    updatedAt: nowIso,
    lastLoginAt: account.lastLoginAt ? clampStr(account.lastLoginAt, 64) : undefined,
    approvedBy: clampStr(account.approvedBy || actor.email, 160),
  });

  try {
    await setDoc(doc(db, 'staff', staffId), payload);

    // Sync independent non-PII Service Advisor profile in /advisors
    if (account.role === 'co_van' && account.isActive) {
      await setDoc(
        doc(db, 'advisors', staffId),
        cleanObject({
          id: staffId,
          name: safeFullName,
          role: safeRoleTitle,
          avatar: safeAvatar,
          isActive: true,
          updatedAt: nowIso,
        })
      );
    } else {
      await deleteDoc(doc(db, 'advisors', staffId)).catch(() => {});
    }

    await writeAuditLog({
      action: 'UPSERT_STAFF',
      targetType: 'staff',
      targetId: staffId,
      summary: `${account.isActive ? 'Cấp / cập nhật' : 'Khóa'} tài khoản ${safeFullName} (${emailLower}) — ${safeRoleTitle}`,
      actor,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStaffAccount(
  staffId: string,
  targetLabel: string,
  actor: UserAccount
): Promise<void> {
  const safeId = sanitizeId(staffId, 'staff');
  const path = `staff/${safeId}`;
  try {
    await deleteDoc(doc(db, 'staff', safeId));
    await deleteDoc(doc(db, 'advisors', safeId)).catch(() => {});
    await writeAuditLog({
      action: 'DELETE_STAFF',
      targetType: 'staff',
      targetId: safeId,
      summary: `Xóa tài khoản nhân viên: ${targetLabel}`,
      actor,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Pending Employee Access Requests
// =============================================================================

export function subscribeMyAccessRequest(
  email: string,
  onData: (req: AccessRequest | null) => void
) {
  const reqId = emailToStaffId(email);
  const path = `accessRequests/${reqId}`;
  return onSnapshot(
    doc(db, 'accessRequests', reqId),
    (snap) => {
      onData(snap.exists() ? (snap.data() as AccessRequest) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeAllAccessRequests(
  onData: (requests: AccessRequest[]) => void
) {
  const path = 'accessRequests';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as AccessRequest);
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged
      }
    }
  );
}

export async function submitAccessRequest(
  firebaseUser: User,
  requestedRole: 'le_tan' | 'co_van' | 'dat_hen',
  fullName: string,
  note: string
): Promise<void> {
  if (!firebaseUser.email) throw new Error('Thiếu email Google');
  const emailLower = firebaseUser.email.trim().toLowerCase();
  const reqId = emailToStaffId(emailLower);
  const path = `accessRequests/${reqId}`;

  const payload: AccessRequest = {
    id: reqId,
    uid: firebaseUser.uid,
    email: clampStr(emailLower, 160),
    fullName: clampStr(fullName || firebaseUser.displayName || emailLower.split('@')[0], 120),
    avatar: clampStr(firebaseUser.photoURL || '', 500),
    requestedRole,
    note: clampStr(note, 300),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'accessRequests', reqId), cleanObject(payload));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAccessRequest(requestId: string): Promise<void> {
  const safeId = sanitizeId(requestId, 'req');
  const path = `accessRequests/${safeId}`;
  try {
    await deleteDoc(doc(db, 'accessRequests', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Appointments Real-time Sync
// =============================================================================

export function subscribeAppointments(
  onData: (appointments: Appointment[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'appointments';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as Appointment);
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged
      }
    }
  );
}

export async function saveAppointmentToFirestore(
  apt: Appointment,
  isNew: boolean,
  actor: UserAccount
): Promise<void> {
  const safeId = sanitizeId(apt.id || `apt_${Date.now()}`, 'apt');
  const path = `appointments/${safeId}`;
  const nowIso = new Date().toISOString();
  const safeTypes = (apt.serviceTypes && apt.serviceTypes.length > 0 ? apt.serviceTypes : ['Bảo Dưỡng'])
    .slice(0, 10)
    .map((t) => clampStr(t, 80));

  const payload = cleanObject({
    id: safeId,
    licensePlate: clampStr(apt.licensePlate.toUpperCase(), 30),
    advisorName: clampStr(apt.advisorName, 120),
    advisorAvatar: clampStr(apt.advisorAvatar, 500),
    serviceTypes: safeTypes,
    customerName: clampStr(apt.customerName || 'KHÁCH HÀNG', 120),
    phoneNumber: clampStr(apt.phoneNumber, 30),
    bookingStaff: clampStr(apt.bookingStaff || actor.fullName, 120),
    status: apt.status,
    priority: apt.priority,
    location: clampStr(apt.location || 'Vũng Tàu', 100),
    appointmentDate: clampStr(apt.appointmentDate, 10),
    appointmentTime: clampStr(apt.appointmentTime, 5),
    durationMinutes: Math.min(480, Math.max(15, Number(apt.durationMinutes) || 30)),
    bayId: clampStr(apt.bayId || 'bay_bd_1', 64),
    bayName: clampStr(apt.bayName || 'EM 01', 64),
    content: clampStr(apt.content || 'BD NHỎ', 1000),
    cardColor: apt.cardColor || 'purple',
    createdByUid: isNew ? auth.currentUser?.uid || actor.uid : apt.createdByUid,
    createdByEmail: isNew ? actor.email : apt.createdByEmail,
    createdByName: isNew ? actor.fullName : apt.createdByName,
    updatedByEmail: clampStr(actor.email, 160),
    updatedByName: clampStr(actor.fullName, 120),
    createdAt: isNew ? nowIso : apt.createdAt,
    updatedAt: nowIso,
  });

  try {
    if (isNew) {
      await setDoc(doc(db, 'appointments', safeId), payload);
    } else if (actor.role === 'quan_ly' || actor.permissions.canEditAppointments) {
      // Strictly mutable fields so immutable createdAt / createdByUid are never touched
      await updateDoc(doc(db, 'appointments', safeId), cleanObject({
        licensePlate: payload.licensePlate,
        advisorName: payload.advisorName,
        advisorAvatar: payload.advisorAvatar,
        serviceTypes: payload.serviceTypes,
        customerName: payload.customerName,
        phoneNumber: payload.phoneNumber,
        bookingStaff: payload.bookingStaff,
        status: payload.status,
        priority: payload.priority,
        location: payload.location,
        appointmentDate: payload.appointmentDate,
        appointmentTime: payload.appointmentTime,
        durationMinutes: payload.durationMinutes,
        bayId: payload.bayId,
        bayName: payload.bayName,
        content: payload.content,
        cardColor: payload.cardColor,
        updatedByEmail: payload.updatedByEmail,
        updatedByName: payload.updatedByName,
        updatedAt: payload.updatedAt,
      }));
    } else {
      // Advisor scoped update: strictly allowed fields matching firestore.rules Tier 3
      await updateDoc(doc(db, 'appointments', safeId), {
        status: payload.status,
        content: payload.content,
        cardColor: payload.cardColor,
        updatedByEmail: payload.updatedByEmail,
        updatedByName: payload.updatedByName,
        updatedAt: payload.updatedAt,
      });
    }

    await writeAuditLog({
      action: isNew ? 'CREATE_APPOINTMENT' : 'UPDATE_APPOINTMENT',
      targetType: 'appointment',
      targetId: safeId,
      summary: `${isNew ? 'Đặt hẹn mới' : 'Cập nhật lịch hẹn'} xe ${payload.licensePlate} (${payload.appointmentDate} ${payload.appointmentTime} — ${payload.status})`,
      actor,
    });
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function syncAppointmentStatusFromWorkflow(
  apt: Appointment,
  nextStatus: 'Chờ Tiếp Nhận' | 'Đang Làm' | 'Hoàn Thành',
  actor: UserAccount
): Promise<void> {
  const safeId = sanitizeId(apt.id, 'apt');
  const path = `appointments/${safeId}`;
  const cardColor =
    nextStatus === 'Chờ Tiếp Nhận'
      ? 'blue'
      : nextStatus === 'Đang Làm'
      ? 'amber'
      : 'green';
  try {
    await updateDoc(doc(db, 'appointments', safeId), {
      status: nextStatus,
      cardColor,
      updatedByEmail: clampStr(actor.email, 160),
      updatedByName: clampStr(actor.fullName, 120),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAppointmentInProgressByReception(
  apt: Appointment,
  actor: UserAccount
): Promise<void> {
  return syncAppointmentStatusFromWorkflow(apt, 'Đang Làm', actor);
}

export async function deleteAppointmentFromFirestore(
  id: string,
  licensePlate: string,
  actor: UserAccount
): Promise<void> {
  const safeId = sanitizeId(id, 'apt');
  const path = `appointments/${safeId}`;
  try {
    await deleteDoc(doc(db, 'appointments', safeId));
    await writeAuditLog({
      action: 'DELETE_APPOINTMENT',
      targetType: 'appointment',
      targetId: safeId,
      summary: `Xóa lịch hẹn xe ${licensePlate}`,
      actor,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Reception Queue Real-time Sync
// =============================================================================

export function subscribeReceptionEntries(
  onData: (entries: ReceptionEntry[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'receptionEntries';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as ReceptionEntry);
      list.sort((a, b) => `${b.checkInDate} ${b.checkInTime}`.localeCompare(`${a.checkInDate} ${a.checkInTime}`));
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged
      }
    }
  );
}

export async function saveReceptionToFirestore(
  entry: ReceptionEntry,
  isNew: boolean,
  actor: UserAccount
): Promise<void> {
  const safeId = sanitizeId(entry.id || `rec_${Date.now()}`, 'rec');
  const path = `receptionEntries/${safeId}`;
  const nowIso = new Date().toISOString();
  const safeTypes = (entry.serviceTypes && entry.serviceTypes.length > 0 ? entry.serviceTypes : ['Bảo Dưỡng'])
    .slice(0, 10)
    .map((t) => clampStr(t, 80));

  const payload = cleanObject({
    id: safeId,
    licensePlate: clampStr(entry.licensePlate.toUpperCase(), 30),
    hasAppointment: Boolean(entry.hasAppointment),
    appointmentId: entry.appointmentId ? clampStr(entry.appointmentId, 128) : undefined,
    appointmentTime: entry.appointmentTime ? clampStr(entry.appointmentTime, 40) : undefined,
    appointmentContent: entry.appointmentContent !== undefined ? clampStr(entry.appointmentContent, 1000) : undefined,
    suggestedAdvisorName: entry.suggestedAdvisorName !== undefined ? clampStr(entry.suggestedAdvisorName, 120) : undefined,
    advisorName: clampStr(entry.advisorName, 120),
    cardTicketNumber: clampStr(entry.cardTicketNumber || '', 20),
    cardSlotCode: clampStr(entry.cardSlotCode || '0', 20),
    serviceTypes: safeTypes,
    customerName: clampStr(entry.customerName || 'KHÁCH HÀNG', 120),
    phoneNumber: clampStr(entry.phoneNumber, 30),
    checkInTime: clampStr(entry.checkInTime || '08:00', 10),
    checkInDate: clampStr(entry.checkInDate, 10),
    status: entry.status,
    notes: clampStr(entry.notes, 1000),
    badgeType: entry.badgeType || '',
    deliveryDate: entry.deliveryDate !== undefined ? clampStr(entry.deliveryDate, 40) : undefined,
    carWash: entry.carWash !== undefined ? clampStr(entry.carWash, 60) : undefined,
    customerWaiting: entry.customerWaiting !== undefined ? clampStr(entry.customerWaiting, 60) : undefined,
    priority: entry.priority !== undefined ? clampStr(entry.priority, 40) : undefined,
    location: entry.location !== undefined ? clampStr(entry.location, 100) : undefined,
    assignedAt: entry.assignedAt !== undefined ? clampStr(entry.assignedAt, 64) : undefined,
    assignedByName: entry.assignedByName !== undefined ? clampStr(entry.assignedByName, 120) : undefined,
    receivedAt: entry.receivedAt !== undefined ? clampStr(entry.receivedAt, 64) : undefined,
    deliveredAt: entry.deliveredAt !== undefined ? clampStr(entry.deliveredAt, 64) : undefined,
    createdAt: isNew ? entry.createdAt || nowIso : entry.createdAt,
    createdByUid: isNew ? auth.currentUser?.uid || actor.uid : entry.createdByUid,
    createdByEmail: isNew ? actor.email : entry.createdByEmail,
    createdByName: isNew ? actor.fullName : entry.createdByName,
    updatedByEmail: clampStr(actor.email, 160),
    updatedByName: clampStr(actor.fullName, 120),
    updatedAt: nowIso,
  });

  try {
    if (isNew) {
      await setDoc(doc(db, 'receptionEntries', safeId), payload);
    } else if (actor.role === 'quan_ly') {
      await setDoc(doc(db, 'receptionEntries', safeId), payload, { merge: true });
    } else if (actor.permissions.canCheckInCars) {
      await updateDoc(doc(db, 'receptionEntries', safeId), cleanObject({
        licensePlate: payload.licensePlate,
        hasAppointment: payload.hasAppointment,
        appointmentId: payload.appointmentId,
        appointmentTime: payload.appointmentTime,
        appointmentContent: payload.appointmentContent,
        suggestedAdvisorName: payload.suggestedAdvisorName,
        advisorName: payload.advisorName,
        cardTicketNumber: payload.cardTicketNumber,
        cardSlotCode: payload.cardSlotCode,
        serviceTypes: payload.serviceTypes,
        customerName: payload.customerName,
        phoneNumber: payload.phoneNumber,
        status: payload.status,
        notes: payload.notes,
        badgeType: payload.badgeType,
        deliveryDate: payload.deliveryDate,
        carWash: payload.carWash,
        customerWaiting: payload.customerWaiting,
        priority: payload.priority,
        location: payload.location,
        assignedAt: payload.assignedAt,
        assignedByName: payload.assignedByName,
        receivedAt: payload.receivedAt,
        deliveredAt: payload.deliveredAt,
        updatedByEmail: payload.updatedByEmail,
        updatedByName: payload.updatedByName,
        updatedAt: payload.updatedAt,
      }));
    } else {
      await updateDoc(doc(db, 'receptionEntries', safeId), cleanObject({
        serviceTypes: payload.serviceTypes,
        appointmentContent: payload.appointmentContent,
        status: payload.status,
        notes: payload.notes || '',
        deliveryDate: payload.deliveryDate,
        carWash: payload.carWash,
        customerWaiting: payload.customerWaiting,
        priority: payload.priority,
        location: payload.location,
        receivedAt: payload.receivedAt,
        deliveredAt: payload.deliveredAt,
        updatedByEmail: payload.updatedByEmail,
        updatedByName: payload.updatedByName,
        updatedAt: payload.updatedAt,
      }));
    }

    const summary = isNew
      ? `Tiếp nhận xe vào xưởng ${payload.licensePlate} (${payload.hasAppointment ? 'Có hẹn' : 'Vãng lai'})`
      : payload.status === 'Đang Tiếp Nhận' && payload.advisorName
      ? `Chuyển xe ${payload.licensePlate} sang Cố Vấn ${payload.advisorName}`
      : `Cập nhật tiến độ xe ${payload.licensePlate} — ${payload.status}`;

    await writeAuditLog({
      action: isNew ? 'CHECKIN_VEHICLE' : 'UPDATE_RECEPTION',
      targetType: 'reception',
      targetId: safeId,
      summary,
      actor,
    });
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function advisorStartReceivingVehicle(
  entry: ReceptionEntry,
  targetAdvisorName: string,
  actor: UserAccount
): Promise<void> {
  const safeId = sanitizeId(entry.id, 'rec');
  const path = `receptionEntries/${safeId}`;
  const nowIso = new Date().toISOString();
  const safeAdvisorName = clampStr(targetAdvisorName || actor.fullName, 120);
  const isClaimingUnassigned = !entry.advisorName || entry.advisorName.trim() === '';

  const updateFields: Record<string, any> = {
    status: 'Đang Tiếp Nhận',
    assignedAt: nowIso,
    assignedByName: clampStr(actor.fullName, 120),
    updatedByEmail: clampStr(actor.email, 160),
    updatedByName: clampStr(actor.fullName, 120),
    updatedAt: nowIso,
  };

  if (isClaimingUnassigned || entry.advisorName !== safeAdvisorName) {
    updateFields.advisorName = safeAdvisorName;
  }

  try {
    await updateDoc(doc(db, 'receptionEntries', safeId), updateFields);
    await writeAuditLog({
      action: 'ADVISOR_START_RECEIVING',
      targetType: 'reception',
      targetId: safeId,
      summary: `Cố vấn ${safeAdvisorName} bắt đầu tiếp nhận xe ${entry.licensePlate}${
        isClaimingUnassigned ? ' (từ hàng chờ None)' : ' (từ danh sách chỉ định)'
      }`,
      actor,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function returnVehicleToWaitingQueue(
  entry: ReceptionEntry,
  actor: UserAccount
): Promise<void> {
  const safeId = sanitizeId(entry.id, 'rec');
  const path = `receptionEntries/${safeId}`;
  const nowIso = new Date().toISOString();

  try {
    await updateDoc(doc(db, 'receptionEntries', safeId), {
      advisorName: '',
      status: 'Chờ Tiếp Nhận',
      assignedAt: '',
      assignedByName: '',
      updatedByEmail: clampStr(actor.email, 160),
      updatedByName: clampStr(actor.fullName, 120),
      updatedAt: nowIso,
    });
    await writeAuditLog({
      action: 'RETURN_TO_WAITING_QUEUE',
      targetType: 'reception',
      targetId: safeId,
      summary: `${actor.fullName} trả xe ${entry.licensePlate} về hàng chờ Lễ Tân (None)`,
      actor,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteReceptionFromFirestore(
  id: string,
  licensePlate: string,
  actor: UserAccount
): Promise<void> {
  const safeId = sanitizeId(id, 'rec');
  const path = `receptionEntries/${safeId}`;
  try {
    await deleteDoc(doc(db, 'receptionEntries', safeId));
    await writeAuditLog({
      action: 'DELETE_RECEPTION',
      targetType: 'reception',
      targetId: safeId,
      summary: `Xóa lượt tiếp nhận xe ${licensePlate}`,
      actor,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// 2-Way Advisor Pickup Requests (Advisor -> Reception)
// =============================================================================

export function subscribeAdvisorRequests(
  onData: (requests: AdvisorPickupRequest[]) => void
) {
  const path = 'advisorRequests';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as AdvisorPickupRequest);
      // FIFO: advisor who requested earliest appears first
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged
      }
    }
  );
}

export async function requestVehiclePickup(
  actor: UserAccount,
  note?: string
): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  const emailLower = auth.currentUser?.email?.trim().toLowerCase();
  if (!currentUid || !emailLower) throw new Error('Chưa đăng nhập');

  const requestId = emailToStaffId(emailLower);
  const path = `advisorRequests/${requestId}`;
  const payload: AdvisorPickupRequest = {
    id: requestId,
    advisorUid: currentUid,
    advisorName: clampStr(actor.fullName, 120),
    advisorAvatar: clampStr(actor.avatar, 500),
    note: clampStr(note || 'Sẵn sàng nhận xe tiếp theo', 200),
    status: 'waiting',
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'advisorRequests', requestId), cleanObject(payload));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cancelVehiclePickupRequest(requestId: string): Promise<void> {
  const safeId = sanitizeId(requestId, 'req');
  const path = `advisorRequests/${safeId}`;
  try {
    await deleteDoc(doc(db, 'advisorRequests', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Workshop Settings & Audit Logs
// =============================================================================

export function subscribeWorkshopSettings(
  onData: (data: { systemSettings: Partial<SystemSettings>; sheetsConfig: Partial<GoogleSheetsConfig> } | null) => void
) {
  const path = 'settings/workshop';
  return onSnapshot(
    doc(db, 'settings', 'workshop'),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        systemSettings: {
          workshopName: d.workshopName,
          branchName: d.branchName,
          phoneNumber: d.phoneNumber,
          address: d.address,
          autoSyncInterval: d.autoSyncInterval,
          allowReceptionCheckInWithoutAppointment: d.allowReceptionCheckInWithoutAppointment,
          defaultDurationMinutes: d.defaultDurationMinutes,
        },
        sheetsConfig: {
          spreadsheetId: d.spreadsheetId || null,
          spreadsheetUrl: d.spreadsheetUrl || null,
          sheetTitle: d.sheetTitle,
          isAutoSyncEnabled: d.isAutoSyncEnabled,
          syncIntervalSeconds: d.syncIntervalSeconds,
          lastSyncedAt: d.lastSyncedAt || null,
        },
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Logged
      }
    }
  );
}

export async function saveWorkshopSettingsToFirestore(
  settings: SystemSettings,
  sheetsConfig: GoogleSheetsConfig,
  actor: UserAccount
): Promise<void> {
  const path = 'settings/workshop';
  const payload = cleanObject({
    workshopName: clampStr(settings.workshopName || 'Hãng Xe Auto Service', 160),
    branchName: clampStr(settings.branchName || 'Chi nhánh Vũng Tàu', 120),
    phoneNumber: clampStr(settings.phoneNumber, 30),
    address: clampStr(settings.address, 240),
    autoSyncInterval: Math.min(3600, Math.max(5, Number(settings.autoSyncInterval) || 15)),
    allowReceptionCheckInWithoutAppointment: Boolean(settings.allowReceptionCheckInWithoutAppointment),
    defaultDurationMinutes: Math.min(240, Math.max(15, Number(settings.defaultDurationMinutes) || 30)),
    spreadsheetId: sheetsConfig.spreadsheetId ? clampStr(sheetsConfig.spreadsheetId, 160) : undefined,
    spreadsheetUrl: sheetsConfig.spreadsheetUrl ? clampStr(sheetsConfig.spreadsheetUrl, 300) : undefined,
    sheetTitle: clampStr(sheetsConfig.sheetTitle || 'CSDL Xưởng Dịch Vụ Ô Tô', 160),
    isAutoSyncEnabled: Boolean(sheetsConfig.isAutoSyncEnabled),
    syncIntervalSeconds: Math.min(3600, Math.max(10, Number(sheetsConfig.syncIntervalSeconds) || 15)),
    lastSyncedAt: sheetsConfig.lastSyncedAt ? clampStr(sheetsConfig.lastSyncedAt, 80) : undefined,
    updatedAt: new Date().toISOString(),
  });

  try {
    await setDoc(doc(db, 'settings', 'workshop'), payload);
    await writeAuditLog({
      action: 'UPDATE_SETTINGS',
      targetType: 'settings',
      targetId: 'workshop',
      summary: `Cập nhật cấu hình xưởng: ${payload.workshopName} (${payload.branchName})`,
      actor,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function writeAuditLog(params: {
  action: string;
  targetType: AuditLogEntry['targetType'];
  targetId?: string;
  summary: string;
  actor: UserAccount;
}): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  const currentEmail = auth.currentUser?.email?.trim().toLowerCase();
  if (!currentUid || !currentEmail) return;

  const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `auditLogs/${logId}`;
  const entry: AuditLogEntry = {
    id: logId,
    action: clampStr(params.action, 80),
    targetType: params.targetType,
    targetId: params.targetId ? clampStr(params.targetId, 128) : undefined,
    summary: clampStr(params.summary, 300),
    actorUid: currentUid,
    actorEmail: clampStr(currentEmail, 160),
    actorName: clampStr(params.actor.fullName, 120),
    actorRole: params.actor.role,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'auditLogs', logId), cleanObject(entry));
  } catch (error) {
    // Non-blocking audit log failure — still report via console
    console.warn('Audit log write skipped:', error);
  }
}

export function subscribeAuditLogs(onData: (logs: AuditLogEntry[]) => void) {
  const path = 'auditLogs';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(60));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as AuditLogEntry));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged
      }
    }
  );
}

/**
 * Bulk import helper (e.g., when Manager imports from Google Sheets or seeds initial data into Firestore).
 */
export async function bulkImportToFirestore(
  data: {
    appointments?: Appointment[];
    receptionEntries?: ReceptionEntry[];
    userAccounts?: UserAccount[];
  },
  actor: UserAccount
): Promise<void> {
  const batch = writeBatch(db);
  const nowIso = new Date().toISOString();

  if (data.appointments) {
    data.appointments.slice(0, 150).forEach((apt) => {
      const safeId = sanitizeId(apt.id, 'apt');
      const safeTypes = (apt.serviceTypes && apt.serviceTypes.length > 0 ? apt.serviceTypes : ['Bảo Dưỡng'])
        .slice(0, 10)
        .map((t) => clampStr(t, 80));
      batch.set(
        doc(db, 'appointments', safeId),
        cleanObject({
          id: safeId,
          licensePlate: clampStr(apt.licensePlate.toUpperCase(), 30),
          advisorName: clampStr(apt.advisorName, 120),
          advisorAvatar: clampStr(apt.advisorAvatar, 500),
          serviceTypes: safeTypes,
          customerName: clampStr(apt.customerName || 'KHÁCH HÀNG', 120),
          phoneNumber: clampStr(apt.phoneNumber, 30),
          bookingStaff: clampStr(apt.bookingStaff || actor.fullName, 120),
          status: apt.status,
          priority: apt.priority,
          location: clampStr(apt.location || 'Vũng Tàu', 100),
          appointmentDate: clampStr(apt.appointmentDate, 10),
          appointmentTime: clampStr(apt.appointmentTime, 5),
          durationMinutes: Math.min(480, Math.max(15, Number(apt.durationMinutes) || 30)),
          bayId: clampStr(apt.bayId || 'bay_bd_1', 64),
          bayName: clampStr(apt.bayName || 'EM 01', 64),
          content: clampStr(apt.content || 'BD NHỎ', 1000),
          cardColor: apt.cardColor || 'purple',
          updatedByEmail: clampStr(actor.email, 160),
          updatedByName: clampStr(actor.fullName, 120),
          updatedAt: nowIso,
        })
      );
    });
  }

  if (data.receptionEntries) {
    data.receptionEntries.slice(0, 150).forEach((rec) => {
      const safeId = sanitizeId(rec.id, 'rec');
      const safeTypes = (rec.serviceTypes && rec.serviceTypes.length > 0 ? rec.serviceTypes : ['Bảo Dưỡng'])
        .slice(0, 10)
        .map((t) => clampStr(t, 80));
      batch.set(
        doc(db, 'receptionEntries', safeId),
        cleanObject({
          id: safeId,
          licensePlate: clampStr(rec.licensePlate.toUpperCase(), 30),
          hasAppointment: Boolean(rec.hasAppointment),
          appointmentId: rec.appointmentId ? clampStr(rec.appointmentId, 128) : undefined,
          appointmentTime: rec.appointmentTime ? clampStr(rec.appointmentTime, 40) : undefined,
          advisorName: clampStr(rec.advisorName, 120),
          cardTicketNumber: clampStr(rec.cardTicketNumber || '', 20),
          cardSlotCode: clampStr(rec.cardSlotCode || '0', 20),
          serviceTypes: safeTypes,
          customerName: clampStr(rec.customerName || 'KHÁCH HÀNG', 120),
          phoneNumber: clampStr(rec.phoneNumber, 30),
          checkInTime: clampStr(rec.checkInTime || '08:00', 10),
          checkInDate: clampStr(rec.checkInDate, 10),
          status: rec.status,
          notes: clampStr(rec.notes, 1000),
          badgeType: rec.badgeType || '',
          updatedByEmail: clampStr(actor.email, 160),
          updatedByName: clampStr(actor.fullName, 120),
          updatedAt: nowIso,
        })
      );
    });
  }

  if (data.userAccounts && actor.role === 'quan_ly') {
    data.userAccounts
      .filter((u) => u.email && u.email.includes('@'))
      .slice(0, 100)
      .forEach((u) => {
        const emailLower = u.email.trim().toLowerCase();
        const staffId = emailToStaffId(emailLower);
        if (staffId === emailToStaffId(BOOTSTRAPPED_ADMIN_EMAIL) && actor.email !== BOOTSTRAPPED_ADMIN_EMAIL) {
          return;
        }
        const safeFullName = clampStr(u.fullName, 120);
        const safeRoleTitle = clampStr(u.roleTitle || 'Nhân Viên', 100);
        const safeAvatar = clampStr(u.avatar, 500);
        batch.set(
          doc(db, 'staff', staffId),
          cleanObject({
            id: staffId,
            email: clampStr(emailLower, 160),
            fullName: safeFullName,
            role: u.role,
            roleTitle: safeRoleTitle,
            avatar: safeAvatar,
            phone: clampStr(u.phone, 30),
            department: clampStr(u.department, 80),
            employeeCode: clampStr(u.employeeCode, 40),
            isActive: Boolean(u.isActive),
            permissions: normalizePermissions(u.permissions, u.role),
            createdAt: clampStr(u.createdAt || nowIso.split('T')[0], 64),
            updatedAt: nowIso,
            approvedBy: clampStr(actor.email, 160),
          })
        );
        if (u.role === 'co_van' && u.isActive) {
          batch.set(
            doc(db, 'advisors', staffId),
            cleanObject({
              id: staffId,
              name: safeFullName,
              role: safeRoleTitle,
              avatar: safeAvatar,
              isActive: true,
              updatedAt: nowIso,
            })
          );
        }
      });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_import');
  }
}

export async function seedSampleWorkshopDataIfEmpty(
  sampleAppointments: Appointment[],
  sampleReception: ReceptionEntry[],
  actor: UserAccount
): Promise<boolean> {
  try {
    const aptSnap = await getDocs(query(collection(db, 'appointments'), limit(1)));
    const recSnap = await getDocs(query(collection(db, 'receptionEntries'), limit(1)));
    if (!aptSnap.empty || !recSnap.empty) return false;

    await bulkImportToFirestore(
      {
        appointments: sampleAppointments,
        receptionEntries: sampleReception,
      },
      actor
    );
    return true;
  } catch (error) {
    console.warn('Initial seed check skipped:', error);
    return false;
  }
}
