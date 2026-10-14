import React from 'react';
import { User } from '../types';
import { PlusCircle, Edit2, Trash2, Key, Shield, UserCog, BadgeAlert, AlertCircle } from 'lucide-react';

interface UserManagementProps {
  users: User[];
  currentUser: User;
  onOpenUserModal: (user?: User) => void;
  onDeleteUser: (userId: string) => void;
}

export default function UserManagement({
  users,
  currentUser,
  onOpenUserModal,
  onDeleteUser,
}: UserManagementProps) {
  return (
    <div className="max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Page Description / Action Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-display font-semibold text-slate-800 flex items-center">
            <UserCog size={22} className="mr-2 text-indigo-600" />
            スタッフ・ID管理
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            システムにログインするためのアカウントIDと、表示されるスタッフ情報を管理します。
          </p>
        </div>
        
        <button
          onClick={() => onOpenUserModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:shadow-md active:scale-95 flex items-center space-x-1.5 shrink-0"
        >
          <PlusCircle size={15} />
          <span>新規スタッフ登録</span>
        </button>
      </div>

      {/* Info Notice about ID Authentication */}
      <div className="mb-6 p-4 bg-amber-50/50 border border-amber-100 rounded-xl flex items-start space-x-3 text-slate-600">
        <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-bold text-slate-700 block">💡 ログインについてのご注意</span>
          <p>
            スタッフは「スタッフ名」（または登録されたログインID）を入力するだけで簡単に本システムにログインできます。
            管理者アカウントはスタッフ名「山田 施設長」（または <code className="font-mono bg-indigo-100 text-indigo-800 px-1 rounded font-semibold">admin</code>）でログイン可能です。
          </p>
        </div>
      </div>

      {/* Grid List of Staff / Accounts */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse table-auto">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="p-4 pl-6 text-sm font-semibold whitespace-nowrap min-w-[180px]">スタッフ氏名</th>
                <th className="p-4 text-sm font-semibold whitespace-nowrap min-w-[160px]">権限レベル</th>
                <th className="p-4 text-sm font-semibold whitespace-nowrap min-w-[120px]">ログインID</th>
                <th className="p-4 pr-6 text-right text-sm font-semibold whitespace-nowrap min-w-[120px]">操作アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => {
                const isSelf = user.id === currentUser.id;
                const isManager = user.role === 'manager';

                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-all">
                    {/* Name column */}
                    <td className="p-4 pl-6 font-semibold text-slate-800 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl shrink-0 ${isManager ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                          {isManager ? <Shield size={16} /> : <Key size={16} />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                            {user.name}
                            {isSelf && (
                              <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0">
                                現在のログイン
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium block">ID: {user.id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="p-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold border whitespace-nowrap ${
                        isManager 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60' 
                          : 'bg-slate-100 text-slate-600 border-slate-200/50'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isManager ? 'bg-indigo-500' : 'bg-slate-400'}`}></span>
                        {isManager ? '管理者 (編集可能)' : '一般スタッフ (閲覧・希望)'}
                      </span>
                    </td>

                    {/* Login ID Token */}
                    <td className="p-4 whitespace-nowrap">
                      <span className="font-mono font-bold tracking-wider text-xs bg-slate-100/80 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700 shadow-3xs whitespace-nowrap">
                        {user.loginId}
                      </span>
                    </td>

                    {/* Operations */}
                    <td className="p-4 pr-6 text-right whitespace-nowrap">
                      <div className="flex justify-end items-center space-x-1 whitespace-nowrap">
                        <button 
                          onClick={() => onOpenUserModal(user)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-semibold flex items-center space-x-1 whitespace-nowrap"
                          title="アカウントを編集"
                        >
                          <Edit2 size={14} />
                          <span className="text-[11px]">編集</span>
                        </button>
                        
                        {!isSelf && (
                          <button 
                            onClick={() => onDeleteUser(user.id)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-semibold flex items-center space-x-1 whitespace-nowrap"
                            title="アカウントを削除"
                          >
                            <Trash2 size={14} />
                            <span className="text-[11px]">削除</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
