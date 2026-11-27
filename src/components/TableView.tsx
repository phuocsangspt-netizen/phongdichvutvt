import React from 'react';
import { Appointment } from '../types/appointment';
import { Edit } from 'lucide-react';

interface TableViewProps {
  appointments: Appointment[];
  selectedDate: string;
  onEditAppointment: (appointment: Appointment) => void;
  onOpenNewModal: () => void;
}

export const TableView: React.FC<TableViewProps> = ({
  appointments,
  onEditAppointment,
  onOpenNewModal,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Đã Xác Nhận':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40';
      case 'Đang Làm':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40';
      case 'Hoàn Thành':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40';
      case 'Đã Hủy':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'VIP':
        return 'bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 font-bold';
      case 'Gấp':
      case 'Khách Chờ Lấy Liền':
        return 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300 font-bold';
      case 'Ưu Tiên':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-semibold';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <div className="w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-colors duration-200">
      <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-[#141d2e] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Danh Sách Lịch Hẹn <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">({appointments.length})</span>
        </h2>
        <button
          type="button"
          onClick={onOpenNewModal}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
        >
          + Thêm Lịch Hẹn
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-[#161f30] text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Giờ Hẹn</th>
              <th className="py-3 px-4">Biển Số</th>
              <th className="py-3 px-4">Khoang / Hạng Mục</th>
              <th className="py-3 px-4">Khách Hàng & SĐT</th>
              <th className="py-3 px-4">Nội Dung Hẹn</th>
              <th className="py-3 px-4">Cố Vấn</th>
              <th className="py-3 px-4">Trạng Thái</th>
              <th className="py-3 px-4">Ưu Tiên</th>
              <th className="py-3 px-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  Không có lịch hẹn nào phù hợp.
                </td>
              </tr>
            ) : (
              appointments.map((apt) => (
                <tr
                  key={apt.id}
                  onClick={() => onEditAppointment(apt)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {apt.appointmentTime}
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal block">
                      {apt.durationMinutes} phút
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white text-sm whitespace-nowrap">
                    {apt.licensePlate}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {apt.bayName || apt.bayId}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {apt.serviceTypes.join(', ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-200">
                      {apt.customerName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {apt.phoneNumber}
                    </div>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <span className="text-slate-800 dark:text-amber-200/90 font-medium block truncate">
                      {apt.content}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {apt.location}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <img
                        src={
                          apt.advisorAvatar ||
                          'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
                        }
                        alt={apt.advisorName}
                        referrerPolicy="no-referrer"
                        className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700"
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {apt.advisorName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getStatusBadge(
                        apt.status
                      )}`}
                    >
                      {apt.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] ${getPriorityBadge(
                        apt.priority
                      )}`}
                    >
                      {apt.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditAppointment(apt);
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
                      title="Sửa lịch hẹn"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
