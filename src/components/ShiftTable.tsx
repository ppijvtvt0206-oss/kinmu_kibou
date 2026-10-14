import React, { useState } from 'react';
import { User, ShiftType, ScheduleData, ShiftCode } from '../types';
import { SHIFT_TYPES } from '../constants';
import { ChevronLeft, ChevronRight, AlertCircle, Check, HelpCircle, CalendarDays, RefreshCw, X, Lock, Clock, CalendarCheck2, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isJapaneseHoliday, getJapaneseHolidayName, getShiftTextColor, getShiftCellBg } from '../utils';

interface ShiftTableProps {
  users: User[];
  currentUser: User;
  scheduleData: ScheduleData;
  setScheduleData: React.Dispatch<React.SetStateAction<ScheduleData>>;
  currentDate: Date;
  changeMonth: (offset: number) => void;
  daysInMonth: Date[];
  formatDate: (date: Date) => string;
  getDayOfWeek: (date: Date) => string;
  onOpenRequestModal: () => void;
  onResetData: () => void;
  scheduleStatus: 'open' | 'closed' | 'finalized';
  setScheduleStatus: (status: 'open' | 'closed' | 'finalized') => void;
}

export default function ShiftTable({
  users,
  currentUser,
  scheduleData,
  setScheduleData,
  currentDate,
  changeMonth,
  daysInMonth,
  formatDate,
  getDayOfWeek,
  onOpenRequestModal,
  onResetData,
  scheduleStatus,
  setScheduleStatus,
}: ShiftTableProps) {
  const employees = users;
  const isManager = currentUser.role === 'manager';

  // Direct cell touch selection states (マスへのタッチ操作のみで勤務選択)
  const [editingCell, setEditingCell] = useState<{
    dateStr: string;
    userId: string;
    userName: string;
    currentValue: string;
    currentMemo: string;
    anchorRect?: { top: number; left: number; bottom: number; right: number };
  } | null>(null);

  // Memo editing state in quick palette
  const [cellMemoInput, setCellMemoInput] = useState('');
  const [hoveredMemo, setHoveredMemo] = useState<{
    userName: string;
    dateStr: string;
    memo: string;
    x: number;
    y: number;
  } | null>(null);

  // Toggle to show/hide the stats row at the bottom
  const [showCoverageStats, setShowCoverageStats] = useState(false);

  // Active staff statistics user
  const [selectedStaffStatsUser, setSelectedStaffStatsUser] = useState<User | null>(null);

  // Batch/bulk input modal states
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    userId: '',
    startDate: '',
    endDate: '',
    shiftCode: '有' as ShiftCode,
  });
  const [batchError, setBatchError] = useState('');
  const [batchSuccess, setBatchSuccess] = useState('');

  const handleOpenBatchModal = () => {
    const defaultUser = employees[0]?.id || '';
    if (daysInMonth.length > 0) {
      const firstDay = formatDate(daysInMonth[0]);
      const lastDay = formatDate(daysInMonth[daysInMonth.length - 1]);
      setBatchForm({
        userId: defaultUser,
        startDate: firstDay,
        endDate: lastDay,
        shiftCode: '有' as ShiftCode,
      });
    } else {
      setBatchForm(prev => ({ ...prev, userId: defaultUser }));
    }
    setBatchError('');
    setBatchSuccess('');
    setIsBatchModalOpen(true);
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { userId, startDate, endDate, shiftCode } = batchForm;
    if (!userId || !startDate || !endDate) {
      setBatchError('入力項目に漏れがあります。');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      setBatchError('開始日は終了日以前の日付を指定してください。');
      return;
    }

    setScheduleData(prev => {
      const nextData = { ...prev };
      const current = new Date(start);
      while (current <= end) {
        const dateStr = formatDate(current);
        if (!nextData[dateStr]) {
          nextData[dateStr] = {};
        }
        const existing = nextData[dateStr][userId] || { request: '', final: '' };
        nextData[dateStr][userId] = {
          request: existing.request,
          final: shiftCode,
        };
        current.setDate(current.getDate() + 1);
      }
      return nextData;
    });

    const targetUser = users.find(u => u.id === userId);
    setBatchSuccess(`${targetUser?.name}さんの ${startDate} 〜 ${endDate} 期間に【${shiftCode}】を一括反映しました。`);
    setTimeout(() => {
      setIsBatchModalOpen(false);
    }, 1500);
  };



  // Normalize user text inputs into valid ShiftCode
  const normalizeShiftCode = (val: string): ShiftCode => {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-' || trimmed === 'ー' || trimmed === ' ' || trimmed === '消' || trimmed === 'クリア') {
      return '' as ShiftCode;
    }
    
    // Exact match
    const exact = SHIFT_TYPES.find(t => t.code.toLowerCase() === trimmed.toLowerCase());
    if (exact) return exact.code as ShiftCode;

    // Smart shortcuts & typing support
    const upper = trimmed.toUpperCase();
    if (upper === 'C' || upper === 'CE') return 'CE';
    if (upper === 'O' || upper === 'OP' || upper === 'OPE') return 'OPE';
    if (upper === 'D' || trimmed === 'に' || trimmed === '日勤') return '日';
    if (upper === 'H' || trimmed === 'は' || trimmed === '早番') return '早';
    if (upper === 'T' || trimmed === 'と' || trimmed === '透析') return '透';
    if (upper === 'K' || trimmed === 'き' || trimmed === '休み' || trimmed === '公休') return '休';
    if (upper === 'Y' || trimmed === 'ゆ' || trimmed === '有給') return '有';
    if (upper === 'S' || trimmed === 'さ' || trimmed === '産休') return '産';
    if (trimmed === 'し' || trimmed === '出張') return '出';
    if (trimmed === 'い' || trimmed === '移動') return '移';
    if (trimmed === 'お' || trimmed === '応援') return '応';

    // If matches first character of any valid code
    const firstMatch = SHIFT_TYPES.find(t => t.code && t.code === trimmed[0]);
    if (firstMatch) return firstMatch.code as ShiftCode;

    return '' as ShiftCode;
  };

  // Helper to commit shift change directly into cell
  const handleCommitShift = (dateStr: string, userId: string, rawCode: string) => {
    const code = normalizeShiftCode(rawCode);
    setScheduleData(prev => {
      const next = { ...prev };
      if (!next[dateStr]) next[dateStr] = {};
      const existing = next[dateStr][userId] || { request: '', final: '' };
      if (isManager) {
        next[dateStr][userId] = { ...existing, final: code };
      } else {
        if (userId === currentUser.id) {
          next[dateStr][userId] = { ...existing, request: code };
        }
      }
      return next;
    });
    setEditingCell(prev => prev ? { ...prev, currentValue: code } : null);
  };

  // Helper to save memo directly into cell
  const handleSaveCellMemo = (dateStr: string, userId: string, memo: string) => {
    setScheduleData(prev => {
      const next = { ...prev };
      if (!next[dateStr]) next[dateStr] = {};
      const existing = next[dateStr][userId] || { request: '', final: '' };
      next[dateStr][userId] = {
        ...existing,
        memo: memo.trim() ? memo.trim() : undefined,
      };
      return next;
    });
    setEditingCell(prev => prev ? { ...prev, currentMemo: memo.trim() } : null);
  };

  // Calculate daily staffing stats
  const getDailyStats = (date: Date) => {
    const dateStr = formatDate(date);
    const dayData = scheduleData[dateStr] || {};
    
    const counts: { [code: string]: number } = {};
    SHIFT_TYPES.forEach(t => {
      if (t.code) counts[t.code] = 0;
    });

    let totalWorking = 0;
    employees.forEach(emp => {
      const shift = dayData[emp.id]?.final;
      if (shift && counts[shift] !== undefined) {
        counts[shift]++;
        if (shift !== '休' && shift !== '有' && shift !== '産') {
          totalWorking++;
        }
      }
    });

    return { counts, totalWorking };
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
      
      {/* Table Header Area */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Month Navigation */}
        <div className="flex items-center space-x-1 bg-white border border-slate-200 shadow-sm rounded-xl p-1">
          <button 
            onClick={() => changeMonth(-1)} 
            className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-all active:scale-95"
            title="前月"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-display font-bold text-slate-800 text-base md:text-lg px-4 min-w-[130px] text-center">
            {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
          </span>
          <button 
            onClick={() => changeMonth(1)} 
            className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-all active:scale-95"
            title="次月"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Legend / Info Label */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-medium text-slate-500">
          <div className="hidden lg:flex items-center space-x-3">
            <div className="flex items-center space-x-1 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md text-amber-800 text-[11px] font-bold">
              <span>📝</span>
              <span>詳細メモあり（ホバーで確認）</span>
            </div>
            {SHIFT_TYPES.map(type => (
              <div key={type.code || 'undecided'} className="flex items-center space-x-1">
                <span className={`text-xs font-black min-w-[14px] text-center ${getShiftTextColor(type.code)}`}>
                  {type.code || '−'}
                </span>
                <span className="text-slate-600 font-bold text-[11px]">{type.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow & Status Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">シフト提出状況:</span>
          {scheduleStatus === 'open' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              希望受付中
            </span>
          )}
          {scheduleStatus === 'closed' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
              受付終了（調整中）
            </span>
          )}
          {scheduleStatus === 'finalized' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5"></span>
              シフト確定
            </span>
          )}
        </div>

        {/* Action controllers (Manager can toggle, Employee sees locked state) */}
        <div className="flex flex-wrap items-center gap-3">
          {isManager ? (
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              <button
                onClick={() => setScheduleStatus('open')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                  scheduleStatus === 'open'
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200/50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="希望受付を開始します"
              >
                <Clock size={12} />
                <span>受付中にする</span>
              </button>

              <button
                onClick={() => setScheduleStatus('closed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                  scheduleStatus === 'closed'
                    ? 'bg-amber-50 text-amber-700 shadow-sm border border-amber-200/50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="提出を締め切り、管理者調整に入ります"
              >
                <Clock size={12} />
                <span>受付終了にする</span>
              </button>

              <button
                onClick={() => setScheduleStatus('finalized')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                  scheduleStatus === 'finalized'
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-200/50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="シフトを最終確定し、全員の表示をロックします"
              >
                <Lock size={12} />
                <span>シフト確定にする</span>
              </button>
            </div>
          ) : (
            <div className="text-[11px] font-semibold text-slate-400 flex items-center bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/40">
              <Lock size={12} className="mr-1.5" />
              <span>一般スタッフはステータス操作不可</span>
            </div>
          )}

          {/* Manager specialized Long-Term Batch Input Trigger */}
          {isManager && (
            <button
              onClick={handleOpenBatchModal}
              className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 py-2 px-3.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
              title="有給消化、産休、出張など、長期間におよぶ同一シフトを1回で一括登録します。"
            >
              <Sliders size={13} />
              <span>長期一括入力 (有給・産休など)</span>
            </button>
          )}

          {/* Show / Hide Coverage Stats Button (長期一括入力の右となりに配置) */}
          {isManager && (
            <button
              onClick={() => setShowCoverageStats(!showCoverageStats)}
              className={`px-3 py-2 border rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 flex items-center space-x-1 ${
                showCoverageStats 
                  ? 'bg-slate-100 border-slate-300 text-slate-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>要員状況を{showCoverageStats ? '非表示' : '表示'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="w-full overflow-x-auto relative">
        <table className="w-full text-xs text-left border-collapse select-none">
          
          {/* Sticky Table Header */}
          <thead className="sticky top-0 z-20 bg-slate-50 shadow-xs border-b border-slate-200">
            <tr>
              <th className="py-1.5 px-2 font-display font-semibold text-slate-600 sticky left-0 bg-slate-50 z-30 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.03)] w-[84px] min-w-[78px] max-w-[92px] whitespace-nowrap text-xs">
                スタッフ名
              </th>
              {daysInMonth.map(date => {
                const isSun = date.getDay() === 0;
                const isSat = date.getDay() === 6;
                const isHoliday = isJapaneseHoliday(date);
                const holidayName = getJapaneseHolidayName(date);
                const dayLabel = getDayOfWeek(date);
                const dayNum = date.getDate();

                return (
                  <th 
                    key={formatDate(date)} 
                    className={`py-1.5 px-1 text-center border-r border-slate-200 min-w-[46px] md:min-w-[50px] ${
                      isSun || isHoliday ? 'bg-rose-50' : isSat ? 'bg-blue-50' : 'bg-slate-50'
                    }`}
                  >
                    <div className={`font-display font-bold text-xs md:text-sm leading-tight ${isSun || isHoliday ? 'text-rose-600' : isSat ? 'text-blue-600' : 'text-slate-800'}`}>
                      {dayNum}
                    </div>
                    <div className={`text-[10px] font-medium leading-none ${isSun || isHoliday ? 'text-rose-500' : isSat ? 'text-blue-500' : 'text-slate-500'}`} title={holidayName || ''}>
                      {isHoliday ? '祝' : dayLabel}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {employees.map(user => {
              const isCurrentUser = user.id === currentUser.id;
              
              return (
                <tr 
                  key={user.id} 
                  className={`group transition-colors h-9 ${
                    isCurrentUser ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'
                  }`}
                >
                  {/* Sticky Staff Name Column */}
                  <td 
                    onClick={() => setSelectedStaffStatsUser(user)}
                    className={`py-1 px-2 font-medium sticky left-0 z-10 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.02)] cursor-pointer transition-colors group/name h-9 w-[84px] min-w-[78px] max-w-[92px] ${
                      isCurrentUser 
                        ? 'bg-indigo-100/90 text-indigo-950 font-bold border-l-[3.5px] border-l-indigo-600 hover:bg-indigo-200/80' 
                        : 'bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                    title={`${user.name}（クリックしてシフト集計状況を表示）`}
                  >
                    <div className="whitespace-nowrap overflow-hidden">
                      <span className={`text-xs font-bold truncate block ${
                        isCurrentUser ? 'text-indigo-950 font-black' : 'text-slate-800'
                      } underline decoration-indigo-300 decoration-dashed underline-offset-2 group-hover/name:text-indigo-700 group-hover/name:decoration-solid`}>
                        {user.name}
                      </span>
                    </div>
                  </td>

                  {/* Day Cells */}
                  {daysInMonth.map((date, dayIdx) => {
                    const dateStr = formatDate(date);
                    const cellData = scheduleData[dateStr]?.[user.id] || { request: '', final: '' };
                    
                    const isEditing = editingCell?.dateStr === dateStr && editingCell?.userId === user.id;

                    // Editable constraint based on Schedule Status:
                    // - finalized: complete lock for everyone
                    // - closed: only managers can edit final schedule
                    // - open: employees can edit own requests, managers can edit everything
                    let isEditable = false;
                    if (scheduleStatus === 'open') {
                      isEditable = isManager || isCurrentUser;
                    } else if (scheduleStatus === 'closed') {
                      isEditable = isManager;
                    } else if (scheduleStatus === 'finalized') {
                      isEditable = false;
                    }

                    const shouldShowFinal = isManager || scheduleStatus === 'finalized';
                    const displayFinal = shouldShowFinal ? cellData.final : '';
                    const displayRequest = cellData.request;
                    const showRequestIndicator = shouldShowFinal && cellData.final !== '' && cellData.request !== '';
                    const isConflict = scheduleStatus !== 'finalized' && cellData.final !== '' && cellData.request !== '' && cellData.final !== cellData.request;

                    const effectiveShift = displayFinal || displayRequest;

                    return (
                      <td 
                        key={dateStr}
                        onClick={(e) => {
                          if (!isEditable) return;

                          // Open quick touch palette attached to this cell (マス選択モード)
                          const rect = e.currentTarget.getBoundingClientRect();
                          const currentVal = isManager ? cellData.final : cellData.request;
                          setCellMemoInput(cellData.memo || '');
                          setEditingCell({
                            dateStr,
                            userId: user.id,
                            userName: user.name,
                            currentValue: currentVal || '',
                            currentMemo: cellData.memo || '',
                            anchorRect: {
                              top: rect.top,
                              left: rect.left,
                              bottom: rect.bottom,
                              right: rect.right,
                            }
                          });
                        }}
                        onMouseEnter={(e) => {
                          if (cellData.memo) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredMemo({
                              userName: user.name,
                              dateStr,
                              memo: cellData.memo,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }
                        }}
                        onMouseLeave={() => setHoveredMemo(null)}
                        title={cellData.memo ? `【${user.name}】詳細メモ: ${cellData.memo}` : undefined}
                        className={`p-0.5 border-r border-slate-100 relative text-center transition-all h-9 ${
                          isEditing
                            ? 'ring-2 ring-indigo-500 bg-indigo-100/60 z-20'
                            : isEditable 
                              ? 'cursor-pointer hover:ring-1 hover:ring-indigo-300 active:bg-indigo-50' 
                              : 'cursor-not-allowed'
                        } ${getShiftCellBg(date, effectiveShift)}`}
                      >
                        <div className="w-full h-8 flex flex-col items-center justify-center select-none relative">
                          {/* Request Indicator (Subtle small text directly above) */}
                          {showRequestIndicator && (
                            <span className="text-[8px] font-bold text-slate-400 select-none leading-none -mt-0.5 mb-0.5">
                              希:{displayRequest}
                            </span>
                          )}

                          {/* Direct Shift Character written directly in the cell */}
                          {displayFinal ? (
                            <span className={`text-xs md:text-sm font-black tracking-tight leading-none select-none ${getShiftTextColor(displayFinal)}`}>
                              {displayFinal}
                            </span>
                          ) : displayRequest ? (
                            <div className="flex flex-col items-center leading-none">
                              <span className="text-[7px] font-bold text-indigo-500 leading-none mb-0.2">希望</span>
                              <span className={`text-xs md:text-sm font-bold tracking-tight leading-none select-none opacity-85 ${getShiftTextColor(displayRequest)}`}>
                                {displayRequest}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-normal text-xs select-none leading-none">-</span>
                          )}

                          {/* Memo Indicator Icon (📝) */}
                          {cellData.memo && (
                            <span 
                              className="absolute bottom-0 right-0 text-[8px] leading-none select-none drop-shadow-xs" 
                              title={`詳細メモ: ${cellData.memo}`}
                            >
                              📝
                            </span>
                          )}

                          {/* Conflict Red Dot Indicator */}
                          {isConflict && isManager && (
                            <span className="absolute top-0.5 right-0.5 flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" title="希望と異なります"></span>
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* Table Footer with Daily Coverage Metrics (Visible to Managers only) */}
          {showCoverageStats && isManager && (
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              {[
                { code: '日', label: '日勤', textColorClass: 'text-blue-700' },
                { code: '早', label: '早番', textColorClass: 'text-emerald-700' },
                { code: 'CE', label: 'CE', textColorClass: 'text-cyan-700' },
                { code: 'OPE', label: 'OPE', textColorClass: 'text-amber-700' },
                { code: '透', label: '透析', textColorClass: 'text-teal-700' },
                { code: 'その他', label: 'その他', textColorClass: 'text-slate-700', isMisc: true }
              ].map(t => (
                <tr key={t.code} className="bg-slate-50 text-slate-600 border-b border-slate-100 h-8">
                  <td className="py-1 px-2 font-semibold sticky left-0 bg-slate-50 border-r border-slate-200 font-display text-xs h-8 w-[84px] min-w-[78px] max-w-[92px] whitespace-nowrap">
                    <div className="flex items-center justify-between w-full text-[11px]">
                      <span className="font-bold text-slate-700 truncate">{t.label}</span>
                      <span className="text-[9.5px] text-slate-400 font-normal shrink-0">計</span>
                    </div>
                  </td>
                  {daysInMonth.map(date => {
                    const stats = getDailyStats(date);
                    const count = t.isMisc
                      ? (stats.counts['出'] || 0) + (stats.counts['移'] || 0) + (stats.counts['応'] || 0) + (stats.counts['産'] || 0)
                      : (stats.counts[t.code] || 0);
                    return (
                      <td key={formatDate(date)} className={`py-1 px-0.5 text-center font-mono font-bold border-r border-slate-100 text-xs h-8 ${t.textColorClass}`}>
                        {count || <span className="text-slate-300 font-normal">-</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>


      {/* Long-Term Bulk Input Modal */}
      <AnimatePresence>
        {isBatchModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-display font-bold text-slate-800 flex items-center gap-2">
                  <Sliders size={18} className="text-indigo-600" />
                  <span>長期一括入力 (管理者用)</span>
                </h3>
                <button
                  onClick={() => setIsBatchModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleBatchSubmit} className="p-6 space-y-4">
                {batchError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{batchError}</span>
                  </div>
                )}

                {batchSuccess && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold rounded-xl flex flex-col items-center gap-2 text-center">
                    <Check size={24} className="text-emerald-600 animate-bounce" />
                    <span>{batchSuccess}</span>
                  </div>
                )}

                {!batchSuccess && (
                  <>
                    {/* Staff selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 block">
                        対象スタッフ
                      </label>
                      <select
                        value={batchForm.userId}
                        onChange={(e) => setBatchForm(prev => ({ ...prev, userId: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all"
                        required
                      >
                        <option value="" disabled>スタッフを選択してください</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.role === 'manager' ? '管理者' : '一般'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 block">
                          開始日
                        </label>
                        <input
                          type="date"
                          value={batchForm.startDate}
                          onChange={(e) => setBatchForm(prev => ({ ...prev, startDate: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 block">
                          終了日
                        </label>
                        <input
                          type="date"
                          value={batchForm.endDate}
                          onChange={(e) => setBatchForm(prev => ({ ...prev, endDate: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all"
                          required
                        />
                      </div>
                    </div>

                    {/* Shift type selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 block">
                        反映するシフトコード
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {SHIFT_TYPES.map(type => (
                          <button
                            type="button"
                            key={type.code || 'clear'}
                            onClick={() => setBatchForm(prev => ({ ...prev, shiftCode: type.code as ShiftCode }))}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 hover:scale-[1.03] active:scale-[0.97] ${
                              batchForm.shiftCode === type.code
                                ? 'ring-2 ring-indigo-600 ring-offset-1 ' + type.color
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-xs">{type.code || '削'}</span>
                            <span className="text-[9px] font-medium opacity-80 truncate max-w-full">{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Help info */}
                    <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-2xl text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
                      <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <span>
                        ※ 産休・育休・有給消化、または出張・透析専任など、長期間にわたる特定のシフト予定を一括でカレンダーに上書き決定します。
                      </span>
                    </div>

                    {/* Submit actions */}
                    <div className="flex items-center space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsBatchModalOpen(false)}
                        className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-2xl transition-all"
                      >
                        キャンセル
                      </button>
                      <button
                        type="submit"
                        className="w-2/3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-2xl transition-all shadow-md hover:shadow-indigo-500/10"
                      >
                        カレンダーに一括適用
                      </button>
                    </div>
                  </>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING QUICK TOUCH PALETTE AT ACTIVE CELL (完全タッチ操作対応) */}
      <AnimatePresence>
        {editingCell && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px]" 
              onClick={() => setEditingCell(null)} 
            />
            <div 
              className="fixed z-50 bg-white/98 backdrop-blur-md border border-slate-200/90 shadow-2xl rounded-2xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150"
              style={(() => {
                if (!editingCell.anchorRect) {
                  return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', minWidth: '340px' };
                }
                const vpW = typeof window !== 'undefined' ? window.innerWidth : 1000;
                const vpH = typeof window !== 'undefined' ? window.innerHeight : 800;
                const pW = 340;
                const pH = 210;
                let left = editingCell.anchorRect.left + (editingCell.anchorRect.right - editingCell.anchorRect.left) / 2 - pW / 2;
                left = Math.max(12, Math.min(left, vpW - pW - 12));
                let top = editingCell.anchorRect.bottom + 6;
                if (top + pH > vpH - 16) {
                  top = Math.max(12, editingCell.anchorRect.top - pH - 6);
                }
                return { top: `${top}px`, left: `${left}px`, width: `${pW}px` };
              })()}
            >
              {/* Header with target cell info and close button */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1 border-b border-slate-100 pb-1.5">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0"></span>
                  <span className="text-slate-800 font-black">{editingCell.userName}</span>
                  <span className="text-slate-500 font-mono text-[11px]">{editingCell.dateStr.slice(5).replace('-', '/')}</span>
                  <span className="text-indigo-600 font-extrabold text-[11px]">
                    {isManager ? '勤務選択' : '希望選択'}
                  </span>
                </span>
                <button 
                  type="button" 
                  onClick={() => setEditingCell(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 transition-colors"
                  title="閉じる"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Touch grid of all shifts */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {SHIFT_TYPES.map(type => {
                  const isCurrent = editingCell.currentValue === type.code;
                  return (
                    <button
                      key={type.code || 'clear'}
                      type="button"
                      onClick={() => {
                        handleCommitShift(editingCell.dateStr, editingCell.userId, type.code);
                      }}
                      className={`min-h-[44px] py-1.5 px-1 rounded-xl text-xs font-black transition-all active:scale-95 flex flex-col items-center justify-center border shadow-2xs select-none ${
                        isCurrent
                          ? 'ring-2 ring-indigo-600 ring-offset-1 scale-[1.02] border-indigo-500'
                          : ''
                      } ${
                        type.code === ''
                          ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          : `${type.color} hover:opacity-90`
                      }`}
                      title={type.label}
                    >
                      <span className="text-sm font-black leading-tight">{type.code || '消去'}</span>
                      <span className="text-[8px] font-bold leading-tight opacity-75">{type.code ? type.label : 'クリア'}</span>
                    </button>
                  );
                })}
              </div>

              {/* Memo input section for the cell (No template buttons) */}
              <div className="border-t border-slate-100 pt-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-600 flex items-center gap-1">
                    <span>📝</span>
                    <span>勤務希望の詳細メモ</span>
                  </span>
                  {editingCell.currentMemo && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-bold">
                      登録あり
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={cellMemoInput}
                    onChange={(e) => setCellMemoInput(e.target.value)}
                    placeholder="例: 午前のみ、17時退勤、勉強会 など"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveCellMemo(editingCell.dateStr, editingCell.userId, cellMemoInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveCellMemo(editingCell.dateStr, editingCell.userId, cellMemoInput)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all shrink-0 active:scale-95"
                  >
                    保存
                  </button>
                  {editingCell.currentMemo && (
                    <button
                      type="button"
                      onClick={() => {
                        setCellMemoInput('');
                        handleSaveCellMemo(editingCell.dateStr, editingCell.userId, '');
                      }}
                      className="bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-[11px] font-bold px-2 py-1.5 rounded-lg transition-all shrink-0"
                      title="メモを消去"
                    >
                      消去
                    </button>
                  )}
                </div>
              </div>

              {/* Close footer */}
              <div className="flex justify-end pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-3 py-1 rounded-lg transition-all"
                >
                  閉じる
                </button>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Hovered Memo Tooltip (カーソルを合わせると確認できるポップアップ) */}
      <AnimatePresence>
        {hoveredMemo && (
          <div
            className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 no-print"
            style={{
              left: `${hoveredMemo.x}px`,
              top: `${Math.max(10, hoveredMemo.y - 8)}px`,
            }}
          >
            <div className="bg-slate-900/95 text-white px-3 py-2 rounded-xl shadow-xl text-xs max-w-xs backdrop-blur-xs border border-slate-700/60 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center gap-1.5 pb-1 border-b border-slate-700/80 mb-1 text-[11px] text-slate-300 font-bold">
                <span>📝</span>
                <span className="text-white font-extrabold">{hoveredMemo.userName}</span>
                <span className="font-mono text-slate-400">({hoveredMemo.dateStr.slice(5).replace('-', '/')})</span>
              </div>
              <p className="text-slate-100 leading-snug whitespace-pre-wrap break-words font-medium">
                {hoveredMemo.memo}
              </p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* STAFF STATS MODAL (Opens on clicking staff name!) */}
      <AnimatePresence>
        {selectedStaffStatsUser && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
            <div className="absolute inset-0" onClick={() => setSelectedStaffStatsUser(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 relative z-10"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-display font-bold text-slate-800 flex items-center gap-2">
                  <CalendarCheck2 size={18} className="text-indigo-600" />
                  <span>スタッフ個別シフト集計</span>
                </h3>
                <button
                  onClick={() => setSelectedStaffStatsUser(null)}
                  className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50 flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-800">{selectedStaffStatsUser.name} さん</h4>
                    <span className="text-xs text-slate-500 font-medium">{selectedStaffStatsUser.role === 'manager' ? '管理者' : '一般スタッフ'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">当月出勤日数</span>
                    <span className="text-2xl font-mono font-black text-indigo-700">
                      {(() => {
                        let totalWorking = 0;
                        daysInMonth.forEach(date => {
                          const dateStr = formatDate(date);
                          const dayData = scheduleData[dateStr]?.[selectedStaffStatsUser.id];
                          const shiftCode = dayData?.final;
                          if (shiftCode && !['休', '有', '産'].includes(shiftCode)) {
                            totalWorking++;
                          }
                        });
                        return totalWorking;
                      })()}日
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">シフト別内訳（確定）</h5>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    {(() => {
                      const counts: { [key: string]: number } = {
                        '休': 0,
                        '日': 0,
                        '早': 0,
                        'CE': 0,
                        'OPE': 0,
                        '透': 0,
                        '有': 0,
                        'その他': 0,
                      };

                      daysInMonth.forEach(date => {
                        const dateStr = formatDate(date);
                        const dayData = scheduleData[dateStr]?.[selectedStaffStatsUser.id];
                        const shiftCode = dayData?.final;

                        if (shiftCode) {
                          if (['産', '出', '移', '応'].includes(shiftCode)) {
                            counts['その他']++;
                          } else if (counts[shiftCode] !== undefined) {
                            counts[shiftCode]++;
                          } else {
                            counts['その他']++;
                          }
                        }
                      });
                      
                      const displayItems = [
                        { label: '休み', code: '休', count: counts['休'], color: 'bg-rose-50 text-rose-700 border-rose-200' },
                        { label: '有給', code: '有', count: counts['有'], color: 'bg-violet-50 text-violet-700 border-violet-200' },
                        { label: '日勤', code: '日', count: counts['日'], color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { label: '早番', code: '早', count: counts['早'], color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        { label: 'CE', code: 'CE', count: counts['CE'], color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
                        { label: 'OPE', code: 'OPE', count: counts['OPE'], color: 'bg-amber-50 text-amber-700 border-amber-200' },
                        { label: '透析', code: '透', count: counts['透'], color: 'bg-teal-50 text-teal-700 border-teal-200' },
                        { label: 'その他', count: counts['その他'], color: 'bg-slate-100 text-slate-700 border-slate-200' },
                      ];

                      return displayItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${item.color}`}>
                              {item.code || '他'}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-700 block">{item.label}</span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-sm text-slate-800">{item.count}日</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  ※ 出張・移動・応援・産休の各シフトは「その他」に合算して集計されています。
                </p>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedStaffStatsUser(null)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/10"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
