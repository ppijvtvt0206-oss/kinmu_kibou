import React, { useState, useEffect } from 'react';
import { User, ScheduleData, ShiftCode } from './types';
import { INITIAL_USERS, INITIAL_SCHEDULE, SHIFT_TYPES } from './constants';
import ShiftTable from './components/ShiftTable';
import UserManagement from './components/UserManagement';
import PrintView from './components/PrintView';
import { 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  LogOut, 
  Printer, 
  PlusCircle, 
  Users, 
  X, 
  Lock, 
  ArrowLeft, 
  ClipboardList, 
  KeyRound, 
  ChevronRight, 
  Sparkles, 
  Check, 
  ShieldAlert, 
  ChevronDown,
  Undo2,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // --- Persistent States ---
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('shift_users');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure we have at least 15 users (manager + 14 employees) and we have u14.
      // If not, replace with INITIAL_USERS so the staff expansion is immediately visible.
      if (parsed.length < INITIAL_USERS.length || !parsed.some((u: any) => u.id === 'u14')) {
        return INITIAL_USERS;
      }
      return parsed;
    }
    return INITIAL_USERS;
  });



  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('shift_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [scheduleData, setScheduleData] = useState<ScheduleData>(() => {
    const saved = localStorage.getItem('shift_schedule');
    const data: ScheduleData = saved ? JSON.parse(saved) : INITIAL_SCHEDULE;
    
    // Auto-clean any legacy shift codes ('遅', '夜')
    let migrated = false;
    Object.keys(data).forEach(dateStr => {
      Object.keys(data[dateStr]).forEach(userId => {
        const cell = data[dateStr][userId] as any;
        if (cell.request === '遅' || cell.request === '夜') {
          cell.request = '';
          migrated = true;
        }
        if (cell.final === '遅' || cell.final === '夜') {
          cell.final = '';
          migrated = true;
        }
      });
    });

    if (migrated) {
      localStorage.setItem('shift_schedule', JSON.stringify(data));
    }
    return data;
  });

  // Default month: May 2026 (index 4)
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const saved = localStorage.getItem('shift_current_date');
    return saved ? new Date(saved) : new Date(2026, 4, 1);
  });

  const [activeTab, setActiveTab] = useState<string>('calendar');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Shift schedule operational status (per month)
  type MonthStatusMap = { [yearMonth: string]: 'open' | 'closed' | 'finalized' };
  const [monthStatusMap, setMonthStatusMap] = useState<MonthStatusMap>(() => {
    const saved = localStorage.getItem('shift_month_status');
    if (saved) {
      return JSON.parse(saved);
    }
    const legacyStatus = localStorage.getItem('shift_schedule_status') as 'open' | 'closed' | 'finalized';
    if (legacyStatus) {
      return { '2026-05': legacyStatus }; // migrate to default month for legacy
    }
    return {};
  });

  const currentYearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const scheduleStatus = monthStatusMap[currentYearMonth] || 'open';

  const setScheduleStatus = (newStatus: 'open' | 'closed' | 'finalized') => {
    setMonthStatusMap(prev => ({
      ...prev,
      [currentYearMonth]: newStatus
    }));
  };

  // Success Notification state
  const [notification, setNotification] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Forms
  const [requestForm, setRequestForm] = useState({ date: '2026-05-01', shiftCode: '休' as ShiftCode, memo: '' });
  const [userForm, setUserForm] = useState({ name: '', loginId: '', role: 'employee' as 'manager' | 'employee' });

  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [userFormError, setUserFormError] = useState('');

  const [daysInMonth, setDaysInMonth] = useState<Date[]>([]);

  // Synchronize localStorage
  useEffect(() => {
    localStorage.setItem('shift_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('shift_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('shift_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('shift_schedule', JSON.stringify(scheduleData));
  }, [scheduleData]);

  useEffect(() => {
    localStorage.setItem('shift_current_date', currentDate.toISOString());
  }, [currentDate]);

  useEffect(() => {
    localStorage.setItem('shift_month_status', JSON.stringify(monthStatusMap));
  }, [monthStatusMap]);

  // Toast auto-clear
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Compute days of the current month
  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days: Date[] = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    setDaysInMonth(days);
    
    // Default the datepicker to the first of current month
    const defaultDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    setRequestForm(prev => ({ ...prev, date: defaultDateStr }));
  }, [currentDate]);

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getDayOfWeek = (date: Date): string => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  // Reset all to default system seed data
  const handleResetToDefault = () => {
    if (window.confirm('全てのシフトデータ、およびスタッフアカウントを初期状態にリセットしますか？')) {
      setUsers(INITIAL_USERS);
      setScheduleData(INITIAL_SCHEDULE);
      setCurrentDate(new Date(2026, 4, 1));
      setNotification('システムデータを初期状態に戻しました');
    }
  };

  // --- Auth Processing ---
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = loginInput.trim();
    if (!rawInput) {
      setLoginError('スタッフ名を選択してください');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    // Smooth authentication verification
    setTimeout(() => {
      // 1. Direct match by name, id, or loginId
      let foundUser = users.find(u => 
        u.name === rawInput || 
        u.id === rawInput || 
        u.loginId === rawInput
      );

      // 2. Normalized match as fallback (removing spaces, case-insensitive)
      if (!foundUser) {
        const cleanInput = rawInput.replace(/[\s\u3000]+/g, '').toLowerCase();
        foundUser = users.find(u => {
          const cleanName = u.name.replace(/[\s\u3000]+/g, '').toLowerCase();
          const cleanId = u.loginId.replace(/[\s\u3000]+/g, '').toLowerCase();
          return cleanName === cleanInput || cleanId === cleanInput;
        });
      }

      if (foundUser) {
        setCurrentUser(foundUser);
        setLoginInput('');
        setPasswordInput('');
        setLoginError('');
        setActiveTab('calendar');
        setNotification(`${foundUser.name}（${foundUser.role === 'manager' ? '管理者' : '職員'}）としてログインしました`);
      } else {
        setLoginError('スタッフ名またはパスワードが正しくありません。再度ご確認ください。');
      }
      setIsLoggingIn(false);
    }, 200);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setNotification('ログアウトしました');
  };

  // --- Core Requests ---
  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !requestForm.date || !requestForm.shiftCode) return;
    
    setScheduleData(prev => {
      const newData = { ...prev };
      const dateStr = requestForm.date;
      if (!newData[dateStr]) newData[dateStr] = {};
      const existing = newData[dateStr][currentUser.id] || { request: '', final: '' };
      newData[dateStr][currentUser.id] = {
        ...existing,
        request: requestForm.shiftCode,
        ...(requestForm.memo.trim() ? { memo: requestForm.memo.trim() } : {}),
      };
      return newData;
    });

    setIsRequestModalOpen(false);
    setRequestForm(prev => ({ ...prev, memo: '' }));
    setNotification(`${requestForm.date}の希望を【${requestForm.shiftCode}】として登録しました`);
  };

  // --- Staff Operations ---
  const openUserModal = (user: User | null = null) => {
    setUserFormError('');
    if (user) {
      setEditingUser(user);
      setUserForm({ name: user.name, loginId: user.loginId, role: user.role });
    } else {
      setEditingUser(null);
      setUserForm({ name: '', loginId: '', role: 'employee' });
    }
    setIsUserModalOpen(true);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.loginId.trim()) return;
    
    const trimmedId = userForm.loginId.trim();
    
    // Check duplication
    const isDuplicate = users.some(
      u => u.loginId === trimmedId && (!editingUser || u.id !== editingUser.id)
    );

    if (isDuplicate) {
      setUserFormError('このログインIDはすでに別のスタッフに割り当てられています。');
      return;
    }

    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...userForm, loginId: trimmedId } : u));
      if (currentUser?.id === editingUser.id) {
        setCurrentUser(prev => prev ? { ...prev, ...userForm, loginId: trimmedId } : null);
      }
      setNotification('スタッフ情報を更新しました');
    } else {
      const newUser: User = {
        id: `u${Date.now()}`,
        name: userForm.name.trim(),
        loginId: trimmedId,
        role: userForm.role,
      };
      setUsers(prev => [...prev, newUser]);
      setNotification('新規スタッフを登録しました');
    }
    setIsUserModalOpen(false);
  };

  const deleteUser = (userId: string) => {
    if (currentUser && userId === currentUser.id) {
      alert("ご自身の現在のアカウントは削除できません");
      return;
    }
    if (window.confirm("このスタッフをデータベースから削除しますか？紐づく表示行も消去されます。")) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      setNotification('スタッフを削除しました');
    }
  };

  // ==========================================
  // VIEW: Print Screen
  // ==========================================
  if (activeTab === 'print' && currentUser?.role === 'manager') {
    return (
      <PrintView 
        users={users}
        daysInMonth={daysInMonth}
        scheduleData={scheduleData}
        currentDate={currentDate}
        formatDate={formatDate}
        getDayOfWeek={getDayOfWeek}
        onExit={() => setActiveTab('calendar')}
      />
    );
  }

  // ==========================================
  // VIEW: Login Page
  // ==========================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
        
        {/* Subtle grid elements / decorations */}
        <div className="absolute inset-0 bg-[radial-gradient(#312e81_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 z-10 relative">
          
          {/* Organization & Header */}
          <div className="flex flex-col items-center mb-7">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold mb-3.5">
              <Building2 size={13} className="text-indigo-600" />
              <span>医療・福祉施設 総合管理ポータル</span>
            </div>
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl mb-3 shadow-sm border border-indigo-100/50">
              <CalendarIcon size={28} />
            </div>
            <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight text-center">
              勤務希望・シフト提出システム
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Staff Name Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 tracking-wider mb-1.5">
                スタッフ名
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 z-10">
                  <UserIcon size={17} />
                </div>
                <select 
                  value={loginInput}
                  onChange={(e) => { setLoginInput(e.target.value); setLoginError(''); }}
                  className={`w-full bg-slate-50 border rounded-xl pl-10 pr-10 py-3 text-base font-medium focus:ring-3 focus:outline-none transition-all appearance-none cursor-pointer ${
                    loginError 
                      ? 'border-rose-300 focus:ring-rose-100 bg-rose-50/50' 
                      : 'border-slate-200 focus:ring-indigo-100 focus:border-indigo-500'
                  } ${!loginInput ? 'text-slate-400' : 'text-slate-800'}`}
                >
                  <option value="" disabled className="text-slate-400">
                    スタッフ名を選択してください
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.name} className="py-1 text-slate-800">
                      {u.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 tracking-wider uppercase">
                  パスワード
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordModalOpen(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline transition-colors font-medium"
                >
                  パスワードをお忘れの場合
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={17} />
                </div>
                <input 
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => { setPasswordInput(e.target.value); setLoginError(''); }}
                  className={`w-full bg-slate-50 border rounded-xl pl-10 pr-10 py-3 text-slate-800 font-mono text-base focus:ring-3 focus:outline-none transition-all ${
                    loginError 
                      ? 'border-rose-300 focus:ring-rose-100 bg-rose-50/50' 
                      : 'border-slate-200 focus:ring-indigo-100 focus:border-indigo-500'
                  }`}
                  placeholder="パスワードを入力"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center pt-1">
              <label className="flex items-center text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mr-2"
                />
                <span>ログイン状態を保持する</span>
              </label>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0 text-rose-600" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-md hover:shadow-indigo-500/20 active:scale-98 disabled:opacity-75 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>認証中...</span>
                </>
              ) : (
                <span>ログイン</span>
              )}
            </button>
          </form>
        </div>

        {/* Forgot Password Modal */}
        <AnimatePresence>
          {isForgotPasswordModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <Lock size={17} className="text-indigo-600" />
                    <span>スタッフ名・パスワードの確認について</span>
                  </div>
                  <button 
                    onClick={() => setIsForgotPasswordModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                  <p>
                    セキュリティ保護のため、パスワードの再発行およびスタッフ名の照会は、所属施設のシフト管理者またはシステム統括窓口にて承っております。
                  </p>
                  
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5 font-sans">
                    <div className="font-bold text-slate-800">【施設内 お問い合わせ窓口】</div>
                    <div className="text-slate-600">担当：シフト管理統括担当（山田 施設長）</div>
                    <div className="text-slate-600">内線番号：<span className="font-mono font-bold text-indigo-600">8100</span></div>
                    <div className="text-[11px] text-slate-500">※ 受付時間：平日 8:30 ～ 17:30</div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    ※ 職員証をご用意の上、担当者まで直接お申し出ください。
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setIsForgotPasswordModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
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

  // ==========================================
  // VIEW: Dashboard & Header (Logged In)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800 relative">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white py-3 px-5 rounded-2xl shadow-xl border border-slate-800 flex items-center space-x-2 text-xs font-semibold"
          >
            <Check size={14} className="text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 no-print">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo Title */}
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/10">
              <CalendarIcon size={18} />
            </div>
            <h1 className="text-base md:text-lg font-display font-bold text-slate-900 tracking-tight">
              勤務希望システム
            </h1>
          </div>

          {/* User Account Controls */}
          <div className="flex items-center space-x-3 ml-auto">
            
            {/* Print trigger */}
            {currentUser.role === 'manager' && activeTab === 'calendar' && (
              <button 
                onClick={() => setActiveTab('print')}
                className="hidden sm:flex items-center space-x-1.5 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 px-3.5 py-2 rounded-xl font-bold text-xs transition-all border border-indigo-200/40"
              >
                <Printer size={13} />
                <span>印刷プレビュー</span>
              </button>
            )}

            {/* User Profile Info */}
            <div className="flex items-center space-x-2 pl-3 border-l border-slate-200">
              {/* Settings Gear Button */}
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-xl transition-all flex items-center bg-slate-50/50 shadow-3xs"
                title="表示切替・システム管理メニュー"
              >
                <Settings size={15} className="shrink-0 animate-spin-slow" />
              </button>

              <div className="flex flex-col items-end">
                <span className="font-bold text-xs text-slate-800">{currentUser.name}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none mt-0.5 ${
                  currentUser.role === 'manager' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {currentUser.role === 'manager' ? '管理者' : '一般スタッフ'}
                </span>
              </div>
              
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                title="ログアウトする"
              >
                <LogOut size={16} />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main content viewport */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 flex flex-col min-h-0">
        
        {/* VIEW: Calendar View Tab */}
        {activeTab === 'calendar' && (
          <div className="flex flex-col flex-1 min-h-0">
            <ShiftTable 
              users={users}
              currentUser={currentUser}
              scheduleData={scheduleData}
              setScheduleData={setScheduleData}
              currentDate={currentDate}
              changeMonth={changeMonth}
              daysInMonth={daysInMonth}
              formatDate={formatDate}
              getDayOfWeek={getDayOfWeek}
              onOpenRequestModal={() => setIsRequestModalOpen(true)}
              onResetData={handleResetToDefault}
              scheduleStatus={scheduleStatus}
              setScheduleStatus={setScheduleStatus}
            />
          </div>
        )}

        {/* VIEW: Staff Account list Tab */}
        {activeTab === 'users' && currentUser.role === 'manager' && (
          <UserManagement 
            users={users}
            currentUser={currentUser}
            onOpenUserModal={openUserModal}
            onDeleteUser={deleteUser}
          />
        )}

      </main>

      {/* FOOTER */}
      <footer className="no-print border-t border-slate-200 bg-white py-4 mt-8">
        <div className="max-w-[1600px] mx-auto px-4 flex flex-col sm:flex-row justify-between items-center text-slate-400 text-xs">
          <span>© 勤務管理・シフト調整システム</span>
        </div>
      </footer>

      {/* ==========================================
          MODALS
         ========================================== */}
      
      {/* MODAL: Shift request registration */}
      <AnimatePresence>
        {isRequestModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-display font-semibold text-slate-800 flex items-center">
                  <PlusCircle size={18} className="mr-2 text-indigo-600" />
                  <span>勤務希望の登録（一括登録）</span>
                </h3>
                <button 
                  onClick={() => setIsRequestModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              
              {/* Form body */}
              <form onSubmit={handleRequestSubmit} className="p-6">
                <div className="space-y-5">
                  
                  {/* Select Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      対象日
                    </label>
                    <input 
                      type="date" 
                      value={requestForm.date}
                      onChange={(e) => setRequestForm({...requestForm, date: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                      required
                    />
                  </div>

                  {/* Select Shift code */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      希望するシフト
                    </label>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {SHIFT_TYPES.filter(t => t.code !== '').map(type => (
                        <label 
                          key={type.code} 
                          className={`cursor-pointer border-2 rounded-xl p-3 text-center transition-all flex flex-col items-center justify-center ${
                            requestForm.shiftCode === type.code 
                              ? `${type.color} border-indigo-500 ring-2 ring-indigo-100 ring-offset-1 scale-[1.03] font-bold` 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="radio" 
                            name="shiftCode" 
                            value={type.code}
                            checked={requestForm.shiftCode === type.code}
                            onChange={(e) => setRequestForm({...requestForm, shiftCode: e.target.value as ShiftCode})}
                            className="sr-only"
                          />
                          <span className="text-base font-bold">{type.code}</span>
                          <span className="text-[9px] font-medium opacity-80 mt-0.5">{type.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Input Memo for Shift Request (Pure text input, no template chips) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      勤務希望の詳細メモ・備考（任意）
                    </label>
                    <input
                      type="text"
                      value={requestForm.memo}
                      onChange={(e) => setRequestForm({ ...requestForm, memo: e.target.value })}
                      placeholder="例: 午前中のみ、所用のため17時退勤希望 など"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                </div>
                
                {/* Actions */}
                <div className="mt-8 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsRequestModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-2xl font-bold text-xs transition-all"
                  >
                    キャンセル
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-bold text-xs hover:bg-indigo-700 shadow-md hover:shadow-indigo-500/10 transition-all active:scale-98"
                  >
                    登録してカレンダーへ反映
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: User creation or editing */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-display font-semibold text-slate-800 flex items-center">
                  <PlusCircle size={18} className="mr-2 text-indigo-600" />
                  <span>{editingUser ? 'スタッフアカウントの編集' : '新規スタッフの追加'}</span>
                </h3>
                <button 
                  onClick={() => setIsUserModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              
              {/* Form body */}
              <form onSubmit={handleUserSubmit} className="p-6">
                {userFormError && (
                  <div className="mb-4 p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl font-semibold flex items-center gap-1.5">
                    <ShieldAlert size={14} className="shrink-0" />
                    <span>{userFormError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Name field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      スタッフ氏名
                    </label>
                    <input 
                      type="text" 
                      value={userForm.name}
                      onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                      placeholder="例: 佐藤 健一"
                      required
                    />
                  </div>

                  {/* Login ID field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      ログインID
                    </label>
                    <input 
                      type="text" 
                      value={userForm.loginId}
                      onChange={(e) => setUserForm({...userForm, loginId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-mono font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                      placeholder="例: 1005 (半角英数字)"
                      required
                    />
                    <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                      ※ログイン時に使用する他と重複しないユニークなキーを入力してください。
                    </span>
                  </div>

                  {/* Role selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      アカウント権限レベル
                    </label>
                    <select 
                      value={userForm.role}
                      onChange={(e) => setUserForm({...userForm, role: e.target.value as 'manager' | 'employee'})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                    >
                      <option value="employee">一般スタッフ (勤務希望の入力、カレンダー閲覧)</option>
                      <option value="manager">管理者 (全シフト決定、スタッフ・アカウント管理)</option>
                    </select>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="mt-8 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsUserModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-2xl font-bold text-xs transition-all"
                  >
                    キャンセル
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-bold text-xs hover:bg-indigo-700 shadow-md hover:shadow-indigo-500/10 transition-all active:scale-98"
                  >
                    保存して登録
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Settings and View Mode Toggles */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={() => setIsSettingsOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 relative z-10"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-display font-bold text-slate-800 flex items-center gap-2">
                  <Settings size={18} className="text-indigo-600 animate-spin-slow" />
                  <span>システム設定・メニュー</span>
                </h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Account info card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ログイン中アカウント</span>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-800">{currentUser.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      currentUser.role === 'manager' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60' : 'bg-slate-200/60 text-slate-600'
                    }`}>
                      {currentUser.role === 'manager' ? '管理者（施設長）' : '一般スタッフ'}
                    </span>
                  </div>
                </div>

                {/* Manager View switching */}
                {currentUser.role === 'manager' && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={12} className="text-indigo-500" />
                      <span>管理機能の選択</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => {
                          setActiveTab('calendar');
                          setIsSettingsOpen(false);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          activeTab === 'calendar'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <CalendarIcon size={13} />
                        <span>シフト管理</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('users');
                          setIsSettingsOpen(false);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          activeTab === 'users'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Users size={13} />
                        <span>スタッフ管理</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs transition-all"
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
