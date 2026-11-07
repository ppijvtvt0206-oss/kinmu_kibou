import React, { useState } from 'react';
import { User, ShiftType, ScheduleData, ShiftCode, CalendarEvent, EventsData, EventCategory } from '../types';
import { SHIFT_TYPES, getSelectableShifts, RESTRICTED_EMPLOYEE_SHIFTS, EVENT_CATEGORIES } from '../constants';
import { 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  Check, 
  HelpCircle, 
  CalendarDays, 
  RefreshCw, 
  X, 
  Lock, 
  Clock, 
  CalendarCheck2, 
  Sliders,
  Calendar,
  Plus,
  Edit3,
  Trash2,
  Tag,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isJapaneseHoliday, getJapaneseHolidayName, getShiftTextColor, getShiftCellBg } from '../utils';

interface ShiftTableProps {
  users: User[];
  currentUser: User;
  scheduleData: ScheduleData;
  setScheduleData: React.Dispatch<React.SetStateAction<ScheduleData>>;
  eventsData: EventsData;
  setEventsData: React.Dispatch<React.SetStateAction<EventsData>>;
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
  eventsData,
  setEventsData,
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
    currentStandby: boolean;
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

  // Event modal state
  const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventFormError, setEventFormError] = useState('');

  // Toggle to show/hide the stats row at the bottom
  const [showCoverageStats, setShowCoverageStats] = useState(false);

  // Active staff statistics user
  const [selectedStaffStatsUser, setSelectedStaffStatsUser] = useState<User | null>(null);

  // Status transition confirmation state
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<'open' | 'closed' | 'finalized' | null>(null);

  const handleRequestStatusChange = (newStatus: 'open' | 'closed' | 'finalized') => {
    if (newStatus === scheduleStatus) return;
    setStatusConfirmTarget(newStatus);
  };

  // Open event modal
  const handleOpenEventModal = (date: Date) => {
    setSelectedEventDate(date);
    setEditingEventId(null);
    setEventTitle('');
    setEventTime('');
    setEventFormError('');
  };

  // Start editing existing event
  const handleStartEditEvent = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setEventTitle(ev.title);
    setEventTime(ev.time || '');
    setEventFormError('');
  };

  // Save event (create or update)
  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventDate) return;
    if (!eventTitle.trim()) {
      setEventFormError('予定名を入力してください');
      return;
    }

    const dateStr = formatDate(selectedEventDate);
    setEventsData(prev => {
      const currentList = prev[dateStr] || [];
      if (editingEventId) {
        return {
          ...prev,
          [dateStr]: currentList.map(item => 
            item.id === editingEventId 
              ? { ...item, title: eventTitle.trim(), time: eventTime.trim() }
              : item
          )
        };
      } else {
        const newEvent: CalendarEvent = {
          id: `ev-${Date.now()}`,
          title: eventTitle.trim(),
          time: eventTime.trim(),
          createdAt: new Date().toISOString()
        };
        return {
          ...prev,
          [dateStr]: [...currentList, newEvent]
        };
      }
    });

    setEditingEventId(null);
    setEventTitle('');
    setEventTime('');
    setEventFormError('');
  };

  // Delete event
  const handleDeleteEvent = (eventId: string) => {
    if (!selectedEventDate) return;
    if (!window.confirm('この予定を削除しますか？')) return;
    const dateStr = formatDate(selectedEventDate);
    setEventsData(prev => {
      const currentList = prev[dateStr] || [];
      return {
        ...prev,
        [dateStr]: currentList.filter(e => e.id !== eventId)
      };
    });
  };

  const handleConfirmStatusChange = () => {
    if (statusConfirmTarget) {
      setScheduleStatus(statusConfirmTarget);
      setStatusConfirmTarget(null);
    }
  };

  // Manager active shift selection for top bar
  const [selectedShiftCode, setSelectedShiftCode] = useState<ShiftCode | null>('日');



  // Normalize user text inputs into valid ShiftCode
  const normalizeShiftCode = (val: string): ShiftCode => {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-' || trimmed === 'ー' || trimmed === ' ' || trimmed === '消' || trimmed === 'クリア') {
      return '' as ShiftCode;
    }
    
    // Exact match
    const exact = SHIFT_TYPES.find(t => t.code.toLowerCase() === trimmed.toLowerCase());
    if (exact) {
      if (!isManager && RESTRICTED_EMPLOYEE_SHIFTS.includes(exact.code)) return '' as ShiftCode;
      return exact.code as ShiftCode;
    }

    // Smart shortcuts & typing support
    const upper = trimmed.toUpperCase();
    if (upper === 'AM' || upper === 'AM有' || upper === 'AM有給' || trimmed === '午前有給' || trimmed === '午前休' || trimmed === '午前半休') return 'AM有';
    if (upper === 'PM' || upper === 'PM有' || upper === 'PM有給' || trimmed === '午後有給' || trimmed === '午後休' || trimmed === '午後半休') return 'PM有';
    if (upper === 'C' || upper === 'CE') return 'CE';
    if (upper === 'O' || upper === 'OP' || upper === 'OPE') return 'OPE';
    if (upper === 'D' || trimmed === 'に' || trimmed === '日勤') return '日';
    if (upper === 'H' || trimmed === 'は' || trimmed === '早番') return '早';
    if (upper === 'TO' || trimmed === 'とう' || trimmed === '当' || trimmed === '当直') return '当';
    if (upper === 'AK' || trimmed === 'あけ' || trimmed === '明' || trimmed === '明け') return '明';
    if (upper === 'T' || trimmed === 'と' || trimmed === '透析') return '透';
    if (upper === 'K' || trimmed === 'き' || trimmed === '休み' || trimmed === '公休') return '休';
    if (upper === 'Y' || trimmed === 'ゆ' || trimmed === '有給') return '有';
    if (trimmed === 'し' || trimmed === '出張') return '出';

    // Manager-only shifts
    if (isManager) {
      if (upper === 'S' || trimmed === 'さ' || trimmed === '産休') return '産';
      if (trimmed === 'い' || trimmed === '移動') return '移';
      if (trimmed === 'お' || trimmed === '応援') return '応';
    }

    // If matches first character of any valid code
    const firstMatch = SHIFT_TYPES.find(t => t.code && t.code === trimmed[0]);
    if (firstMatch) {
      if (!isManager && RESTRICTED_EMPLOYEE_SHIFTS.includes(firstMatch.code)) return '' as ShiftCode;
      return firstMatch.code as ShiftCode;
    }

    return '' as ShiftCode;
  };

  // Helper to commit shift change directly into cell
  const handleCommitShift = (dateStr: string, userId: string, rawCode: string, optionalMemo?: string, optionalStandby?: boolean) => {
    const code = normalizeShiftCode(rawCode);
    if (!isManager && RESTRICTED_EMPLOYEE_SHIFTS.includes(code)) {
      return;
    }
    setScheduleData(prev => {
      const next = { ...prev };
      if (!next[dateStr]) next[dateStr] = {};
      const existing = next[dateStr][userId] || { request: '', final: '' };
      const memoToSet = optionalMemo !== undefined 
        ? (optionalMemo.trim() ? optionalMemo.trim() : undefined) 
        : existing.memo;
      const standbyToSet = optionalStandby !== undefined 
        ? optionalStandby 
        : (isManager ? !!existing.standby : !!(existing.requestStandby ?? existing.standby));

      if (isManager) {
        next[dateStr][userId] = { ...existing, final: code, memo: memoToSet, standby: standbyToSet };
      } else {
        if (userId === currentUser.id) {
          next[dateStr][userId] = { 
            ...existing, 
            request: code, 
            memo: memoToSet,
            requestStandby: standbyToSet,
            standby: scheduleStatus === 'finalized' ? existing.standby : standbyToSet
          };
        }
      }
      return next;
    });
    // Save and close palette modal
    setEditingCell(null);
  };

  // Helper to toggle standby (待機) for cell
  const handleToggleStandby = (dateStr: string, userId: string, currentStandbyState: boolean) => {
    const newStandby = !currentStandbyState;
    setScheduleData(prev => {
      const next = { ...prev };
      if (!next[dateStr]) next[dateStr] = {};
      const existing = next[dateStr][userId] || { request: '', final: '' };
      if (isManager) {
        next[dateStr][userId] = {
          ...existing,
          standby: newStandby,
        };
      } else {
        if (userId === currentUser.id) {
          next[dateStr][userId] = {
            ...existing,
            requestStandby: newStandby,
            standby: scheduleStatus === 'finalized' ? existing.standby : newStandby,
          };
        }
      }
      return next;
    });
    setEditingCell(prev => prev ? { ...prev, currentStandby: newStandby } : null);
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
    // Save and close palette modal
    setEditingCell(null);
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
      
      {/* Table Header Area - Centered Month Selector */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/50 flex justify-center items-center">
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
      </div>

      {/* Workflow & Status Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 grid grid-cols-1 md:grid-cols-3 items-center gap-3">
        {/* Left: Status indicator */}
        <div className="flex items-center gap-2 justify-start">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">シフト提出状況:</span>
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

        {/* Center: Action controllers (Manager can toggle status, exactly centered) */}
        <div className="flex items-center justify-center">
          {isManager && (
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
              <button
                onClick={() => handleRequestStatusChange('open')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                  scheduleStatus === 'open'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs border border-emerald-200/50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="希望受付を開始します"
              >
                <Clock size={12} />
                <span>受付中</span>
              </button>

              <button
                onClick={() => handleRequestStatusChange('closed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                  scheduleStatus === 'closed'
                    ? 'bg-amber-50 text-amber-700 shadow-xs border border-amber-200/50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="提出を締め切り、管理者調整に入ります"
              >
                <Clock size={12} />
                <span>受付終了</span>
              </button>

              <button
                onClick={() => handleRequestStatusChange('finalized')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                  scheduleStatus === 'finalized'
                    ? 'bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-200/50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="シフトを最終確定し、全員の表示をロックします"
              >
                <Lock size={12} />
                <span>シフト確定</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Show / Hide Coverage Stats Button */}
        <div className="flex items-center justify-end">
          {isManager && (
            <button
              onClick={() => setShowCoverageStats(!showCoverageStats)}
              className={`px-3 py-1.5 border rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 flex items-center space-x-1 ${
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

      {/* Calendar Top Shift Selection Toolbar (管理職専用: カレンダー上部勤務選択ボタン - 中央配置) */}
      {isManager && (
        <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            <span className="text-xs font-bold text-slate-700">勤務選択:</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
            {/* 専用ボタン: パレット入力モード */}
            <button
              type="button"
              onClick={() => setSelectedShiftCode(null)}
              className={`min-h-[32px] py-1 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center border shadow-2xs active:scale-95 select-none ${
                selectedShiftCode === null
                  ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-400 ring-offset-1 font-black shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title="パレット入力モード：マスをクリックしてパレットから勤務を選択したりメモを登録できます"
            >
              <span>パレット入力</span>
            </button>

            <span className="h-4 w-px bg-slate-250 mx-0.5 hidden sm:inline-block" />

            {/* 各勤務ボタン（それぞれ固有の配色を設定・略称文字のみ表示） */}
            {SHIFT_TYPES.map(type => {
              const isSelected = selectedShiftCode === type.code;
              const displayChar = type.code ? (type.buttonDisplay || type.code) : '消';
              return (
                <button
                  key={type.code || 'clear'}
                  type="button"
                  onClick={() => {
                    if (selectedShiftCode === type.code) {
                      setSelectedShiftCode(null);
                    } else {
                      setSelectedShiftCode(type.code);
                    }
                  }}
                  className={`min-h-[32px] min-w-[34px] py-1 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center border shadow-2xs active:scale-95 select-none ${
                    type.color
                  } ${
                    isSelected
                      ? 'ring-2 ring-indigo-600 ring-offset-1 scale-105 border-indigo-500 shadow-xs'
                      : 'hover:brightness-95 hover:shadow-xs'
                  }`}
                  title={`${type.label} (${type.code || '消去'}) を選択（マスをクリックで即反映）`}
                >
                  <span className={`font-black ${displayChar.length > 2 ? 'text-[10px]' : 'text-xs'}`}>
                    {displayChar}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
                const dateStr = formatDate(date);
                const dayEvents = eventsData[dateStr] || [];
                const hasEvents = dayEvents.length > 0;

                return (
                  <th 
                    key={dateStr}
                    onClick={() => handleOpenEventModal(date)}
                    className={`py-1.5 px-0.5 text-center border-r border-slate-200 min-w-[46px] md:min-w-[50px] cursor-pointer select-none transition-all hover:brightness-95 active:scale-95 group/day relative ${
                      isSun || isHoliday 
                        ? 'bg-rose-50 hover:bg-rose-100/90' 
                        : isSat 
                        ? 'bg-blue-50 hover:bg-blue-100/90' 
                        : 'bg-slate-50 hover:bg-slate-100/90'
                    }`}
                    title={
                      hasEvents 
                        ? `【予定あり】${dayEvents.map(e => `${e.title}${e.time ? ` (${e.time})` : ''}`).join(' / ')}（タップして詳細を確認）` 
                        : `${date.getFullYear()}年${date.getMonth() + 1}月${dayNum}日 (${isHoliday ? '祝' : dayLabel}) - タップして予定を確認・登録`
                    }
                  >
                    {/* Day number */}
                    <div className={`font-display font-bold text-xs md:text-sm leading-tight group-hover/day:scale-105 transition-transform ${
                      isSun || isHoliday ? 'text-rose-600' : isSat ? 'text-blue-600' : 'text-slate-800'
                    }`}>
                      {dayNum}
                    </div>

                    {/* Day of week / Holiday label */}
                    <div className={`text-[10px] font-medium leading-none ${
                      isSun || isHoliday ? 'text-rose-500' : isSat ? 'text-blue-500' : 'text-slate-500'
                    }`} title={holidayName || ''}>
                      {isHoliday ? '祝' : dayLabel}
                    </div>

                    {/* Event indicator badge (土日祝日の色付けを損なわない目印) */}
                    <div className="min-h-[14px] mt-0.5 flex items-center justify-center">
                      {hasEvents ? (
                        <span 
                          className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full text-[8.5px] font-black bg-amber-500 text-white shadow-2xs leading-none ring-1 ring-white/90 animate-in fade-in"
                          title={`${dayEvents.length}件の予定あり`}
                        >
                          <span className="w-1 h-1 rounded-full bg-white shrink-0"></span>
                          <span>{dayEvents.length > 1 ? `${dayEvents.length}件` : '予定'}</span>
                        </span>
                      ) : (
                        <span className="w-1 h-1 rounded-full opacity-0 pointer-events-none"></span>
                      )}
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

                          // If manager and a shift is selected in the top bar, commit directly!
                          if (isManager && selectedShiftCode !== null) {
                            handleCommitShift(dateStr, user.id, selectedShiftCode);
                            return;
                          }

                          // General staff (or manager with no shift selected):
                          // Open quick touch palette attached to this cell (マス選択モード)
                          const rect = e.currentTarget.getBoundingClientRect();
                          const currentVal = isManager ? cellData.final : cellData.request;
                          const currentStandby = isManager ? !!cellData.standby : !!(cellData.requestStandby ?? cellData.standby);
                          setCellMemoInput(cellData.memo || '');
                          setEditingCell({
                            dateStr,
                            userId: user.id,
                            userName: user.name,
                            currentValue: currentVal || '',
                            currentMemo: cellData.memo || '',
                            currentStandby,
                            anchorRect: {
                              top: rect.top,
                              left: rect.left,
                              bottom: rect.bottom,
                              right: rect.right,
                            }
                          });
                        }}
                        onDoubleClick={(e) => {
                          if (!isEditable) return;
                          // Allow double click to open detail palette and memo input anytime
                          const rect = e.currentTarget.getBoundingClientRect();
                          const currentVal = isManager ? cellData.final : cellData.request;
                          const currentStandby = isManager ? !!cellData.standby : !!(cellData.requestStandby ?? cellData.standby);
                          setCellMemoInput(cellData.memo || '');
                          setEditingCell({
                            dateStr,
                            userId: user.id,
                            userName: user.name,
                            currentValue: currentVal || '',
                            currentMemo: cellData.memo || '',
                            currentStandby,
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

                          {/* Standby badge (待機) on top-right */}
                          {(isManager ? cellData.standby : (cellData.standby || cellData.requestStandby)) && (
                            <span 
                              className="absolute top-0.5 right-0.5 text-[8px] font-black px-0.5 py-0.2 bg-amber-500 text-white rounded leading-none shadow-2xs z-10"
                              title="待機（オンコール）"
                            >
                              待
                            </span>
                          )}

                          {/* Memo Indicator Icon (📝) on bottom-right */}
                          {cellData.memo && (
                            <span 
                              className="absolute bottom-0 right-0 text-[8px] leading-none select-none drop-shadow-xs"
                            >
                              📝
                            </span>
                          )}

                          {/* Conflict Red Dot Indicator on top-left */}
                          {isConflict && isManager && (
                            <span className="absolute top-0.5 left-0.5 flex h-1.5 w-1.5 z-10">
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
                { code: '当', label: '当直', textColorClass: 'text-indigo-800' },
                { code: '明', label: '明け', textColorClass: 'text-sky-700' },
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

      {/* FLOATING QUICK TOUCH PALETTE AT ACTIVE CELL (完全タッチ操作対応) */}
      <AnimatePresence>
        {editingCell && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-slate-900/10" 
              onClick={() => setEditingCell(null)} 
            />
            <div 
              className="fixed z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150"
              style={(() => {
                if (!editingCell.anchorRect) {
                  return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', minWidth: '360px' };
                }
                const vpW = typeof window !== 'undefined' ? window.innerWidth : 1000;
                const vpH = typeof window !== 'undefined' ? window.innerHeight : 800;
                const pW = 360;
                const pH = isManager ? 280 : 220;
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

              {/* Touch grid of selectable shifts */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {getSelectableShifts(currentUser.role).map(type => {
                  const isCurrent = editingCell.currentValue === type.code;
                  const displayChar = type.buttonDisplay || type.code || '消去';
                  return (
                    <button
                      key={type.code || 'clear'}
                      type="button"
                      onClick={() => {
                        handleCommitShift(editingCell.dateStr, editingCell.userId, type.code, cellMemoInput, editingCell.currentStandby);
                      }}
                      className={`min-h-[44px] py-1.5 px-0.5 rounded-xl text-xs font-black transition-all active:scale-95 flex flex-col items-center justify-center border shadow-2xs select-none ${
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
                      <span className={`font-black leading-tight whitespace-nowrap ${
                        displayChar.length > 2 ? 'text-[11px] tracking-tighter' : displayChar.length > 1 ? 'text-xs tracking-tight' : 'text-sm'
                      }`}>
                        {displayChar}
                      </span>
                      <span className="text-[8px] font-bold leading-tight opacity-75 truncate max-w-full">
                        {type.code ? type.label : 'クリア'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Standby (待機) toggle section: 通常の勤務に加えて「待機」をつける */}
              <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700">通常の勤務に加えて「待機」</span>
                  {editingCell.currentStandby && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                      待機あり
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleStandby(editingCell.dateStr, editingCell.userId, editingCell.currentStandby)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 border shadow-2xs active:scale-95 ${
                    editingCell.currentStandby
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 ring-2 ring-amber-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${editingCell.currentStandby ? 'bg-white' : 'bg-slate-400'}`}></span>
                  <span>{editingCell.currentStandby ? '待機ON' : '待機をつける'}</span>
                </button>
              </div>

              {/* Memo input section for the cell */}
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
            <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl text-xs max-w-xs border border-slate-700/60 animate-in fade-in zoom-in-95 duration-100">
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
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 no-print">
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
                        '当': 0,
                        '明': 0,
                        'CE': 0,
                        'OPE': 0,
                        '透': 0,
                        '有': 0,
                        'AM有': 0,
                        'PM有': 0,
                        'その他': 0,
                      };
                      let standbyCount = 0;

                      daysInMonth.forEach(date => {
                        const dateStr = formatDate(date);
                        const dayData = scheduleData[dateStr]?.[selectedStaffStatsUser.id];
                        const shiftCode = dayData?.final;

                        if (dayData?.standby) {
                          standbyCount++;
                        }

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
                        { label: 'AM有給', code: 'AM有', count: counts['AM有'], color: 'bg-purple-50 text-purple-700 border-purple-200' },
                        { label: 'PM有給', code: 'PM有', count: counts['PM有'], color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                        { label: '日勤', code: '日', count: counts['日'], color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { label: '早番', code: '早', count: counts['早'], color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        { label: '当直', code: '当', count: counts['当'], color: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
                        { label: '明け', code: '明', count: counts['明'], color: 'bg-sky-100 text-sky-800 border-sky-300' },
                        { label: 'CE', code: 'CE', count: counts['CE'], color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
                        { label: 'OPE', code: 'OPE', count: counts['OPE'], color: 'bg-amber-50 text-amber-700 border-amber-200' },
                        { label: '透析', code: '透', count: counts['透'], color: 'bg-teal-50 text-teal-700 border-teal-200' },
                        { label: '待機', code: '待', count: standbyCount, color: 'bg-amber-500 text-white border-amber-600' },
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

      {/* Confirmation Modal for Shift Submission Status Change */}
      <AnimatePresence>
        {statusConfirmTarget && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center gap-2.5 text-slate-800 font-bold text-sm pb-2 border-b border-slate-100">
                <AlertCircle size={18} className="text-amber-500 shrink-0" />
                <span>シフト提出状況の変更確認</span>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                {statusConfirmTarget === 'open' && (
                  <p>
                    シフト提出状況を<strong className="text-emerald-700">「希望受付中」</strong>に変更しますか？<br />
                    スタッフがシフト希望を再度登録・編集できるようになります。
                  </p>
                )}
                {statusConfirmTarget === 'closed' && (
                  <p>
                    シフト提出状況を<strong className="text-amber-700">「受付終了（調整中）」</strong>に変更しますか？<br />
                    一般スタッフによる希望の新規入力・編集は締め切られます。
                  </p>
                )}
                {statusConfirmTarget === 'finalized' && (
                  <p>
                    シフト提出状況を<strong className="text-indigo-700">「シフト確定」</strong>に変更しますか？<br />
                    シフト予定が確定版としてロックされ、全員の画面に最終決定として反映されます。
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusConfirmTarget(null)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStatusChange}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
                >
                  変更する
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EVENT DETAILS & MANAGEMENT MODAL (日付タップで開くイベント確認・管理) */}
      <AnimatePresence>
        {selectedEventDate && (() => {
          const dateStr = formatDate(selectedEventDate);
          const dayEvents = eventsData[dateStr] || [];
          const isSun = selectedEventDate.getDay() === 0;
          const isSat = selectedEventDate.getDay() === 6;
          const isHoliday = isJapaneseHoliday(selectedEventDate);
          const holidayName = getJapaneseHolidayName(selectedEventDate);
          const dayLabel = getDayOfWeek(selectedEventDate);

          return (
            <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-3 sm:p-4 no-print">
              <div className="absolute inset-0" onClick={() => setSelectedEventDate(null)} />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 relative z-10"
              >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold text-slate-900 text-base">
                          {selectedEventDate.getFullYear()}年{selectedEventDate.getMonth() + 1}月{selectedEventDate.getDate()}日 ({dayLabel})
                        </h3>
                        {isHoliday && holidayName && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                            祝日: {holidayName}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {isManager ? 'この日の予定・行事の確認および管理' : 'この日に予定されているイベント・行事'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedEventDate(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Content body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                  
                  {/* Manager Event Direct Input Field (予定を追加する欄をクリックして直接入力) */}
                  {isManager && (
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3">
                      <form onSubmit={handleSaveEvent} className="space-y-2">
                        <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Plus size={13} className="text-indigo-600" />
                            <span>{editingEventId ? '予定を編集' : '予定を追加'}</span>
                          </span>
                          {editingEventId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEventId(null);
                                setEventTitle('');
                                setEventTime('');
                              }}
                              className="text-[11px] text-slate-500 hover:text-slate-700 underline"
                            >
                              新規追加に戻る
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={eventTitle}
                            onChange={(e) => setEventTitle(e.target.value)}
                            placeholder="予定を入力（例: カンファレンス、勉強会、健診 など）"
                            className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                          />
                          <input
                            type="text"
                            value={eventTime}
                            onChange={(e) => setEventTime(e.target.value)}
                            placeholder="時間帯（例: 14:00〜、終日）"
                            className="w-full sm:w-44 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                          />
                          <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs shrink-0 active:scale-95"
                          >
                            {editingEventId ? '更新' : '追加'}
                          </button>
                        </div>
                        {eventFormError && (
                          <p className="text-[11px] text-rose-600 font-medium px-1">
                            {eventFormError}
                          </p>
                        )}
                      </form>
                    </div>
                  )}

                  {/* Registered events list */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span>予定一覧</span>
                        <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.2 rounded-full">
                          {dayEvents.length}件
                        </span>
                      </h4>
                    </div>

                    {dayEvents.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Calendar size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-bold text-slate-600">この日の予定はありません</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dayEvents.map(ev => {
                          return (
                            <div 
                              key={ev.id}
                              className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs hover:shadow-xs transition-shadow flex items-center justify-between gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-3">
                                  <h4 className="font-bold text-slate-900 text-sm leading-snug truncate text-left" title={ev.title}>
                                    {ev.title}
                                  </h4>
                                  {ev.time && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md shrink-0 text-right ml-auto">
                                      <Clock size={11} className="text-indigo-500" />
                                      <span>{ev.time}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Manager actions: Edit / Delete */}
                              {isManager && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditEvent(ev)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="予定を編集"
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEvent(ev.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="予定を削除"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

                {/* Footer */}
                <div className="p-3.5 sm:p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/60">
                  <button
                    type="button"
                    onClick={() => setSelectedEventDate(null)}
                    className="px-5 py-2 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all"
                  >
                    閉じる
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
