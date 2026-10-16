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
  <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-900">
    <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center space-y-4">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-[#6dd95d] flex items-center justify-center">
        <Shield className="h-7 w-7 text-slate-900" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">hisensei HQ</h1>

      {mode === 'signed_out' ? (
        <>
          <p className="text-xs text-slate-600">Sign in with the Google account your administrator invited.</p>
          <button
            onClick={onSignIn}
            className="w-full px-4 py-2.5 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-900 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign in with Google</span>
          </button>
          {message && <p className="text-xs text-[#f77f73] font-medium">{message}</p>}
        </>
      ) : (
        <>
          <div className="mx-auto h-10 w-10 rounded-full bg-[#f77f73]/10 text-[#f77f73] flex items-center justify-center border border-[#f77f73]/30">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-xs text-slate-700">{message || 'You do not have access.'}</p>
          {email && <p className="font-mono text-[11px] text-slate-500">{email}</p>}
          <button
            onClick={onSignOut}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-300 transition flex items-center justify-center space-x-2 mx-auto"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </>
      )}
    </div>
  </div>
);
