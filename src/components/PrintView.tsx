import React, { useState, useEffect, useRef } from 'react';
import { User, ScheduleData } from '../types';
import { SHIFT_TYPES } from '../constants';
import { Printer, ArrowLeft } from 'lucide-react';
import { isJapaneseHoliday } from '../utils';

interface PrintViewProps {
  users: User[];
  daysInMonth: Date[];
  scheduleData: ScheduleData;
  currentDate: Date;
  formatDate: (date: Date) => string;
  getDayOfWeek: (date: Date) => string;
  onExit: () => void;
}

export default function PrintView({
  users,
  daysInMonth,
  scheduleData,
  currentDate,
  formatDate,
  getDayOfWeek,
  onExit,
}: PrintViewProps) {
  const employees = users;

  // View scaling mode: 'fit' (全体表示: 画面幅に収める) or '100' (実寸 100%: 横スクロール)
  const [zoomMode, setZoomMode] = useState<'fit' | '100'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1200) {
      return '100';
    }
    return 'fit';
  });

  const [containerWidth, setContainerWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const [sheetHeight, setSheetHeight] = useState<number>(850);

  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      } else {
        setContainerWidth(window.innerWidth);
      }
      if (sheetRef.current) {
        setSheetHeight(sheetRef.current.offsetHeight);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    const timer = setTimeout(updateDimensions, 100);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timer);
    };
  }, [users, daysInMonth, scheduleData]);

  // Target A4 landscape width in pixels (~297mm at standard 96dpi)
  const A4_WIDTH_PX = 1122;
  const paddingOffset = containerWidth < 640 ? 16 : 32;
  const availableWidth = Math.max(300, containerWidth - paddingOffset);
  const scaleFactor = Math.min(1, availableWidth / A4_WIDTH_PX);

  // Trigger browser print dialog directly
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Interactive print control banner (not printed) */}
      <div className="no-print bg-slate-800 border-b border-slate-700/80 px-3 sm:px-4 py-2 sm:py-2.5 sticky top-0 z-50 shadow-md">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          
          {/* Left: Exit button & Title */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button 
              onClick={onExit}
              className="flex items-center text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-600/80 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all active:scale-95 shadow-xs"
            >
              <ArrowLeft size={14} className="mr-1" />
              <span>戻る</span>
            </button>

            <div className="flex items-center space-x-2 border-l border-slate-700 pl-2 sm:pl-3">
              <div className="p-1 sm:p-1.5 bg-indigo-600 rounded-lg text-white shadow-xs">
                <Printer size={16} />
              </div>
              <h2 className="font-display font-semibold text-white text-xs sm:text-sm">
                印刷プレビュー
              </h2>
            </div>
          </div>
          
          {/* Right: Zoom Mode Switcher & Print Action */}
          <div className="flex items-center space-x-2 sm:space-x-3 ml-auto">
            {/* View Mode Toggle: 全体表示 / 実寸 100% */}
            <div className="flex items-center bg-slate-700/70 p-0.5 rounded-lg border border-slate-600/60 text-[11px] sm:text-xs">
              <button 
                type="button"
                onClick={() => setZoomMode('fit')}
                className={`py-1 px-2.5 rounded-md font-semibold transition-all ${
                  zoomMode === 'fit' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
                title="画面幅に合わせて用紙全体を表示"
              >
                全体表示
              </button>
              <button 
                type="button"
                onClick={() => setZoomMode('100')}
                className={`py-1 px-2.5 rounded-md font-semibold transition-all ${
                  zoomMode === '100' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
                title="実寸100%で表示（横スクロール可能）"
              >
                実寸 (100%)
              </button>
            </div>

            {/* Print Button */}
            <button 
              onClick={handlePrint}
              className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 sm:px-4 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <Printer size={14} className="mr-1 sm:mr-1.5" />
              <span>印刷する</span>
            </button>
          </div>
        </div>

        {/* Small mobile guidance hint when 100% zoom is selected */}
        {zoomMode === '100' && (
          <div className="text-[10px] text-slate-400 text-center pt-1 block sm:hidden">
            横スクロールして確認できます（氏名は左端に固定）
          </div>
        )}
      </div>

      {/* Printable Sheet Area */}
      <div 
        ref={containerRef}
        className="flex-1 bg-slate-200/90 text-slate-900 p-2 sm:p-4 md:p-6 overflow-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div 
          className="w-fit mx-auto print:w-full print:m-0"
          style={
            zoomMode === 'fit' && scaleFactor < 1
              ? {
                  width: `${A4_WIDTH_PX * scaleFactor}px`,
                  height: `${sheetHeight * scaleFactor}px`,
                  overflow: 'hidden',
                }
              : undefined
          }
        >
          <div 
            ref={sheetRef}
            style={
              zoomMode === 'fit' && scaleFactor < 1
                ? {
                    transform: `scale(${scaleFactor})`,
                    transformOrigin: 'top left',
                  }
                : undefined
            }
            className="w-[297mm] min-w-[1080px] shrink-0 bg-white min-h-[210mm] p-6 text-slate-900 shadow-xl border border-slate-300 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:min-w-0 print:transform-none"
          >
            
            {/* Print Header */}
            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-3 mb-5">
              <div>
                <div className="text-xs font-semibold tracking-wider text-slate-500 font-display">
                  WORK SCHEDULE REPORT
                </div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
                  {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月 勤務シフト表
                </h1>
              </div>
              
              {/* Approval stamp area */}
              <div className="flex gap-3 mb-1">
                <div className="border border-slate-400 w-14 h-14 rounded flex flex-col justify-between items-center text-[10px] p-1 select-none">
                  <span className="text-slate-400 border-b border-slate-200 w-full text-center text-[9px]">作成</span>
                  <span className="font-semibold text-slate-700 text-[10px]">山田</span>
                </div>
                <div className="border border-slate-400 w-14 h-14 rounded flex flex-col justify-between items-center text-[10px] p-1 select-none">
                  <span className="text-slate-400 border-b border-slate-200 w-full text-center text-[9px]">承認</span>
                  <div className="w-5 h-5 rounded-full border border-red-500 border-dashed flex items-center justify-center text-[9px] text-red-500 font-bold">
                    印
                  </div>
                </div>
              </div>
            </div>

            {/* Shift Schedule Table */}
            <table className="print-table w-full table-fixed border-collapse border border-slate-800 text-[10px] select-none">
              <thead>
                <tr className="bg-slate-100/90">
                  <th className="border border-slate-800 p-1.5 text-left font-bold text-slate-800 w-[95px] min-w-[95px] sticky left-0 bg-slate-100 z-10 print:static">
                    氏名
                  </th>
                  {daysInMonth.map(date => {
                    const isHoliday = isJapaneseHoliday(date);
                    const isSun = date.getDay() === 0 || isHoliday;
                    const isSat = date.getDay() === 6;
                    const label = getDayOfWeek(date);
                    
                    return (
                      <th 
                        key={formatDate(date)} 
                        className={`border border-slate-800 p-0.5 text-center font-bold min-w-[26px] ${
                          isSun ? 'bg-red-50 text-red-600' : isSat ? 'bg-blue-50 text-blue-600' : 'text-slate-800'
                        }`}
                      >
                        <div className="leading-tight text-[10px]">{date.getDate()}</div>
                        <div className="text-[7.5px] font-medium leading-none">{isHoliday ? '祝' : label}</div>
                      </th>
                    );
                  })}
                  <th className="border border-slate-800 p-1 text-center font-bold bg-slate-50 text-slate-700 w-[32px] min-w-[32px] text-[8.5px]">
                    出勤
                  </th>
                  <th className="border border-slate-800 p-1 text-center font-bold bg-slate-50 text-slate-700 w-[32px] min-w-[32px] text-[8.5px]">
                    休み
                  </th>
                  <th className="border border-slate-800 p-1 text-center font-bold bg-slate-50 text-slate-700 w-[32px] min-w-[32px] text-[8.5px]">
                    有休
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map(user => {
                  let workCount = 0;
                  let offCount = 0;
                  let leaveCount = 0;

                  return (
                    <tr key={user.id} className="h-8">
                      <td className="border border-slate-800 p-1.5 font-bold text-slate-800 text-[11px] truncate w-[95px] min-w-[95px] max-w-[95px] sticky left-0 bg-white z-10 print:static shadow-[1px_0_0_0_#1e293b]">
                        {user.name}
                      </td>
                      
                      {daysInMonth.map(date => {
                        const dateStr = formatDate(date);
                        const finalShift = scheduleData[dateStr]?.[user.id]?.final || '';
                        
                        if (finalShift === '休') offCount++;
                        else if (finalShift === '有' || finalShift === '産' || finalShift === 'AM有' || finalShift === 'PM有') leaveCount++;
                        else if (finalShift) workCount++;

                        return (
                          <td 
                            key={dateStr} 
                            className={`border border-slate-800 text-center font-bold h-8 min-w-[26px] p-0 ${
                              finalShift === '休' 
                                ? 'text-red-600 bg-red-50/30' 
                                : finalShift === '有' || finalShift === '産'
                                ? 'text-violet-700 bg-violet-50/30'
                                : finalShift
                                ? 'text-slate-900'
                                : 'text-slate-300'
                            }`}
                          >
                            <span className={finalShift.length > 2 ? 'text-[8.5px] tracking-tighter leading-none' : 'text-[11px]'}>
                              {finalShift || ''}
                            </span>
                          </td>
                        );
                      })}

                      {/* Stats totals in printed columns */}
                      <td className="border border-slate-800 text-center font-mono font-bold text-slate-700 bg-slate-50 text-[10px]">
                        {workCount}
                      </td>
                      <td className="border border-slate-800 text-center font-mono font-bold text-red-600 bg-slate-50 text-[10px]">
                        {offCount}
                      </td>
                      <td className="border border-slate-800 text-center font-mono font-bold text-violet-700 bg-slate-50 text-[10px]">
                        {leaveCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Print Footer / Legend */}
            <div className="mt-6 flex justify-between items-start text-slate-500 text-[9px]">
              <div>
                <span className="font-bold block text-slate-700 mb-1">【凡例】</span>
                <div className="flex flex-wrap gap-x-3.5 gap-y-1">
                  {SHIFT_TYPES.filter(t => t.code).map(t => (
                    <span key={t.code}>
                      <strong className="text-slate-800">{t.code}</strong>: {t.label}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="text-right shrink-0">
                <span className="block font-medium">作成日: {new Date().toLocaleDateString('ja-JP')}</span>
                <span className="block text-slate-400">勤務管理システム 印刷フォーマット</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
