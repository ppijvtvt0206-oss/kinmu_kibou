import React from 'react';
import { User, ShiftType, ScheduleData } from '../types';
import { SHIFT_TYPES } from '../constants';
import { Printer, ArrowLeft, CheckCircle2 } from 'lucide-react';
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

  // Trigger browser print dialog directly
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Interactive print control banner (not printed) */}
      <div className="no-print bg-slate-850 border-b border-slate-700/60 px-4 py-3 sticky top-0 z-50 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-xl text-white">
            <Printer size={20} />
          </div>
          <div>
            <h2 className="font-display font-semibold text-white text-sm md:text-base">印刷プレビュー・出力モード</h2>
            <p className="text-[11px] text-slate-400">
              ブラウザの印刷機能を使用して A4 横（Landscape）サイズで綺麗に印刷することができます
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={onExit}
            className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 py-2 px-4 rounded-xl text-xs font-semibold transition-all active:scale-95"
          >
            <ArrowLeft size={14} className="mr-1.5" />
            カレンダーへ戻る
          </button>

          <button 
            onClick={handlePrint}
            className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-5 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95"
          >
            <Printer size={14} className="mr-1.5" />
            印刷ダイアログを開く
          </button>
        </div>
      </div>

      {/* Printable Sheet Area */}
      <div className="flex-1 bg-white text-slate-900 p-8 overflow-auto flex justify-center">
        <div className="w-[297mm] bg-white min-h-[210mm] p-6 text-slate-900 print:p-0 print:m-0 print:shadow-none">
          
          {/* Print Header */}
          <div className="flex justify-between items-end border-b-2 border-slate-900 pb-3 mb-6">
            <div>
              <div className="text-sm font-semibold tracking-wider text-slate-500 font-display">
                WORK SCHEDULE REPORT
              </div>
              <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
                {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月 勤務シフト表
              </h1>
            </div>
            
            {/* Approval stamp area */}
            <div className="flex gap-4 mb-1">
              <div className="border border-slate-400 w-16 h-16 rounded flex flex-col justify-between items-center text-[10px] p-1 select-none">
                <span className="text-slate-400 border-b border-slate-200 w-full text-center">作成</span>
                <span className="font-semibold text-slate-500">山田</span>
              </div>
              <div className="border border-slate-400 w-16 h-16 rounded flex flex-col justify-between items-center text-[10px] p-1 select-none">
                <span className="text-slate-400 border-b border-slate-200 w-full text-center">承認</span>
                <div className="w-4 h-4 rounded-full border border-red-400 border-dashed flex items-center justify-center text-[8px] text-red-500 font-bold scale-90">
                  印
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="print-table w-full table-fixed border-collapse border border-slate-800 text-[10px] select-none">
            <thead>
              <tr className="bg-slate-100/80">
                <th className="border border-slate-800 p-2 text-left font-bold text-slate-800 w-[90px]">
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
                      className={`border border-slate-800 p-1 text-center font-bold ${
                        isSun ? 'bg-red-50 text-red-600' : isSat ? 'bg-blue-50 text-blue-600' : 'text-slate-800'
                      }`}
                    >
                      <div className="leading-tight">{date.getDate()}</div>
                      <div className="text-[7.5px] font-medium leading-none">{isHoliday ? '祝' : label}</div>
                    </th>
                  );
                })}
                <th className="border border-slate-800 p-1 text-center font-bold bg-slate-50 text-slate-700 w-[32px] text-[8.5px]">
                  出勤
                </th>
                <th className="border border-slate-800 p-1 text-center font-bold bg-slate-50 text-slate-700 w-[32px] text-[8.5px]">
                  休み
                </th>
                <th className="border border-slate-800 p-1 text-center font-bold bg-slate-50 text-slate-700 w-[32px] text-[8.5px]">
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
                    <td className="border border-slate-800 p-2 font-bold text-slate-800 text-[11px]">
                      {user.name}
                    </td>
                    
                    {daysInMonth.map(date => {
                      const dateStr = formatDate(date);
                      const finalShift = scheduleData[dateStr]?.[user.id]?.final || '';
                      
                      if (finalShift === '休') offCount++;
                      else if (finalShift === '有' || finalShift === '産') leaveCount++;
                      else if (finalShift) workCount++;

                      return (
                        <td 
                          key={dateStr} 
                          className={`border border-slate-800 text-center font-bold text-xs h-8 ${
                            finalShift === '休' ? 'text-red-600 bg-red-50/20' : 'text-slate-850'
                          }`}
                        >
                          {finalShift || ''}
                        </td>
                      );
                    })}

                    {/* Stats totals in printed columns */}
                    <td className="border border-slate-800 text-center font-mono font-bold text-slate-700 bg-slate-50">
                      {workCount}
                    </td>
                    <td className="border border-slate-800 text-center font-mono font-bold text-red-600 bg-slate-50">
                      {offCount}
                    </td>
                    <td className="border border-slate-800 text-center font-mono font-bold text-violet-700 bg-slate-50">
                      {leaveCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Print Footer / Notes */}
          <div className="mt-8 flex justify-between items-start text-slate-500 text-[9px]">
            <div>
              <span className="font-bold block text-slate-700 mb-1">【凡例】</span>
              <div className="flex gap-4">
                {SHIFT_TYPES.filter(t => t.code).map(t => (
                  <span key={t.code}>
                    <strong className="text-slate-800">{t.code}</strong>: {t.label}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="text-right">
              <span className="block font-medium">作成日: {new Date().toLocaleDateString('ja-JP')}</span>
              <span className="block text-slate-400">勤務管理システム 印刷フォーマット</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
