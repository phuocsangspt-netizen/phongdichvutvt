import React from 'react';
import {
  Car,
  Search,
  LayoutGrid,
  ListFilter,
  Users,
  CalendarDays,
  ClipboardList,
  Settings,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  Appointment,
  ServiceAdvisor,
  UserAccount,
  UserRole,
  SystemSettings,
} from '../types/appointment';
import { ThemeMode } from '../hooks/useTheme';

interface HeaderProps {
  user: User | null;
  currentUser: UserAccount;
  systemSettings: SystemSettings;
  appointments: Appointment[];
  advisors: ServiceAdvisor[];
  selectedDate: string;
  viewMode: 'timeline' | 'table';
  activeMainTab: 'dat_hen' | 'le_tan' | 'co_van' | 'cai_dat';
  waitingReceptionCount: number;
  advisorRequestsCount?: number;
  advisorReceivingCount?: number;
  pendingRequestsCount: number;
  searchQuery: string;
  selectedAdvisorFilter: string;
  selectedStatusFilter: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onTabChange: (tab: 'dat_hen' | 'le_tan' | 'co_van' | 'cai_dat') => void;
  onSignOut: () => void;
  onToggleViewMode: (mode: 'timeline' | 'table') => void;
  onSearchChange: (query: string) => void;
  onAdvisorFilterChange: (advisor: string) => void;
  onStatusFilterChange: (status: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  systemSettings,
  advisors,
  viewMode,
  activeMainTab,
  waitingReceptionCount,
  advisorRequestsCount = 0,
  advisorReceivingCount = 0,
  pendingRequestsCount,
  searchQuery,
  selectedAdvisorFilter,
  selectedStatusFilter,
  theme,
  onToggleTheme,
  onTabChange,
  onSignOut,
  onToggleViewMode,
  onSearchChange,
  onAdvisorFilterChange,
  onStatusFilterChange,
}) => {
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'quan_ly':
        return {
          label: 'Quản Lý',
          badgeClass:
            'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/35',
        };
      case 'le_tan':
        return {
          label: 'Lễ Tân',
          badgeClass:
            'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/35',
        };
      case 'co_van':
        return {
          label: 'Cố Vấn',
          badgeClass:
            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/35',
        };
      case 'dat_hen':
        return {
          label: 'Đặt Hẹn',
          badgeClass:
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/35',
        };
      default:
        return {
          label: 'Nhân Viên',
          badgeClass:
            'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        };
    }
  };

  const roleInfo = getRoleBadge(currentUser.role);
  const perms = currentUser.permissions;

  return (
    <header className="bg-white dark:bg-[#0d1321] border-b border-slate-200 dark:border-slate-800/90 sticky top-0 z-30 transition-colors duration-200">
      {/* Top Bar: Brand Left | Theme Switcher & Account Top-Right */}
      <div className="w-full px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
        {/* Logo & Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
            <Car className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white uppercase whitespace-nowrap truncate">
              {systemSettings.workshopName || 'Hãng Xe Auto Service'}
            </h1>
            <span className="text-slate-300 dark:text-slate-700 hidden md:inline shrink-0">·</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap hidden md:inline truncate">
              {systemSettings.branchName || 'Vũng Tàu'}
            </span>
          </div>
        </div>

        {/* Top-Right Controls: Light/Dark Mode + Authenticated Account */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            aria-label="Chuyển đổi giao diện Sáng / Tối"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-[#161f30] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Sáng</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="hidden sm:inline">Tối</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 pl-2 pr-1.5 py-1 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700/80 rounded-lg shrink-0">
            <img
              src={currentUser.avatar}
              alt={currentUser.fullName}
              referrerPolicy="no-referrer"
              className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 shrink-0 object-cover"
            />
            <div className="leading-tight hidden sm:block">
              <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                <span className="truncate max-w-[130px]">{currentUser.fullName}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border leading-none ${roleInfo.badgeClass}`}
                >
                  {roleInfo.label}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              title="Đăng xuất"
              className="p-1 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-md transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-slate-50/70 dark:bg-[#0b101d] border-t border-slate-200 dark:border-slate-800/80 transition-colors duration-200">
        <div className="w-full px-3 sm:px-5 flex items-center justify-between flex-wrap gap-2">
          <nav className="flex items-center overflow-x-auto text-xs sm:text-sm font-semibold">
            {perms.canAccessDatHen && (
              <button
                type="button"
                onClick={() => onTabChange('dat_hen')}
                className={`flex items-center gap-2 px-5 py-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeMainTab === 'dat_hen'
                    ? 'border-blue-600 dark:border-blue-500 text-blue-700 dark:text-white bg-white dark:bg-[#131c2e] font-bold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Đặt Hẹn</span>
              </button>
            )}

            {perms.canAccessLeTan && (
              <button
                type="button"
                onClick={() => onTabChange('le_tan')}
                className={`flex items-center gap-2 px-5 py-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeMainTab === 'le_tan'
                    ? 'border-blue-600 dark:border-blue-500 text-blue-700 dark:text-white bg-white dark:bg-[#131c2e] font-bold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ClipboardList className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Lễ Tân</span>
                {waitingReceptionCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono font-bold leading-none">
                    {waitingReceptionCount}
                  </span>
                )}
                {advisorRequestsCount > 0 && (
                  <span
                    title={`${advisorRequestsCount} Cố Vấn đang gọi xe`}
                    className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/25 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40 text-[10px] font-mono font-bold leading-none"
                  >
                    Gọi xe: {advisorRequestsCount}
                  </span>
                )}
              </button>
            )}

            {perms.canAccessCoVan && (
              <button
                type="button"
                onClick={() => onTabChange('co_van')}
                className={`flex items-center gap-2 px-5 py-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeMainTab === 'co_van'
                    ? 'border-blue-600 dark:border-blue-500 text-blue-700 dark:text-white bg-white dark:bg-[#131c2e] font-bold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Cố Vấn</span>
                {advisorReceivingCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-violet-600 text-white text-[10px] font-mono font-bold leading-none">
                    {advisorReceivingCount}
                  </span>
                )}
              </button>
            )}

            {perms.canAccessSettings && (
              <button
                type="button"
                onClick={() => onTabChange('cai_dat')}
                className={`flex items-center gap-2 px-5 py-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeMainTab === 'cai_dat'
                    ? 'border-blue-600 dark:border-blue-500 text-blue-700 dark:text-white bg-white dark:bg-[#131c2e] font-bold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span>Cài Đặt</span>
                {pendingRequestsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-mono font-bold leading-none">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            )}
          </nav>

          {/* Compact inline filter controls on Đặt Hẹn tab */}
          {activeMainTab === 'dat_hen' && (
            <div className="flex items-center gap-2 py-1.5 flex-wrap">
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => onToggleViewMode('timeline')}
                  title="Xem dạng Lịch Biểu (Timeline)"
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === 'timeline'
                      ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Lịch</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleViewMode('table')}
                  title="Xem dạng Bảng Danh Sách"
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Bảng</span>
                </button>
              </div>

              <div className="relative min-w-[180px] sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Tìm biển số, KH, SĐT..."
                  className="w-full pl-8 pr-2.5 py-1 bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={selectedAdvisorFilter}
                onChange={(e) => onAdvisorFilterChange(e.target.value)}
                className="px-2.5 py-1 bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="">Tất cả Cố Vấn</option>
                {advisors.map((adv) => (
                  <option key={adv.id} value={adv.name}>
                    {adv.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="px-2.5 py-1 bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="">Tất cả Trạng Thái</option>
                <option value="Chờ Tiếp Nhận">Chờ Tiếp Nhận</option>
                <option value="Đã Xác Nhận">Đã Xác Nhận</option>
                <option value="Đang Làm">Đang Làm</option>
                <option value="Hoàn Thành">Hoàn Thành</option>
                <option value="Đã Hủy">Đã Hủy</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
