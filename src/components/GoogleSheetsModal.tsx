import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Check,
  AlertCircle,
  PlusCircle,
  Download,
  Upload,
  ShieldCheck,
  Layers,
  Radio,
  Database,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Appointment, GoogleSheetsConfig, ReceptionEntry, UserAccount } from '../types/appointment';
import {
  createCompleteDatabaseSpreadsheet,
  exportAllToGoogleSheets,
  importAllFromGoogleSheets,
} from '../services/googleSheets';
import { googleSignIn } from '../services/firebaseAuth';
import { ConfirmDialog } from './ConfirmDialog';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  user: User | null;
  config: GoogleSheetsConfig;
  appointments: Appointment[];
  receptionEntries: ReceptionEntry[];
  userAccounts: UserAccount[];
  onClose: () => void;
  onUpdateConfig: (config: GoogleSheetsConfig) => void;
  onDataImported: (data: {
    appointments: Appointment[];
    receptionEntries: ReceptionEntry[];
    userAccounts: UserAccount[];
  }) => void;
  onTriggerRealtimePush?: () => Promise<void>;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  user,
  config,
  appointments,
  receptionEntries,
  userAccounts,
  onClose,
  onUpdateConfig,
  onDataImported,
}) => {
  const [spreadsheetInput, setSpreadsheetInput] = useState(config.spreadsheetId || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
  });

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsProcessing(true);
    setMessage(null);
    try {
      await googleSignIn();
      setMessage({ type: 'success', text: 'Đăng nhập Google thành công!' });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Đăng nhập thất bại. Vui lòng thử lại.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const parseSpreadsheetId = (input: string) => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  };

  const handleCreateNewDatabase = async () => {
    if (!user) {
      setMessage({ type: 'error', text: 'Vui lòng đăng nhập Google trước khi tạo bảng tính.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await createCompleteDatabaseSpreadsheet(`CSDL Xưởng Dịch Vụ Ô Tô - ${today}`);
      const newConfig: GoogleSheetsConfig = {
        ...config,
        spreadsheetId: result.id,
        spreadsheetUrl: result.url,
        sheetTitle: `CSDL Xưởng Dịch Vụ Ô Tô - ${today}`,
      };
      onUpdateConfig(newConfig);
      setSpreadsheetInput(result.id);

      await exportAllToGoogleSheets(result.id, {
        appointments,
        receptionEntries,
        userAccounts,
      });

      setMessage({
        type: 'success',
        text: 'Đã khởi tạo bảng tính Google Sheets (4 sheet) và nạp dữ liệu thành công!',
      });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Không thể tạo bảng tính mới.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConnectExistingSheet = async () => {
    const id = parseSpreadsheetId(spreadsheetInput);
    if (!id) {
      setMessage({ type: 'error', text: 'Vui lòng nhập ID hoặc link Google Sheets hợp lệ' });
      return;
    }
    const newConfig: GoogleSheetsConfig = {
      ...config,
      spreadsheetId: id,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}/edit`,
    };
    onUpdateConfig(newConfig);
    setMessage({ type: 'success', text: 'Đã liên kết bảng tính Google Sheets thành công!' });
  };

  const toggleAutoSync = () => {
    const updated = !config.isAutoSyncEnabled;
    onUpdateConfig({
      ...config,
      isAutoSyncEnabled: updated,
    });
    setMessage({
      type: 'success',
      text: updated
        ? `Đã bật đồng bộ tự động mỗi ${config.syncIntervalSeconds || 15} giây.`
        : 'Đã tạm tắt tự động đồng bộ.',
    });
  };

  const handleIntervalChange = (seconds: number) => {
    onUpdateConfig({
      ...config,
      syncIntervalSeconds: seconds,
    });
  };

  const triggerExportWithConfirm = () => {
    const targetId = parseSpreadsheetId(spreadsheetInput) || config.spreadsheetId;
    if (!targetId) {
      setMessage({ type: 'error', text: 'Vui lòng tạo hoặc liên kết một Google Sheet trước khi đồng bộ.' });
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Đồng Bộ Lên Google Sheets',
      message: `Đồng bộ ${appointments.length} lịch hẹn, ${receptionEntries.length} xe tiếp nhận và ${userAccounts.length} tài khoản lên Google Sheet?`,
      isDestructive: false,
      action: async () => {
        setIsProcessing(true);
        setMessage(null);
        try {
          const stats = await exportAllToGoogleSheets(targetId, {
            appointments,
            receptionEntries,
            userAccounts,
          });
          const nowStr =
            new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN');
          onUpdateConfig({
            ...config,
            spreadsheetId: targetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${targetId}/edit`,
            lastSyncedAt: nowStr,
            syncStatus: 'success',
          });
          setMessage({
            type: 'success',
            text: `Đã đồng bộ ${stats.appointmentsCount} lịch hẹn, ${stats.receptionCount} xe tiếp nhận, ${stats.usersCount} tài khoản lúc ${nowStr}.`,
          });
        } catch (err: any) {
          console.error(err);
          setMessage({ type: 'error', text: err.message || 'Lỗi khi đồng bộ lên Google Sheets.' });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const triggerImportWithConfirm = () => {
    const targetId = parseSpreadsheetId(spreadsheetInput) || config.spreadsheetId;
    if (!targetId) {
      setMessage({ type: 'error', text: 'Vui lòng tạo hoặc liên kết một Google Sheet trước khi tải.' });
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Nhập Dữ Liệu Từ Google Sheets',
      message:
        'Tải toàn bộ Lịch hẹn, Tiếp nhận lễ tân và Tài khoản từ Google Sheets về ứng dụng?',
      isDestructive: false,
      action: async () => {
        setIsProcessing(true);
        setMessage(null);
        try {
          const imported = await importAllFromGoogleSheets(targetId);
          onDataImported({
            appointments: imported.appointments,
            receptionEntries: imported.receptionEntries,
            userAccounts: imported.userAccounts.length > 0 ? imported.userAccounts : userAccounts,
          });
          const nowStr =
            new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN');
          onUpdateConfig({
            ...config,
            spreadsheetId: targetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${targetId}/edit`,
            lastSyncedAt: nowStr,
            syncStatus: 'success',
          });
          setMessage({
            type: 'success',
            text: `Đã nạp ${imported.appointments.length} lịch hẹn, ${imported.receptionEntries.length} xe tiếp nhận, ${imported.userAccounts.length} tài khoản.`,
          });
        } catch (err: any) {
          console.error(err);
          setMessage({ type: 'error', text: err.message || 'Lỗi khi đọc từ Google Sheets.' });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm overflow-y-auto">
        <div className="w-full max-w-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden my-8">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#162032]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-500/30">
                <Database className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Google Sheets Đồng Bộ</span>
                {config.isAutoSyncEnabled && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Tự động
                  </span>
                )}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {message && (
              <div
                className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 border ${
                  message.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300'
                }`}
              >
                {message.type === 'success' ? (
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span className="font-medium">{message.text}</span>
              </div>
            )}

            {/* 4-Sheet Structure */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-2 uppercase tracking-wider">
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>4 Sheet Dữ Liệu</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#152033] border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-purple-700 dark:text-purple-300 font-mono">1. LichDatHen</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{appointments.length} lịch hẹn</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#152033] border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-blue-700 dark:text-blue-300 font-mono">2. TiepNhanLeTan</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{receptionEntries.length} xe tiếp nhận</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#152033] border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">3. TaiKhoan</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{userAccounts.length} tài khoản</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#152033] border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-amber-700 dark:text-amber-300 font-mono">4. CauHinh</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Thông số xưởng</div>
                </div>
              </div>
            </div>

            {/* Google Authentication */}
            <div className="p-4 bg-slate-50 dark:bg-[#1a2538] border border-slate-200 dark:border-slate-700/80 rounded-xl">
              <div className="flex items-center justify-between flex-wrap gap-3">
                {user ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'}
                      alt={user.displayName || 'User'}
                      className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-600"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">
                          {user.displayName || 'Tài khoản Google'}
                        </span>
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Chưa kết nối Google Drive
                    </h3>
                  </div>
                )}

                {user ? (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isProcessing ? 'Đang cấp quyền...' : 'Cấp / Làm mới quyền Sheets'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-lg shadow-xs transition-colors border border-slate-300 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isProcessing ? 'Đang kết nối...' : 'Đăng nhập Google'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Auto Sync */}
            <div className="p-4 bg-slate-50 dark:bg-[#141e30] border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Radio
                    className={`w-4 h-4 ${
                      config.isAutoSyncEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Đồng Bộ Tự Động
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={toggleAutoSync}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    config.isAutoSyncEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {config.isAutoSyncEnabled ? 'ĐANG BẬT ✓' : 'TẠM TẮT'}
                </button>
              </div>

              {config.isAutoSyncEnabled && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Chu kỳ:</span>
                  {[10, 15, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleIntervalChange(sec)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        (config.syncIntervalSeconds || 15) === sec
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {sec} giây
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Create or Connect Spreadsheet */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Bảng Tính Google Sheets
                </h4>
                <button
                  type="button"
                  onClick={handleCreateNewDatabase}
                  disabled={!user || isProcessing}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  Khởi Tạo Sheet Mới
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Hoặc Liên Kết ID / Link Có Sẵn
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={spreadsheetInput}
                    onChange={(e) => setSpreadsheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    className="flex-1 px-3 py-2 bg-white dark:bg-[#1a2538] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs font-mono placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleConnectExistingSheet}
                    className="px-3.5 py-2 text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-lg border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    Lưu
                  </button>
                </div>
                {config.spreadsheetUrl && (
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Sheet ID:{' '}
                      <strong className="text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                        {config.spreadsheetId}
                      </strong>
                    </span>
                    <a
                      href={config.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      <span>Mở Google Sheets</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Manual Sync Actions */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={triggerExportWithConfirm}
                disabled={!user || isProcessing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                <span>Đẩy Lên Sheets (Push)</span>
              </button>

              <button
                type="button"
                onClick={triggerImportWithConfirm}
                disabled={!user || isProcessing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span>Tải Từ Sheets Về (Pull)</span>
              </button>
            </div>

            {config.lastSyncedAt && (
              <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-1">
                Đồng bộ gần nhất:{' '}
                <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                  {config.lastSyncedAt}
                </strong>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
        onConfirm={async () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          await confirmState.action();
        }}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};
