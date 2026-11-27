import React, { useState } from 'react';
import {
  AccessRequest,
  AuditLogEntry,
  GoogleSheetsConfig,
  SystemSettings,
  UserAccount,
  UserPermissions,
  UserRole,
} from '../types/appointment';
import { DEFAULT_ROLE_PERMISSIONS } from '../data/mockData';
import { BOOTSTRAPPED_ADMIN_EMAIL, emailToStaffId } from '../services/firebaseAuth';
import {
  Users,
  UserPlus,
  Shield,
  Edit3,
  Trash2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Search,
  Settings,
  Mail,
  Phone,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Database,
  Radio,
  Clock,
  History,
  UserCheck,
  Building2,
} from 'lucide-react';

interface SettingsTabProps {
  currentUser: UserAccount;
  userAccounts: UserAccount[];
  accessRequests: AccessRequest[];
  auditLogs: AuditLogEntry[];
  sheetsConfig: GoogleSheetsConfig;
  systemSettings: SystemSettings;
  onSaveStaffAccount: (account: UserAccount, approvingRequestId?: string) => Promise<void>;
  onDeleteStaffAccount: (staffId: string, label: string) => Promise<void>;
  onRejectAccessRequest: (requestId: string) => Promise<void>;
  onUpdateSheetsConfig: (config: GoogleSheetsConfig) => void;
  onOpenSheetsModal: () => void;
  onTriggerSyncNow: () => Promise<void>;
  onUpdateSystemSettings: (settings: SystemSettings) => Promise<void>;
  onSeedSampleData?: () => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  userAccounts,
  accessRequests,
  auditLogs,
  sheetsConfig,
  systemSettings,
  onSaveStaffAccount,
  onDeleteStaffAccount,
  onRejectAccessRequest,
  onUpdateSheetsConfig,
  onOpenSheetsModal,
  onTriggerSyncNow,
  onUpdateSystemSettings,
  onSeedSampleData,
}) => {
  const [subTab, setSubTab] = useState<'staff' | 'audit' | 'storage'>('staff');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [approvingRequestId, setApprovingRequestId] = useState<string | undefined>(undefined);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);

  const [workshopName, setWorkshopName] = useState(systemSettings.workshopName);
  const [branchName, setBranchName] = useState(systemSettings.branchName);
  const [hotline, setHotline] = useState(systemSettings.phoneNumber);
  const [address, setAddress] = useState(systemSettings.address);

  const [formEmail, setFormEmail] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formEmployeeCode, setFormEmployeeCode] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('le_tan');
  const [formRoleTitle, setFormRoleTitle] = useState('Lễ Tân Tiếp Nhận');
  const [formPhone, setFormPhone] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formAvatar, setFormAvatar] = useState('');
  const [formPermissions, setFormPermissions] = useState<UserPermissions>({
    ...DEFAULT_ROLE_PERMISSIONS.le_tan,
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'quan_ly':
        return {
          label: 'Quản Lý Xưởng',
          badgeClass:
            'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40',
        };
      case 'le_tan':
        return {
          label: 'Lễ Tân',
          badgeClass:
            'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/40',
        };
      case 'co_van':
        return {
          label: 'Cố Vấn Dịch Vụ',
          badgeClass:
            'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/40',
        };
      case 'dat_hen':
        return {
          label: 'Điều Phối Đặt Hẹn',
          badgeClass:
            'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40',
        };
      default:
        return {
          label: 'Nhân Viên',
          badgeClass:
            'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600',
        };
    }
  };

  const applyRolePreset = (newRole: UserRole) => {
    setFormRole(newRole);
    if (newRole === 'quan_ly') {
      setFormRoleTitle('Quản Lý Xưởng Dịch Vụ');
      setFormDepartment('Ban Quản Lý');
    } else if (newRole === 'le_tan') {
      setFormRoleTitle('Lễ Tân Tiếp Nhận');
      setFormDepartment('Tổ Lễ Tân');
    } else if (newRole === 'co_van') {
      setFormRoleTitle('Cố Vấn Dịch Vụ');
      setFormDepartment('Phòng Cố Vấn Dịch Vụ');
    } else if (newRole === 'dat_hen') {
      setFormRoleTitle('Nhân Viên Điều Phối Đặt Hẹn');
      setFormDepartment('CSKH & Đặt Hẹn');
    }
    setFormPermissions({ ...DEFAULT_ROLE_PERMISSIONS[newRole] });
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setApprovingRequestId(undefined);
    setFormEmail('');
    setFormFullName('');
    setFormEmployeeCode('');
    setFormDepartment('Tổ Lễ Tân');
    setFormRole('le_tan');
    setFormRoleTitle('Lễ Tân Tiếp Nhận');
    setFormPhone('');
    setFormAvatar('');
    setFormIsActive(true);
    setFormPermissions({ ...DEFAULT_ROLE_PERMISSIONS.le_tan });
    setIsModalOpen(true);
  };

  const openApproveRequestModal = (req: AccessRequest) => {
    setEditingUser(null);
    setApprovingRequestId(req.id);
    setFormEmail(req.email);
    setFormFullName(req.fullName);
    setFormEmployeeCode('');
    setFormPhone('');
    setFormAvatar(req.avatar || '');
    setFormIsActive(true);
    applyRolePreset(req.requestedRole);
    setIsModalOpen(true);
  };

  const openEditModal = (account: UserAccount) => {
    setEditingUser(account);
    setApprovingRequestId(undefined);
    setFormEmail(account.email);
    setFormFullName(account.fullName);
    setFormEmployeeCode(account.employeeCode || '');
    setFormDepartment(account.department || '');
    setFormRole(account.role);
    setFormRoleTitle(account.roleTitle);
    setFormPhone(account.phone || '');
    setFormAvatar(account.avatar || '');
    setFormIsActive(account.isActive);
    setFormPermissions({ ...account.permissions });
    setIsModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);

    const normalizedEmail = formEmail.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFeedbackMessage({ type: 'error', text: 'Vui lòng nhập địa chỉ Email Google hợp lệ!' });
      return;
    }
    if (!formFullName.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Vui lòng nhập họ và tên nhân viên!' });
      return;
    }

    const staffId = emailToStaffId(normalizedEmail);
    const accountData: UserAccount = {
      id: staffId,
      email: normalizedEmail,
      fullName: formFullName.trim(),
      employeeCode: formEmployeeCode.trim().toUpperCase(),
      department: formDepartment.trim(),
      role: formRole,
      roleTitle: formRoleTitle.trim() || getRoleBadge(formRole).label,
      avatar:
        formAvatar ||
        editingUser?.avatar ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(staffId)}&backgroundColor=b6e3f4`,
      phone: formPhone.trim(),
      uid: editingUser?.uid,
      isActive: formIsActive,
      createdAt: editingUser?.createdAt || new Date().toISOString().split('T')[0],
      lastLoginAt: editingUser?.lastLoginAt,
      approvedBy: currentUser.email,
      permissions: { ...formPermissions },
    };

    setIsSaving(true);
    try {
      await onSaveStaffAccount(accountData, approvingRequestId);
      setFeedbackMessage({
        type: 'success',
        text: approvingRequestId
          ? `Đã phê duyệt & cấp quyền cho "${accountData.fullName}" (${normalizedEmail})!`
          : editingUser
          ? `Đã cập nhật phân quyền cho "${accountData.fullName}"!`
          : `Đã thêm email "${normalizedEmail}" vào danh sách nhân sự!`,
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Không thể lưu tài khoản nhân sự.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (account: UserAccount) => {
    if (account.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
      setFeedbackMessage({ type: 'error', text: 'Không thể khóa tài khoản Quản Lý gốc!' });
      return;
    }
    if (account.id === currentUser.id) {
      setFeedbackMessage({ type: 'error', text: 'Không thể tự tạm khóa tài khoản đang đăng nhập!' });
      return;
    }

    try {
      await onSaveStaffAccount({ ...account, isActive: !account.isActive });
      setFeedbackMessage({
        type: 'success',
        text: !account.isActive
          ? `Đã mở khóa tài khoản "${account.fullName}".`
          : `Đã tạm khóa tài khoản "${account.fullName}".`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Lỗi khi cập nhật trạng thái.' });
    }
  };

  const handleDeleteAccount = async (account: UserAccount) => {
    if (account.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL || account.id === currentUser.id) {
      setFeedbackMessage({ type: 'error', text: 'Không thể xóa tài khoản Quản Lý gốc hoặc chính mình!' });
      return;
    }
    try {
      await onDeleteStaffAccount(account.id, `${account.fullName} (${account.email})`);
      setFeedbackMessage({ type: 'success', text: `Đã xóa tài khoản "${account.fullName}".` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Lỗi khi xóa tài khoản.' });
    }
  };

  const handleManualPush = async () => {
    setIsSyncingNow(true);
    try {
      await onTriggerSyncNow();
      setFeedbackMessage({
        type: 'success',
        text: 'Đã hoàn tất sao lưu đồng bộ lên Google Sheets!',
      });
    } catch (e: any) {
      setFeedbackMessage({ type: 'error', text: e.message || 'Lỗi khi đồng bộ lên Google Sheets' });
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleSaveWorkshopSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateSystemSettings({
        ...systemSettings,
        workshopName: workshopName.trim() || 'Hãng Xe Auto Service',
        branchName: branchName.trim() || 'Vũng Tàu',
        phoneNumber: hotline.trim(),
        address: address.trim(),
      });
      setFeedbackMessage({ type: 'success', text: 'Đã lưu cấu hình xưởng dịch vụ!' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Lỗi lưu cấu hình xưởng.' });
    }
  };

  const filteredAccounts = userAccounts.filter((acc) => {
    if (roleFilter !== 'all' && acc.role !== roleFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        acc.fullName.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        (acc.employeeCode || '').toLowerCase().includes(q) ||
        acc.roleTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const permissionItems: { key: keyof UserPermissions; label: string; group: string }[] = [
    { key: 'canAccessDatHen', label: 'Truy cập tab Đặt Hẹn', group: 'Đặt Hẹn' },
    { key: 'canCreateAppointments', label: 'Tạo lịch đặt hẹn mới', group: 'Đặt Hẹn' },
    { key: 'canEditAppointments', label: 'Chỉnh sửa toàn bộ phiếu hẹn', group: 'Đặt Hẹn' },
    { key: 'canDeleteAppointments', label: 'Xóa phiếu hẹn', group: 'Đặt Hẹn' },
    { key: 'canAccessLeTan', label: 'Truy cập tab Lễ Tân', group: 'Lễ Tân' },
    { key: 'canCheckInCars', label: 'Tiếp nhận xe vào xưởng & cấp thẻ', group: 'Lễ Tân' },
    { key: 'canDeleteReception', label: 'Xóa lượt tiếp nhận xe', group: 'Lễ Tân' },
    { key: 'canAccessCoVan', label: 'Truy cập tab Cố Vấn Dịch Vụ', group: 'Cố Vấn' },
    { key: 'canUpdateVehicleStatus', label: 'Cập nhật trạng thái xe được phân công', group: 'Cố Vấn' },
    { key: 'canSyncSheets', label: 'Đồng bộ / xuất báo cáo Google Sheets', group: 'Hệ Thống' },
    { key: 'canAccessSettings', label: 'Quản trị Nhân Sự & Cài Đặt (Admin)', group: 'Hệ Thống' },
  ];

  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'Chưa đăng nhập';
    try {
      const d = new Date(iso);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-slate-50 dark:bg-[#1a2538] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-60';

  return (
    <div className="space-y-4">
      {/* Header & Sub-Navigation */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Settings className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Quản Trị Nhân Sự &amp; Hệ Thống
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(currentUser.role === 'quan_ly' || currentUser.permissions.canSyncSheets) && (
            <button
              type="button"
              onClick={onOpenSheetsModal}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                sheetsConfig.syncStatus === 'syncing'
                  ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-200'
                  : sheetsConfig.isAutoSyncEnabled && sheetsConfig.spreadsheetId
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-500/20'
                  : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-[#161f30] dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200'
              }`}
            >
              <FileSpreadsheet
                className={`w-3.5 h-3.5 ${
                  sheetsConfig.syncStatus === 'syncing'
                    ? 'text-blue-600 dark:text-blue-400 animate-spin'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              <span>{sheetsConfig.spreadsheetId ? 'Google Sheets' : 'Kết nối Sheets'}</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0b1120] p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSubTab('staff')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                subTab === 'staff'
                  ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Nhân Sự ({userAccounts.length})</span>
              {accessRequests.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-mono font-bold leading-none">
                  +{accessRequests.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSubTab('audit')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                subTab === 'audit'
                  ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Nhật Ký ({auditLogs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('storage')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                subTab === 'storage'
                  ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Cấu Hình &amp; Sheets</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUB-TAB 1: STAFF DIRECTORY & ACCESS REQUESTS */}
      {subTab === 'staff' && (
        <div className="space-y-4">
          {accessRequests.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                <Clock className="w-4 h-4" />
                <span>Yêu Cầu Cấp Quyền Chờ Duyệt ({accessRequests.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {accessRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#0e1627] border border-amber-200 dark:border-amber-500/30 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <img
                        src={
                          req.avatar ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.id)}`
                        }
                        alt={req.fullName}
                        className="w-9 h-9 rounded-full border border-amber-300 dark:border-amber-500/40 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {req.fullName}
                        </div>
                        <div className="text-[11px] font-mono text-amber-700 dark:text-amber-300 truncate">
                          {req.email}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          Đề xuất:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {getRoleBadge(req.requestedRole).label}
                          </strong>
                          {req.note ? ` • ${req.note}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openApproveRequestModal(req)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Duyệt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectAccessRequest(req.id)}
                        className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-300 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                        title="Từ chối yêu cầu"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Toolbar & Table */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5 flex-wrap flex-1">
                <div className="relative min-w-[220px] flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên, email Google, mã NV..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#172235] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#141e30] p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'quan_ly', label: 'Quản Lý' },
                    { id: 'dat_hen', label: 'Đặt Hẹn' },
                    { id: 'le_tan', label: 'Lễ Tân' },
                    { id: 'co_van', label: 'Cố Vấn' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setRoleFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        roleFilter === f.id
                          ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Thêm Email Nhân Viên</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-[#141f33] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Nhân Viên &amp; Email Google</th>
                    <th className="py-3 px-4">Cấp Bậc / Vị Trí</th>
                    <th className="py-3 px-4">Phạm Vi &amp; Quyền Hạn</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                    <th className="py-3 px-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                        Chưa có tài khoản nhân viên phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => {
                      const badge = getRoleBadge(acc.role);
                      const isPrimaryOwner = acc.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
                      const isSelf = acc.id === currentUser.id;
                      const enabledPermsCount = Object.values(acc.permissions).filter(Boolean).length;

                      return (
                        <tr
                          key={acc.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={acc.avatar}
                                alt={acc.fullName}
                                className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-white/10 shrink-0 object-cover"
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{acc.fullName}</span>
                                  {acc.employeeCode && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                                      {acc.employeeCode}
                                    </span>
                                  )}
                                  {isPrimaryOwner && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[10px]">
                                      Chủ hệ thống
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-blue-600 dark:text-blue-300 flex items-center gap-1 mt-0.5">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{acc.email}</span>
                                </div>
                                {acc.phone && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5" />
                                    <span>{acc.phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${badge.badgeClass}`}
                            >
                              {badge.label}
                            </span>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {acc.roleTitle}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {acc.permissions.canAccessDatHen && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                                  Đặt Hẹn
                                </span>
                              )}
                              {acc.permissions.canAccessLeTan && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                                  Lễ Tân
                                </span>
                              )}
                              {acc.permissions.canAccessCoVan && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                                  Cố Vấn
                                </span>
                              )}
                              {acc.permissions.canSyncSheets && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px]">
                                  Sheets
                                </span>
                              )}
                              {acc.permissions.canAccessSettings && (
                                <span className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 text-[10px]">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              {enabledPermsCount}/11 quyền
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  acc.isActive ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                              />
                              <span
                                className={`font-semibold ${
                                  acc.isActive
                                    ? 'text-emerald-700 dark:text-emerald-300'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {acc.isActive ? 'Hoạt động' : 'Tạm khóa'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                              {acc.uid ? formatTimestamp(acc.lastLoginAt) : 'Chưa đăng nhập'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(acc)}
                                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-600/20 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Phân quyền</span>
                              </button>

                              {!isPrimaryOwner && !isSelf && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleActive(acc)}
                                    title={acc.isActive ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản'}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      acc.isActive
                                        ? 'bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-slate-200 dark:border-slate-700'
                                        : 'bg-emerald-50 dark:bg-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40'
                                    }`}
                                  >
                                    {acc.isActive ? (
                                      <Lock className="w-3.5 h-3.5" />
                                    ) : (
                                      <Unlock className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAccount(acc)}
                                    title="Xóa tài khoản"
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
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
      )}

      {/* SUB-TAB 2: AUDIT LOG */}
      {subTab === 'audit' && (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Nhật Ký Hoạt Động</span>
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              60 thao tác gần nhất
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800/70 max-h-[540px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                Chưa có nhật ký hoạt động nào.
              </div>
            ) : (
              auditLogs.map((log) => {
                const badge = getRoleBadge(log.actorRole);
                return (
                  <div
                    key={log.id}
                    className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {log.summary}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {log.actorName}
                        </span>
                        <span className="font-mono text-blue-600 dark:text-blue-300">
                          ({log.actorEmail})
                        </span>
                        <span className={`px-1.5 py-0.2 rounded border text-[10px] ${badge.badgeClass}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      {formatTimestamp(log.createdAt)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CLOUD FIRESTORE & GOOGLE SHEETS CONFIG */}
      {subTab === 'storage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cloud Firestore &amp; Google Sheets
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold">
                <Radio className="w-3 h-3" />
                Firestore Live
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Google Sheets:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {sheetsConfig.spreadsheetId ? 'Đã liên kết' : 'Chưa liên kết'}
                </span>
              </div>
              {sheetsConfig.lastSyncedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Đồng bộ gần nhất:</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-300">
                    {sheetsConfig.lastSyncedAt}
                  </span>
                </div>
              )}
              {sheetsConfig.spreadsheetUrl && (
                <a
                  href={sheetsConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-semibold pt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở file Google Sheets</span>
                </a>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Chu kỳ tự động đồng bộ:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {[10, 15, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() =>
                      onUpdateSheetsConfig({ ...sheetsConfig, syncIntervalSeconds: sec })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      sheetsConfig.syncIntervalSeconds === sec
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 dark:bg-[#1a2538] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {sec} giây
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onOpenSheetsModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{sheetsConfig.spreadsheetId ? 'Cấu Hình Google Sheets' : 'Kết Nối Google Sheets'}</span>
              </button>

              {sheetsConfig.spreadsheetId && (
                <button
                  type="button"
                  onClick={handleManualPush}
                  disabled={isSyncingNow}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                  <span>{isSyncingNow ? 'Đang xuất...' : 'Đẩy Lên Sheets Ngay'}</span>
                </button>
              )}

              {onSeedSampleData && (
                <button
                  type="button"
                  onClick={onSeedSampleData}
                  className="px-4 py-2 bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Nạp Dữ Liệu Mẫu
                </button>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSaveWorkshopSettings}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Thông Số Xưởng Dịch Vụ
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tên Xưởng Dịch Vụ
                </label>
                <input
                  type="text"
                  value={workshopName}
                  onChange={(e) => setWorkshopName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Chi Nhánh
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Hotline
                </label>
                <input
                  type="text"
                  value={hotline}
                  onChange={(e) => setHotline(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Địa Chỉ
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                Lưu Thông Số Xưởng
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD / EDIT / APPROVE STAFF MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-50 dark:bg-[#162032] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {approvingRequestId
                    ? 'Phê Duyệt Nhân Viên Mới'
                    : editingUser
                    ? `Phân Quyền — ${editingUser.fullName}`
                    : 'Thêm Email Nhân Viên'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveAccount}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Email Google <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingUser)}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="VD: nhanvien.letan@gmail.com"
                    className={`${inputClass} font-mono py-2.5`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Họ Và Tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="VD: Nguyễn Thị Mai"
                    className={`${inputClass} py-2.5`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Mã Nhân Viên
                  </label>
                  <input
                    type="text"
                    value={formEmployeeCode}
                    onChange={(e) => setFormEmployeeCode(e.target.value.toUpperCase())}
                    placeholder="VD: LT-001"
                    className={`${inputClass} font-mono py-2.5`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Số Điện Thoại
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="090xxxxxxx"
                    className={`${inputClass} font-mono py-2.5`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Bộ Phận
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="Tổ Lễ Tân / Cố Vấn..."
                    className={`${inputClass} py-2.5`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Cấp Bậc / Vị Trí
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => applyRolePreset(e.target.value as UserRole)}
                    className={`${inputClass} py-2.5`}
                  >
                    <option value="quan_ly">Cấp 1 — Quản Lý Xưởng (Admin)</option>
                    <option value="dat_hen">Cấp 2 — Nhân Viên Đặt Hẹn</option>
                    <option value="le_tan">Cấp 3 — Lễ Tân Tiếp Nhận</option>
                    <option value="co_van">Cấp 4 — Cố Vấn Dịch Vụ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Chức Danh Hiển Thị
                  </label>
                  <input
                    type="text"
                    value={formRoleTitle}
                    onChange={(e) => setFormRoleTitle(e.target.value)}
                    className={`${inputClass} py-2.5`}
                  />
                </div>
              </div>

              {/* Granular Permissions Matrix */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Quyền Chức Năng
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {permissionItems.map((item) => {
                    const checked = formPermissions[item.key];
                    return (
                      <label
                        key={item.key}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-blue-50 dark:bg-blue-600/15 border-blue-200 dark:border-blue-500/40 text-slate-900 dark:text-white'
                            : 'bg-slate-50 dark:bg-[#151f31] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setFormPermissions((prev) => ({
                              ...prev,
                              [item.key]: e.target.checked,
                            }))
                          }
                          className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="leading-tight">
                          <div className="font-semibold">{item.label}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {item.group}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Trạng thái truy cập
                </div>
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                    formIsActive
                      ? 'bg-emerald-600 text-white'
                      : 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/40'
                  }`}
                >
                  {formIsActive ? <Check className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{formIsActive ? 'Hoạt động' : 'Tạm khóa'}</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  {isSaving
                    ? 'Đang lưu...'
                    : approvingRequestId
                    ? 'Phê Duyệt & Cấp Quyền'
                    : 'Lưu Phân Quyền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
