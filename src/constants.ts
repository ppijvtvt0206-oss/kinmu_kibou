import { User, ShiftType, ScheduleData } from './types';

export const INITIAL_USERS: User[] = [
  { id: 'u99', name: '山田 施設長', role: 'manager', loginId: 'admin' },
  { id: 'u1', name: '佐藤 健一', role: 'employee', loginId: '1001' },
  { id: 'u2', name: '鈴木 花子', role: 'employee', loginId: '1002' },
  { id: 'u3', name: '高橋 大輔', role: 'employee', loginId: '1003' },
  { id: 'u4', name: '田中 美咲', role: 'employee', loginId: '1004' },
  { id: 'u5', name: '渡辺 翔太', role: 'employee', loginId: '1005' },
  { id: 'u6', name: '小林 裕子', role: 'employee', loginId: '1006' },
  { id: 'u7', name: '加藤 恵', role: 'employee', loginId: '1007' },
  { id: 'u8', name: '吉田 翼', role: 'employee', loginId: '1008' },
  { id: 'u9', name: '山田 陽介', role: 'employee', loginId: '1009' },
  { id: 'u10', name: '佐々木 翔', role: 'employee', loginId: '1010' },
  { id: 'u11', name: '山口 結衣', role: 'employee', loginId: '1011' },
  { id: 'u12', name: '松本 陸', role: 'employee', loginId: '1012' },
  { id: 'u13', name: '井上 真央', role: 'employee', loginId: '1013' },
  { id: 'u14', name: '木村 拓哉', role: 'employee', loginId: '1014' },
];

export const SHIFT_TYPES: ShiftType[] = [
  { code: '', label: '未定', color: 'bg-slate-50 text-slate-400 border-slate-100', bgClass: 'bg-slate-50 hover:bg-slate-100/80', textColor: 'text-slate-400', borderClass: 'border-slate-200' },
  { code: '休', label: '休み', color: 'bg-rose-50 text-rose-700 border-rose-200', bgClass: 'bg-rose-50 hover:bg-rose-100/80', textColor: 'text-rose-700', borderClass: 'border-rose-200' },
  { code: '日', label: '日勤', color: 'bg-blue-50 text-blue-700 border-blue-200', bgClass: 'bg-blue-50 hover:bg-blue-100/80', textColor: 'text-blue-700', borderClass: 'border-blue-200' },
  { code: '早', label: '早番', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', bgClass: 'bg-emerald-50 hover:bg-emerald-100/80', textColor: 'text-emerald-700', borderClass: 'border-emerald-200' },
  { code: 'CE', label: 'CE', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', bgClass: 'bg-cyan-50 hover:bg-cyan-100/80', textColor: 'text-cyan-700', borderClass: 'border-cyan-200' },
  { code: 'OPE', label: 'OPE', color: 'bg-amber-50 text-amber-700 border-amber-200', bgClass: 'bg-amber-50 hover:bg-amber-100/80', textColor: 'text-amber-700', borderClass: 'border-amber-200' },
  { code: '透', label: '透析', color: 'bg-teal-50 text-teal-700 border-teal-200', bgClass: 'bg-teal-50 hover:bg-teal-100/80', textColor: 'text-teal-700', borderClass: 'border-teal-200' },
  { code: '有', label: '有給', color: 'bg-violet-50 text-violet-700 border-violet-200', bgClass: 'bg-violet-50 hover:bg-violet-100/80', textColor: 'text-violet-700', borderClass: 'border-violet-200' },
  { code: '産', label: '産休', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', bgClass: 'bg-fuchsia-50 hover:bg-fuchsia-100/80', textColor: 'text-fuchsia-700', borderClass: 'border-fuchsia-200' },
  { code: '出', label: '出張', color: 'bg-yellow-50 text-yellow-850 border-yellow-200', bgClass: 'bg-yellow-50 hover:bg-yellow-100/80', textColor: 'text-yellow-850', borderClass: 'border-yellow-200' },
  { code: '移', label: '移動', color: 'bg-slate-100 text-slate-700 border-slate-200', bgClass: 'bg-slate-100 hover:bg-slate-200/80', textColor: 'text-slate-700', borderClass: 'border-slate-300' },
  { code: '応', label: '応援', color: 'bg-lime-50 text-lime-700 border-lime-200', bgClass: 'bg-lime-50 hover:bg-lime-100/80', textColor: 'text-lime-700', borderClass: 'border-lime-200' },
];

// Seed some schedules for May 2026 to make it instantly rich and informative.
export const INITIAL_SCHEDULE: ScheduleData = {
  '2026-05-01': {
    'u1': { request: '日', final: '日' },
    'u2': { request: '早', final: '早' },
    'u3': { request: 'CE', final: 'CE' },
    'u4': { request: 'OPE', final: 'OPE' },
    'u5': { request: '休', final: '休' },
    'u6': { request: '日', final: '日' },
  },
  '2026-05-02': { // Saturday
    'u1': { request: '休', final: '休' },
    'u2': { request: '日', final: '日' },
    'u3': { request: '休', final: '休' },
    'u4': { request: '日', final: '日' },
    'u5': { request: '早', final: '早' },
    'u6': { request: 'CE', final: '' },
  },
  '2026-05-03': { // Sunday
    'u1': { request: '休', final: '休' },
    'u2': { request: '休', final: '休' },
    'u3': { request: '日', final: '日' },
    'u4': { request: 'CE', final: 'CE' },
    'u5': { request: 'OPE', final: 'OPE' },
    'u6': { request: '早', final: '' },
  },
  '2026-05-04': {
    'u1': { request: '日', final: '日' },
    'u2': { request: 'CE', final: 'CE' },
    'u3': { request: '早', final: '早' },
    'u4': { request: '休', final: '休' },
    'u5': { request: '日', final: '日' },
    'u6': { request: 'OPE', final: 'OPE' },
  },
  '2026-05-05': {
    'u1': { request: '早', final: '早' },
    'u2': { request: '日', final: '日' },
    'u3': { request: 'CE', final: 'CE' },
    'u4': { request: '休', final: '休' },
    'u5': { request: '休', final: '休' },
    'u6': { request: '日', final: '' },
  },
  '2026-05-06': {
    'u1': { request: 'CE', final: '' },
    'u2': { request: '休', final: '' },
    'u3': { request: 'OPE', final: '' },
    'u4': { request: '日', final: '' },
    'u5': { request: '日', final: '' },
    'u6': { request: '早', final: '' },
  },
  '2026-05-07': {
    'u1': { request: '日', final: '' },
    'u2': { request: '早', final: '' },
    'u3': { request: '日', final: '' },
    'u4': { request: 'CE', final: '' },
    'u5': { request: 'OPE', final: '' },
    'u6': { request: '休', final: '' },
  }
};
