import { Appointment, ReceptionEntry, UserAccount, SystemSettings, GoogleSheetsConfig } from '../types/appointment';
import { getAccessToken } from './firebaseAuth';

// Sheet 1: LichDatHen headers
export const APPOINTMENT_HEADERS = [
  'Mã Hẹn (ID)',
  'Ngày Hẹn',
  'Giờ Hẹn',
  'Biển Số',
  'Khách Hàng',
  'Số Điện Thoại',
  'Khoang Hẹn',
  'Loại Hình',
  'Nội Dung Hẹn',
  'Cố Vấn',
  'Nhân Viên Hẹn',
  'Trạng Thái',
  'Ưu Tiên',
  'Khu Vực',
  'Thời Lượng (phút)',
  'Màu Thẻ',
  'ID Khoang',
];

// Sheet 2: TiepNhanLeTan headers
export const RECEPTION_HEADERS = [
  'Mã Tiếp Nhận (ID)',
  'Biển Số',
  'Có Hẹn',
  'Giờ Hẹn',
  'Số Thẻ (Tag)',
  'Số Thẻ (Chờ)',
  'Cố Vấn Tiếp Nhận',
  'Loại Hình LHSC',
  'Tên Khách Hàng',
  'Số Điện Thoại',
  'Ngày Vào',
  'Giờ Vào',
  'Trạng Thái',
  'Ký Hiệu Huy Hiệu',
  'Ghi Chú',
  'Mã Hẹn Liên Kết',
];

// Sheet 3: TaiKhoanNguoiDung headers (Google Auth — NO passwords stored)
export const USER_HEADERS = [
  'Mã Tài Khoản',
  'Email Google',
  'Mã Nhân Viên',
  'Họ và Tên',
  'Mã Vị Trí (Role)',
  'Chức Danh',
  'Cố Vấn Liên Kết',
  'Số Điện Thoại',
  'Bộ Phận',
  'Trạng Thái Hoạt Động',
  'Quyền Hạn (JSON)',
  'Ngày Tạo',
];

// Sheet 4: CauHinhHeThong headers
export const CONFIG_HEADERS = [
  'Mã Cấu Hình (Key)',
  'Giá Trị (Value)',
  'Mô Tả Chi Tiết',
];

export const SHEET_NAMES = {
  APPOINTMENTS: 'LichDatHen',
  RECEPTION: 'TiepNhanLeTan',
  USERS: 'TaiKhoanNguoiDung',
  CONFIG: 'CauHinhHeThong',
} as const;

/**
 * Creates a complete Google Spreadsheet with 4 dedicated sheets configured.
 */
