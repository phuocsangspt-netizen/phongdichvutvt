export type ServiceType = 'Bảo Dưỡng' | 'Sửa Chữa' | 'Đồng Sơn' | 'BG BHểm' | 'Kiểm Tra' | 'Rửa Xe' | string;

export type AppointmentStatus =
  | 'Chờ Tiếp Nhận'
  | 'Đã Xác Nhận'
  | 'Đang Làm'
  | 'Hoàn Thành'
  | 'Đã Hủy';

export type PriorityLevel = 'Thường' | 'Ưu Tiên' | 'VIP' | 'Gấp' | 'Khách Chờ Lấy Liền';

export type CardColor = 'purple' | 'green' | 'pink' | 'blue' | 'amber';

export interface ServiceBay {
  id: string;
  name: string;
  category: 'Bảo Dưỡng' | 'Sửa Chữa' | 'Đồng Sơn' | 'BG BHểm' | string;
  code: string;
  description?: string;
}

export interface ServiceAdvisor {
  id: string;
  name: string;
  avatar: string;
  phone?: string;
  role: string;
  badgeColor?: string;
}

export interface Appointment {
  id: string;
  licensePlate: string;
  advisorName: string;
  advisorAvatar?: string;
  serviceTypes: string[];
  customerName: string;
  phoneNumber: string;
  bookingStaff: string;
  status: AppointmentStatus;
  priority: PriorityLevel;
  location: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  durationMinutes: number;
  bayId: string;
  bayName?: string;
  content: string;
  cardColor?: CardColor;
  createdByUid?: string;
  createdByEmail?: string;
  createdByName?: string;
  updatedByEmail?: string;
  updatedByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ReceptionStatus =
  | 'Chờ Tiếp Nhận'
  | 'Đang Tiếp Nhận'
  | 'Đã Tiếp Nhận'
  | 'Cố Vấn Đang Tiếp Nhận'
  | 'Đã Vào Khoang'
  | 'Đang Sửa Chữa'
  | 'Chờ Rửa Xe'
  | 'Chờ Giao Xe'
  | 'Đã Giao Xe'
  | 'Hoàn Thành';

export interface ReceptionEntry {
  id: string;
  licensePlate: string;
  hasAppointment: boolean;
  appointmentId?: string;
  appointmentTime?: string;
  appointmentContent?: string;
  suggestedAdvisorName?: string;
  advisorName: string; // Empty string while waiting at Reception; set to advisor fullName upon transfer
  cardTicketNumber: string;
  cardSlotCode: string;
  serviceTypes: string[];
  customerName: string;
  phoneNumber?: string;
  checkInTime: string;
  checkInDate: string;
  status: ReceptionStatus;
  notes?: string;
  badgeType?: 'H' | 'S' | 'T' | '';
  deliveryDate?: string; // Ngày Giao Xe (e.g. YYYY-MM-DDTHH:mm or display string)
  carWash?: string; // Rửa Xe
  customerWaiting?: string; // Khách Chờ
  priority?: string; // Ưu Tiên
  location?: string; // Khu Vực (e.g. Vũng Tàu)
  assignedAt?: string; // ISO timestamp when Reception transferred the car to the Advisor
  assignedByName?: string;
  receivedAt?: string; // ISO timestamp when Advisor confirmed Kết Thúc Tiếp Nhận / Đã Tiếp Nhận
  deliveredAt?: string; // ISO timestamp when Advisor clicked Giao Xe
  createdAt?: string; // ISO timestamp when vehicle checked in at Reception
  createdByUid?: string;
  createdByEmail?: string;
  createdByName?: string;
  updatedByEmail?: string;
  updatedByName?: string;
  updatedAt?: string;
}

export interface AdvisorPickupRequest {
  id: string; // Deterministic staffId (one active request per advisor)
  advisorUid: string;
  advisorName: string;
  advisorAvatar?: string;
  note?: string;
  status: 'waiting';
  createdAt: string; // ISO timestamp
}

export type UserRole = 'quan_ly' | 'le_tan' | 'co_van' | 'dat_hen';

export interface UserPermissions {
  canAccessDatHen: boolean;
  canCreateAppointments: boolean;
  canEditAppointments: boolean;
  canDeleteAppointments: boolean;
  canAccessLeTan: boolean;
  canCheckInCars: boolean;
  canDeleteReception: boolean;
  canAccessCoVan: boolean;
  canUpdateVehicleStatus: boolean;
  canAccessSettings: boolean;
  canSyncSheets: boolean;
}

export interface UserAccount {
  id: string; // Deterministic sanitized email ID (matches Firestore /staff/{id})
  email: string; // Verified Google email used for login
  username?: string; // Legacy display handle
  fullName: string;
  role: UserRole;
  roleTitle: string;
  assignedAdvisorName?: string;
  avatar: string;
  phone?: string;
  department?: string;
  employeeCode?: string;
  uid?: string; // Linked Firebase Auth UID after first login
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  approvedBy?: string;
  permissions: UserPermissions;
}

export interface AccessRequest {
  id: string; // Deterministic sanitized email ID
  uid: string;
  email: string;
  fullName: string;
  avatar?: string;
  requestedRole: 'le_tan' | 'co_van' | 'dat_hen';
  note?: string;
  status: 'pending' | 'rejected';
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: 'appointment' | 'reception' | 'staff' | 'settings' | 'auth';
  targetId?: string;
  summary: string;
  actorUid: string;
  actorEmail: string;
  actorName: string;
  actorRole: UserRole;
  createdAt: string;
}

export interface SystemSettings {
  workshopName: string;
  branchName: string;
  phoneNumber: string;
  address: string;
  autoSyncInterval: number;
  allowReceptionCheckInWithoutAppointment: boolean;
  defaultDurationMinutes: number;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  sheetTitle: string;
  lastSyncedAt: string | null;
  isAutoSyncEnabled: boolean;
  syncIntervalSeconds: number;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  syncErrorMessage?: string | null;
}
