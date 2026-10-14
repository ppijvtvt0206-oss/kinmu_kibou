export type UserRole = 'manager' | 'employee';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  loginId: string;
}

export type ShiftCode = '休' | '日' | '早' | 'CE' | 'OPE' | '透' | '有' | '産' | '出' | '移' | '応' | '';

export interface ShiftType {
  code: ShiftCode;
  label: string;
  color: string; // Tailwind class
  bgClass: string;
  textColor: string;
  borderClass: string;
}

export interface ShiftData {
  request: string;
  final: string;
  confirmed?: boolean;
  memo?: string; // 勤務希望の詳細・備考メモ
}

export interface DailySchedule {
  [userId: string]: ShiftData;
}

export interface ScheduleData {
  [dateStr: string]: DailySchedule;
}