export async function createCompleteDatabaseSpreadsheet(
  title: string = 'Cơ Sở Dữ Liệu Xưởng Dịch Vụ Ô Tô'
): Promise<{ id: string; url: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn');

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: SHEET_NAMES.APPOINTMENTS,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: SHEET_NAMES.RECEPTION,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: SHEET_NAMES.USERS,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: SHEET_NAMES.CONFIG,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Không thể tạo bảng tính Google Sheets mới');
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;

  // Initialize all headers
  await Promise.all([
    writeSheetValues(spreadsheetId, `${SHEET_NAMES.APPOINTMENTS}!A1:Q1`, [APPOINTMENT_HEADERS]),
    writeSheetValues(spreadsheetId, `${SHEET_NAMES.RECEPTION}!A1:P1`, [RECEPTION_HEADERS]),
    writeSheetValues(spreadsheetId, `${SHEET_NAMES.USERS}!A1:L1`, [USER_HEADERS]),
    writeSheetValues(spreadsheetId, `${SHEET_NAMES.CONFIG}!A1:C1`, [CONFIG_HEADERS]),
  ]);

  return {
    id: spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Ensures an existing spreadsheet contains all required sheets, adding any missing ones.
 */
export async function ensureSpreadsheetStructure(spreadsheetId: string): Promise<string[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Không thể truy cập Google Sheet');
  }

  const data = await res.json();
  const existingTitles: string[] = (data.sheets || []).map((s: any) => s.properties?.title);

  const missingSheets: string[] = [];
  if (!existingTitles.includes(SHEET_NAMES.APPOINTMENTS)) missingSheets.push(SHEET_NAMES.APPOINTMENTS);
  if (!existingTitles.includes(SHEET_NAMES.RECEPTION)) missingSheets.push(SHEET_NAMES.RECEPTION);
  if (!existingTitles.includes(SHEET_NAMES.USERS)) missingSheets.push(SHEET_NAMES.USERS);
  if (!existingTitles.includes(SHEET_NAMES.CONFIG)) missingSheets.push(SHEET_NAMES.CONFIG);

  if (missingSheets.length > 0) {
    const requests = missingSheets.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    // Write headers for newly created sheets
    const headerPromises: Promise<any>[] = [];
    if (missingSheets.includes(SHEET_NAMES.APPOINTMENTS)) {
      headerPromises.push(writeSheetValues(spreadsheetId, `${SHEET_NAMES.APPOINTMENTS}!A1:Q1`, [APPOINTMENT_HEADERS]));
    }
    if (missingSheets.includes(SHEET_NAMES.RECEPTION)) {
      headerPromises.push(writeSheetValues(spreadsheetId, `${SHEET_NAMES.RECEPTION}!A1:P1`, [RECEPTION_HEADERS]));
    }
    if (missingSheets.includes(SHEET_NAMES.USERS)) {
      headerPromises.push(writeSheetValues(spreadsheetId, `${SHEET_NAMES.USERS}!A1:L1`, [USER_HEADERS]));
    }
    if (missingSheets.includes(SHEET_NAMES.CONFIG)) {
      headerPromises.push(writeSheetValues(spreadsheetId, `${SHEET_NAMES.CONFIG}!A1:C1`, [CONFIG_HEADERS]));
    }
    await Promise.all(headerPromises);
  }

  return missingSheets;
}

/**
 * Low-level write values helper.
 */
async function writeSheetValues(spreadsheetId: string, range: string, values: any[][]) {
  const token = await getAccessToken();
  if (!token) throw new Error('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn');

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Lỗi khi ghi vùng ${range}`);
  }
  return res.json();
}

/**
 * Clear rows below header.
 */
async function clearSheetRows(spreadsheetId: string, range: string) {
  const token = await getAccessToken();
  if (!token) return;

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

/**
 * EXPORT ALL DATA: Appointments, Reception, Users, Settings
 */
export async function exportAllToGoogleSheets(
  spreadsheetId: string,
  payload: {
    appointments: Appointment[];
    receptionEntries: ReceptionEntry[];
    userAccounts: UserAccount[];
    settings?: Partial<SystemSettings>;
  }
): Promise<{ appointmentsCount: number; receptionCount: number; usersCount: number }> {
  await ensureSpreadsheetStructure(spreadsheetId);

  // 1. Appointments rows
  const appointmentRows = payload.appointments.map((apt) => [
    apt.id,
    apt.appointmentDate,
    apt.appointmentTime,
    apt.licensePlate,
    apt.customerName,
    apt.phoneNumber,
    apt.bayName || apt.bayId,
    apt.serviceTypes.join(', '),
    apt.content,
    apt.advisorName,
    apt.bookingStaff,
    apt.status,
    apt.priority,
    apt.location,
    apt.durationMinutes || 30,
    apt.cardColor || 'purple',
    apt.bayId,
  ]);

  // 2. Reception rows
  const receptionRows = payload.receptionEntries.map((rec) => [
    rec.id,
    rec.licensePlate,
    rec.hasAppointment ? 'Có' : 'Không',
    rec.appointmentTime || '',
    rec.cardTicketNumber,
    rec.cardSlotCode,
    rec.advisorName,
    rec.serviceTypes.join(', '),
    rec.customerName,
    rec.phoneNumber || '',
    rec.checkInDate,
    rec.checkInTime,
    rec.status,
    rec.badgeType || '',
    rec.notes || '',
    rec.appointmentId || '',
  ]);

  // 3. User accounts rows (Google Auth Allowlist — no passwords)
  const userRows = payload.userAccounts.map((user) => [
    user.id,
    user.email,
    user.employeeCode || '',
    user.fullName,
    user.role,
    user.roleTitle,
    user.assignedAdvisorName || '',
    user.phone || '',
    user.department || '',
    user.isActive ? 'Hoạt động' : 'Tạm khóa',
    JSON.stringify(user.permissions),
    user.createdAt,
  ]);

  // 4. Configuration rows
  const settings = payload.settings || {};
  const configRows = [
    ['workshopName', settings.workshopName || 'Hãng Xe Auto Service', 'Tên xưởng dịch vụ'],
    ['branchName', settings.branchName || 'Chi nhánh Vũng Tàu', 'Chi nhánh'],
    ['phoneNumber', settings.phoneNumber || '0903123456', 'Hotline hỗ trợ'],
    ['autoSyncInterval', String(settings.autoSyncInterval || 15), 'Tần số đồng bộ thời gian thực (giây)'],
    ['lastExportAt', new Date().toISOString(), 'Thời điểm xuất dữ liệu toàn bộ'],
    ['totalAppointments', String(payload.appointments.length), 'Tổng số lịch hẹn'],
    ['totalReception', String(payload.receptionEntries.length), 'Tổng số xe tiếp nhận'],
    ['totalUsers', String(payload.userAccounts.length), 'Tổng số tài khoản'],
  ];

  // Clear stale data below row 1
  await Promise.all([
    clearSheetRows(spreadsheetId, `${SHEET_NAMES.APPOINTMENTS}!A2:Q1000`),
    clearSheetRows(spreadsheetId, `${SHEET_NAMES.RECEPTION}!A2:P1000`),
    clearSheetRows(spreadsheetId, `${SHEET_NAMES.USERS}!A2:L500`),
    clearSheetRows(spreadsheetId, `${SHEET_NAMES.CONFIG}!A2:C200`),
  ]);

  // Write all values
  await Promise.all([
    writeSheetValues(spreadsheetId, `${SHEET_NAMES.APPOINTMENTS}!A1:Q${appointmentRows.length + 1}`, [
      APPOINTMENT_HEADERS,
      ...appointmentRows,
    ]),
    writeSheetValues(spreadsheetId, `${SHEET_NAMES.RECEPTION}!A1:P${receptionRows.length + 1}`, [
      RECEPTION_HEADERS,
      ...receptionRows,
    ]),
    writeSheetValues(spreadsheetId, `${SHEET_NAMES.USERS}!A1:L${userRows.length + 1}`, [
      USER_HEADERS,
      ...userRows,
    ]),
    writeSheetValues(spreadsheetId, `${SHEET_NAMES.CONFIG}!A1:C${configRows.length + 1}`, [
      CONFIG_HEADERS,
      ...configRows,
    ]),
  ]);

  return {
    appointmentsCount: appointmentRows.length,
    receptionCount: receptionRows.length,
    usersCount: userRows.length,
  };
}

/**
 * IMPORT ALL DATA: Reads Appointments, Reception, Users, Settings from Google Sheets
 */
export async function importAllFromGoogleSheets(
  spreadsheetId: string
): Promise<{
  appointments: Appointment[];
  receptionEntries: ReceptionEntry[];
  userAccounts: UserAccount[];
  settings: Partial<SystemSettings>;
}> {
  const token = await getAccessToken();
  if (!token) throw new Error('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn');

  await ensureSpreadsheetStructure(spreadsheetId);

  // Batch read ranges
  const ranges = [
    `${SHEET_NAMES.APPOINTMENTS}!A2:Q1000`,
    `${SHEET_NAMES.RECEPTION}!A2:P1000`,
    `${SHEET_NAMES.USERS}!A2:L500`,
    `${SHEET_NAMES.CONFIG}!A2:C200`,
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join('&')}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Không thể đọc dữ liệu đồng bộ từ Google Sheets');
  }

  const batchData = await res.json();
  const valueRanges: any[] = batchData.valueRanges || [];

  const rawAppointments: any[][] = valueRanges[0]?.values || [];
  const rawReception: any[][] = valueRanges[1]?.values || [];
  const rawUsers: any[][] = valueRanges[2]?.values || [];
  const rawConfig: any[][] = valueRanges[3]?.values || [];

  // Parse Appointments
  const appointments: Appointment[] = rawAppointments
    .filter((r) => r[0] && r[3]) // Has id and plate
    .map((r, idx) => {
      const id = r[0] || `apt-import-${idx}`;
      const appointmentDate = r[1] || '2026-10-17';
      const appointmentTime = r[2] || '14:00';
      const licensePlate = String(r[3] || '').toUpperCase();
      const customerName = r[4] || 'KHÁCH HÀNG';
      const phoneNumber = r[5] || '';
      const bayName = r[6] || 'EM 01';
      const serviceTypes = r[7] ? String(r[7]).split(',').map((s) => s.trim()) : ['Bảo Dưỡng'];
      const content = r[8] || 'Bảo dưỡng';
      const advisorName = r[9] || 'Nguyễn Văn Toàn';
      const bookingStaff = r[10] || advisorName;
      const status = r[11] || 'Đã Xác Nhận';
      const priority = r[12] || 'Thường';
      const location = r[13] || 'Vũng Tàu';
      const durationMinutes = Number(r[14]) || 30;
      const cardColor = (r[15] as any) || 'purple';
      const bayId = r[16] || 'bay_bd_1';

      return {
        id,
        appointmentDate,
        appointmentTime,
        licensePlate,
        customerName,
        phoneNumber,
        bayId,
        bayName,
        serviceTypes,
        content,
        advisorName,
        bookingStaff,
        status: status as any,
        priority: priority as any,
        location,
        durationMinutes,
        cardColor,
        advisorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4',
      };
    });

  // Parse Reception Entries
  const receptionEntries: ReceptionEntry[] = rawReception
    .filter((r) => r[0] && r[1])
    .map((r, idx) => {
      const id = r[0] || `rec-import-${idx}`;
      const licensePlate = String(r[1] || '').toUpperCase();
      const hasAppointment = r[2] === 'Có' || r[2] === true || r[2] === 'true';
      const appointmentTime = r[3] || undefined;
      const cardTicketNumber = String(r[4] || '').trim();
      const cardSlotCode = String(r[5] || '0');
      const advisorName = r[6] || 'Vũ Hoàng Lộc';
      const serviceTypes = r[7] ? String(r[7]).split(',').map((s) => s.trim()) : ['Bảo Dưỡng'];
      const customerName = r[8] || 'KHÁCH HÀNG';
      const phoneNumber = r[9] || '';
      const checkInDate = r[10] || '2026-10-17';
      const checkInTime = r[11] || '08:00';
      const status = r[12] || 'Chờ Tiếp Nhận';
      const badgeType = (r[13] as any) || '';
      const notes = r[14] || '';
      const appointmentId = r[15] || undefined;

      return {
        id,
        licensePlate,
        hasAppointment,
        appointmentTime,
        cardTicketNumber,
        cardSlotCode,
        advisorName,
        serviceTypes,
        customerName,
        phoneNumber,
        checkInDate,
        checkInTime,
        status: status as any,
        badgeType,
        notes,
        appointmentId,
      };
    });

  // Parse User Accounts (Google Email Allowlist)
  const userAccounts: UserAccount[] = rawUsers
    .filter((r) => r[0] && (r[1] || r[8]))
    .map((r, idx) => {
      const candidateEmail = String(r[1] || '').includes('@')
        ? String(r[1]).trim().toLowerCase()
        : String(r[8] || '').trim().toLowerCase();
      const id = candidateEmail
        ? candidateEmail.replace(/[^a-z0-9]/g, '_')
        : r[0] || `usr_import_${idx}`;
      const employeeCode = String(r[1] || '').includes('@') ? String(r[2] || '') : '';
      const fullName = r[3] || 'Nhân Viên';
      const role = (r[4] as any) || 'le_tan';
      const roleTitle = r[5] || 'Nhân Viên';
      const assignedAdvisorName = r[6] || undefined;
      const phone = r[7] || '';
      const department = String(r[1] || '').includes('@') ? String(r[8] || '') : '';
      const isActive = r[9] !== 'Tạm khóa' && r[9] !== false && r[9] !== 'false';
      let permissions = null;
      try {
        if (r[10]) permissions = JSON.parse(r[10]);
      } catch (e) {}

      const createdAt = r[11] || '2026-01-01';

      return {
        id,
        email: candidateEmail,
        employeeCode,
        fullName,
        role,
        roleTitle,
        assignedAdvisorName,
        phone,
        department,
        isActive,
        createdAt,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(id)}&backgroundColor=b6e3f4`,
        permissions: permissions || {
          canAccessDatHen: true,
          canCreateAppointments: false,
          canEditAppointments: false,
          canDeleteAppointments: false,
          canAccessLeTan: true,
          canCheckInCars: true,
          canDeleteReception: false,
          canAccessCoVan: false,
          canUpdateVehicleStatus: false,
          canAccessSettings: false,
          canSyncSheets: false,
        },
      };
    })
    .filter((u) => Boolean(u.email));

  // Parse Settings
  const settings: Partial<SystemSettings> = {};
  rawConfig.forEach((row) => {
    const key = row[0];
    const val = row[1];
    if (key === 'workshopName') settings.workshopName = val;
    if (key === 'branchName') settings.branchName = val;
    if (key === 'phoneNumber') settings.phoneNumber = val;
    if (key === 'autoSyncInterval') settings.autoSyncInterval = Number(val) || 15;
  });

  return {
    appointments,
    receptionEntries,
    userAccounts,
    settings,
  };
}

