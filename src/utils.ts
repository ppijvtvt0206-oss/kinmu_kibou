/**
 * 日本の祝日判定ユーティリティ
 */

export function getJapaneseHolidayName(date: Date): string | null {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = date.getDay();

  // 特定の日付固定の祝日
  if (m === 1 && d === 1) return '元日';
  if (m === 2 && d === 11) return '建国記念の日';
  if (m === 2 && d === 23) return '天皇誕生日';
  if (m === 4 && d === 29) return '昭和の日';
  if (m === 5 && d === 3) return '憲法記念日';
  if (m === 5 && d === 4) return 'みどりの日';
  if (m === 5 && d === 5) return 'こどもの日';
  if (m === 8 && d === 11) return '山の日';
  if (m === 11 && d === 3) return '文化の日';
  if (m === 11 && d === 23) return '勤労感謝の日';

  // ハッピーマンデー（第2月曜日、第3月曜日）
  const getNthMonday = (year: number, month: number, n: number): number => {
    const dayOfWeekOfFirst = new Date(year, month - 1, 1).getDay();
    const firstMon = 1 + ((1 - dayOfWeekOfFirst + 7) % 7);
    return firstMon + 7 * (n - 1);
  };

  if (m === 1 && d === getNthMonday(y, 1, 2)) return '成人の日';
  if (m === 7 && d === getNthMonday(y, 7, 3)) return '海の日';
  if (m === 9 && d === getNthMonday(y, 9, 3)) return '敬老の日';
  if (m === 10 && d === getNthMonday(y, 10, 2)) return 'スポーツの日';

  // 春分の日・秋分の日の簡易計算 (2000〜2099年)
  if (m === 3) {
    let equinox = 20;
    const mod = y % 4;
    if (y >= 2000 && y <= 2099) {
      if (mod === 0 || mod === 1) equinox = 20;
      else equinox = 21;
      if (y === 2026) equinox = 20; // 2026年は3/20が春分の日
    }
    if (d === equinox) return '春分の日';
  }

  if (m === 9) {
    let equinox = 23;
    const mod = y % 4;
    if (y >= 2000 && y <= 2099) {
      if (mod === 0) equinox = 22;
      else equinox = 23;
      if (y === 2026) equinox = 23; // 2026年は9/23が秋分の日
    }
    if (d === equinox) return '秋分の日';
  }

  // 国民の休日（敬老の日と秋分の日に挟まれた平日）
  if (m === 9) {
    const monday = getNthMonday(y, 9, 3);
    let autumnEquinox = 23;
    const mod = y % 4;
    if (mod === 0) autumnEquinox = 22;
    if (autumnEquinox === monday + 2 && d === monday + 1) {
      return '国民の休日';
    }
  }

  // 5月の憲法記念日連休の振替休日ルール：
  // 5/3, 5/4, 5/5 のいずれかが日曜日の場合、5/6が振替休日になる。
  if (m === 5 && d === 6) {
    const day3 = new Date(y, 4, 3).getDay();
    const day4 = new Date(y, 4, 4).getDay();
    const day5 = new Date(y, 4, 5).getDay();
    if (day3 === 0 || day4 === 0 || day5 === 0) {
      return '振替休日';
    }
  }

  // 一般的な単一祝日の振替休日：
  // 前日が日曜かつ祝日なら、月曜は振替休日
  const prevDate = new Date(y, m - 1, d - 1);
  if (w === 1 && getJapaneseHolidayName(prevDate) !== null) {
    return '振替休日';
  }

  return null;
}

export function isJapaneseHoliday(date: Date): boolean {
  return getJapaneseHolidayName(date) !== null;
}

export function getShiftTextColor(code?: string): string {
  switch (code) {
    case '休': return 'text-rose-600 font-black';
    case '日': return 'text-blue-700 font-bold';
    case '早': return 'text-emerald-700 font-bold';
    case 'CE': return 'text-cyan-700 font-black';
    case 'OPE': return 'text-amber-700 font-black';
    case '透': return 'text-teal-700 font-bold';
    case '有': return 'text-violet-700 font-bold';
    case '産': return 'text-fuchsia-700 font-bold';
    case '出': return 'text-yellow-800 font-bold';
    case '移': return 'text-slate-700 font-bold';
    case '応': return 'text-lime-700 font-bold';
    default: return 'text-slate-700 font-bold';
  }
}

export function getShiftCellBg(date: Date, shiftCode?: string): string {
  if (shiftCode === '休') return 'bg-rose-50/50 hover:bg-rose-100/50';
  if (shiftCode === '有') return 'bg-violet-50/35 hover:bg-violet-100/45';
  if (shiftCode === '産') return 'bg-fuchsia-50/35 hover:bg-fuchsia-100/45';

  const day = date.getDay();
  const isHoliday = isJapaneseHoliday(date);
  if (day === 0 || isHoliday) return 'bg-rose-50/30 hover:bg-rose-100/30';
  if (day === 6) return 'bg-blue-50/30 hover:bg-blue-100/30';
  return 'bg-white hover:bg-slate-50/80';
}
