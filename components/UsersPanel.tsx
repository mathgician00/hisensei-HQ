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
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={invite} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <label className="text-[11px] text-slate-400 md:col-span-2">
          Google account email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          />
        </label>
        <label className="text-[11px] text-slate-400">
          Role
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-400">
          Linked teacher
          <select
            disabled={form.role !== 'teacher'}
            required={form.role === 'teacher'}
            value={form.teacher_id}
            onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none disabled:opacity-40"
          >
            <option value="">Select…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2"
        >
          <UserPlus className="h-4 w-4" />
          <span>Invite</span>
        </button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center space-x-2">
          <Users className="h-4 w-4 text-indigo-400" />
          <h3 className="font-bold text-sm text-white">Users and roles</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Teacher</th>
                <th className="py-3 px-4">Signed in before</th>
                <th className="py-3 px-4 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => {
                const isMe = u.email.toLowerCase() === currentEmail.toLowerCase();
                return (
                  <tr key={u.id} className={u.active ? '' : 'opacity-50'}>
                    <td className="py-3 px-4 font-mono text-white">{u.email}{isMe && <span className="ml-2 text-[10px] text-cyan-400">(you)</span>}</td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        disabled={busy || isMe}
                        onChange={(e) => post('update_user', { id: u.id, role: e.target.value, teacher_id: e.target.value === 'teacher' ? u.teacher_id ?? undefined : null })}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none disabled:opacity-60"
                      >
                        {Object.entries(ROLE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{u.teacher_name ? `${u.teacher_name} (${u.teacher_code})` : '—'}</td>
                    <td className="py-3 px-4 text-slate-400">{u.linked ? 'Yes' : 'Invited, not yet'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        disabled={busy || isMe}
                        onClick={() => post('update_user', { id: u.id, active: !u.active })}
                        className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40"
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
