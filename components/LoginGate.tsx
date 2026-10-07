'use client';

import React from 'react';
import { Shield, LogIn, LogOut, AlertCircle } from 'lucide-react';

interface LoginGateProps {
  mode: 'signed_out' | 'denied';
  message?: string;
  email?: string;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({ mode, message, email, onSignIn, onSignOut }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
    <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-indigo-500/20">
        <Shield className="h-7 w-7 text-white" />
      </div>
      <h1 className="text-lg font-bold text-white">hisensei HQ</h1>

      {mode === 'signed_out' ? (
        <>
          <p className="text-xs text-slate-400">Sign in with the Google account your administrator invited.</p>
          <button
            onClick={onSignIn}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center justify-center space-x-2"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign in with Google</span>
          </button>
          {message && <p className="text-xs text-rose-400">{message}</p>}
        </>
      ) : (
        <>
          <div className="mx-auto h-10 w-10 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-xs text-slate-300">{message || 'You do not have access.'}</p>
          {email && <p className="font-mono text-[11px] text-slate-500">{email}</p>}
          <button
            onClick={onSignOut}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center space-x-2 mx-auto"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </>
      )}
    </div>
  </div>
);
