'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '@/firebase-applet-config.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
