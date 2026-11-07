export type UserRole = 'manager' | 'employee';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  password?: string;
  isInitialPassword?: boolean;
  loginId?: string;
}

export type ShiftCode = '休' | '日' | '早' | '当' | '明' | 'CE' | 'OPE' | '透' | '有' | 'AM有' | 'PM有' | '産' | '出' | '移' | '応' | '';

export interface ShiftType {
  code: ShiftCode;
  label: string;
  buttonDisplay?: string;
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
  standby?: boolean; // 通常の勤務に加えて設定される待機（オンコール）
  requestStandby?: boolean; // 勤務希望時の待機フラグ
}

export interface DailySchedule {
  [userId: string]: ShiftData;
}

export interface ScheduleData {
  [dateStr: string]: DailySchedule;
}

export type EventCategory = 'meeting' | 'training' | 'event' | 'other';

export interface CalendarEvent {
  id: string;
  title: string;
  time?: string;
  category?: EventCategory;
  memo?: string;
  createdAt?: string;
}

export interface EventsData {
  [dateStr: string]: CalendarEvent[];
}
