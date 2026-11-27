import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Car,
  ShieldCheck,
  Lock,
  LogOut,
  Clock,
  CheckCircle2,
  Send,
  AlertCircle,
  CalendarDays,
  ClipboardList,
  UserCheck,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react';
import { AccessRequest, UserAccount } from '../types/appointment';
import { ThemeMode } from '../hooks/useTheme';

interface AuthGateProps {
  firebaseUser: User | null;
  authLoading: boolean;
  profileLoading: boolean;
  staffProfile: UserAccount | null;
  myAccessRequest: AccessRequest | null;
  authError: string | null;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSubmitAccessRequest: (
    requestedRole: 'le_tan' | 'co_van' | 'dat_hen',
    fullName: string,
    note: string
  ) => Promise<void>;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  firebaseUser,
  authLoading,
  profileLoading,
  staffProfile,
  myAccessRequest,
  authError,
  theme,
  onToggleTheme,
  onGoogleSignIn,
  onSignOut,
  onSubmitAccessRequest,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [requestedRole, setRequestedRole] = useState<'le_tan' | 'co_van' | 'dat_hen'>('le_tan');
  const [fullName, setFullName] = useState(firebaseUser?.displayName || '');
  const [note, setNote] = useState('');
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);
  const [reqFeedback, setReqFeedback] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSignInClick = async () => {
    setLocalError(null);
    setIsSigningIn(true);
    try {
      await onGoogleSignIn();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setLocalError(err?.message || 'Đăng nhập Google không thành công. Vui lòng thử lại.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setReqFeedback(null);
    setIsSubmittingReq(true);
    try {
      await onSubmitAccessRequest(
        requestedRole,
        fullName.trim() || firebaseUser?.displayName || 'Nhân viên mới',
        note.trim()
      );
      setReqFeedback('Đã gửi yêu cầu cấp quyền tới Quản Lý Xưởng.');
    } catch (err: any) {
      setLocalError(err?.message || 'Không thể gửi yêu cầu cấp quyền.');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const themeToggleBtn = (
    <button
      type="button"
      onClick={onToggleTheme}
      title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
      className="fixed top-4 right-4 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>Sáng</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-indigo-600" />
          <span>Tối</span>
        </>
      )}
    </button>
  );

  // Loading state
  if (authLoading || (firebaseUser && profileLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6 transition-colors duration-200">
        {themeToggleBtn}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/40 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Đang xác thực quyền truy cập...
          </p>
        </div>
      </div>
    );
  }

  // Case 1: Not signed in
  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 transition-colors duration-200">
        {themeToggleBtn}
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-2xl overflow-hidden">
          {/* Left Bento Panel */}
          <div className="lg:col-span-6 p-7 sm:p-8 bg-slate-50/70 dark:bg-[#0d1424] border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
                    Hãng Xe Auto Service
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Điều Phối Xưởng Dịch Vụ
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-300 font-bold text-xs mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Quản Lý</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Phân quyền, nhật ký & cấu hình
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300 font-bold text-xs mb-1">
                    <CalendarDays className="w-4 h-4" />
                    <span>Đặt Hẹn</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Xếp lịch khoang & xác nhận hẹn
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-300 font-bold text-xs mb-1">
                    <ClipboardList className="w-4 h-4" />
                    <span>Lễ Tân</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tra cứu hẹn, đón xe & chuyển CV
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300 font-bold text-xs mb-1">
                    <UserCheck className="w-4 h-4" />
                    <span>Cố Vấn</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tiếp nhận, tiến độ & giao xe
                  </p>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Xác thực Google & kiểm soát quyền theo tài khoản</span>
            </div>
          </div>

          {/* Right Panel: Sign-In */}
          <div className="lg:col-span-6 p-7 sm:p-8 flex flex-col justify-center space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Đăng Nhập Hệ Thống
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đăng nhập bằng tài khoản Google đã được Quản lý phê duyệt.
              </p>
            </div>

            {(authError || localError) && (
              <div className="p-3 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/40 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{localError || authError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignInClick}
              disabled={isSigningIn}
              className="w-full py-3 px-5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 disabled:opacity-60 text-white dark:text-slate-900 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-3 cursor-pointer"
            >
              {isSigningIn ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span>{isSigningIn ? 'Đang kết nối Google...' : 'Đăng nhập với Google'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Locked account
  if (staffProfile && !staffProfile.isActive) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 transition-colors duration-200">
        {themeToggleBtn}
        <div className="w-full max-w-md bg-white dark:bg-[#111827] border border-red-200 dark:border-red-500/40 rounded-2xl p-7 shadow-sm dark:shadow-2xl space-y-5 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/40 flex items-center justify-center text-red-600 dark:text-red-400">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Tài Khoản Đang Tạm Khóa
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tài khoản <strong>{staffProfile.fullName}</strong> ({staffProfile.email}) hiện đang tạm ngưng quyền truy cập.
            </p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất / Đổi tài khoản</span>
          </button>
        </div>
      </div>
    );
  }

  // Case 3: Pending Approval / Access Request
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 transition-colors duration-200">
      {themeToggleBtn}
      <div className="w-full max-w-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#161f30] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {firebaseUser.photoURL ? (
              <img
                src={firebaseUser.photoURL}
                alt={firebaseUser.displayName || 'User'}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-600/30 border border-blue-200 dark:border-blue-500/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold shrink-0">
                {(firebaseUser.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {firebaseUser.displayName || 'Tài khoản Google'}
              </div>
              <div className="text-xs font-mono text-blue-600 dark:text-blue-300 truncate">
                {firebaseUser.email}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {myAccessRequest && myAccessRequest.status === 'pending' ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 mx-auto rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Đang Chờ Quản Lý Phê Duyệt
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Hệ thống sẽ tự động mở khi Quản Lý duyệt email{' '}
                  <strong className="font-mono">{firebaseUser.email}</strong>.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Họ tên:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {myAccessRequest.fullName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Vị trí:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-300">
                    {myAccessRequest.requestedRole === 'le_tan'
                      ? 'Lễ Tân'
                      : myAccessRequest.requestedRole === 'co_van'
                      ? 'Cố Vấn Dịch Vụ'
                      : 'Đặt Hẹn'}
                  </span>
                </div>
                {myAccessRequest.note && (
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                    Ghi chú: <span className="text-slate-800 dark:text-slate-200">{myAccessRequest.note}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-bold">Email chưa được cấp quyền</p>
                  <p className="mt-0.5 opacity-90">
                    Gửi thông tin vị trí công tác để Quản Lý kích hoạt tài khoản.
                  </p>
                </div>
              </div>

              {(localError || authError) && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs">
                  {localError || authError}
                </div>
              )}

              {reqFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{reqFeedback}</span>
                </div>
              )}

              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Nguyễn Thị Mai"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Vị trí công tác
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'le_tan', label: 'Lễ Tân' },
                      { id: 'co_van', label: 'Cố Vấn DV' },
                      { id: 'dat_hen', label: 'Đặt Hẹn' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRequestedRole(r.id as any)}
                        className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                          requestedRole === r.id
                            ? 'bg-blue-50 dark:bg-blue-600/25 border-blue-500 text-blue-700 dark:text-white'
                            : 'bg-slate-50 dark:bg-[#161f30] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Ghi chú (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="VD: Tổ lễ tân ca sáng..."
                    maxLength={250}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingReq}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmittingReq ? 'Đang gửi...' : 'Gửi Yêu Cầu Cấp Quyền'}</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