// Backward-compatible individual functions
export async function exportAppointmentsToSheet(
  spreadsheetId: string,
  appointments: Appointment[],
  sheetName: string = SHEET_NAMES.APPOINTMENTS
): Promise<number> {
  const token = await getAccessToken();
  if (!token) throw new Error('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn');

  await ensureSpreadsheetStructure(spreadsheetId);

  const rows = appointments.map((apt) => [
    apt.id,
    apt.appointmentDate,
    apt.appointmentTime,
    apt.licensePlate,
    apt.customerName,
    apt.phoneNumber,
    apt.bayName || apt.bayId,
    apt.serviceTypes.join(', '),
    apt.content,
    apt.advisorName,
    apt.bookingStaff,
    apt.status,
    apt.priority,
    apt.location,
    apt.durationMinutes || 30,
    apt.cardColor || 'purple',
    apt.bayId,
  ]);

  await clearSheetRows(spreadsheetId, `${sheetName}!A2:Q1000`);
  await writeSheetValues(spreadsheetId, `${sheetName}!A1:Q${rows.length + 1}`, [APPOINTMENT_HEADERS, ...rows]);
  return rows.length;
}

export async function importAppointmentsFromSheet(
  spreadsheetId: string,
  sheetName: string = SHEET_NAMES.APPOINTMENTS
): Promise<Appointment[]> {
  const all = await importAllFromGoogleSheets(spreadsheetId);
  return all.appointments;
}

export async function createSpreadsheet(title: string = 'Lịch Đặt Hẹn Xưởng Dịch Vụ Ô Tô') {
  return createCompleteDatabaseSpreadsheet(title);
}
