'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const ROLE_LABELS: Record<string, string> = {
  master_admin: 'Master admin',
  admin: 'Admin',
  teacher: 'Teacher',
  viewer: 'Viewer (read-only)',
};

interface UsersPanelProps {
  teachers: { id: string; name: string; code: string }[];
  currentEmail: string;
}

export const UsersPanel: React.FC<UsersPanelProps> = ({ teachers, currentEmail }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'admin', teacher_id: '', name: '' });

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/data?type=users');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(json);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (action: string, payload: any) => {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await post('invite_user', {
      email: form.email,
      role: form.role,
      name: form.name || undefined,
      teacher_id: form.role === 'teacher' ? form.teacher_id : undefined,
    });
    if (ok) setForm({ email: '', role: 'admin', teacher_id: '', name: '' });
  };

  return (
    <div className="space-y-4 text-slate-900">
      {error && (
        <div className="p-3 bg-[#f77f73]/15 border border-[#f77f73]/30 text-rose-900 text-xs rounded-xl flex items-center space-x-2 font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={invite} className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end shadow-xs">
        <label className="text-[11px] font-semibold text-slate-700 md:col-span-2">
          Google account email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
          />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Role
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
          >
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Linked teacher
          <select
            disabled={form.role !== 'teacher'}
            required={form.role === 'teacher'}
            value={form.teacher_id}
            onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d] disabled:opacity-40"
          >
            <option value="">Select…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          className="px-3 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] disabled:bg-slate-100 text-slate-950 disabled:text-slate-400 text-xs font-bold rounded-xl flex items-center justify-center space-x-2 shadow-xs transition"
        >
          <UserPlus className="h-4 w-4" />
          <span>Invite</span>
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center space-x-2">
          <Users className="h-4 w-4 text-emerald-700" />
          <h3 className="font-bold text-sm text-slate-900">Users and roles</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Teacher</th>
                <th className="py-3 px-4">Signed in before</th>
                <th className="py-3 px-4 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isMe = u.email.toLowerCase() === currentEmail.toLowerCase();
                return (
                  <tr key={u.id} className={`hover:bg-slate-50/70 transition ${u.active ? '' : 'opacity-50'}`}>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{u.email}{isMe && <span className="ml-2 text-[10px] text-blue-700 font-bold">(you)</span>}</td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        disabled={busy || isMe}
                        onChange={(e) => post('update_user', { id: u.id, role: e.target.value, teacher_id: e.target.value === 'teacher' ? u.teacher_id ?? undefined : null })}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d] disabled:opacity-60"
                      >
                        {Object.entries(ROLE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.teacher_name ? `${u.teacher_name} (${u.teacher_code})` : '—'}</td>
                    <td className="py-3 px-4 text-slate-600">{u.linked ? 'Yes' : 'Invited, not yet'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        disabled={busy || isMe}
                        onClick={() => post('update_user', { id: u.id, active: !u.active })}
                        className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                      >
                        {u.active ? 'Deactivate' : 'Reactivate'}
                      </button>
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
};
