import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import appletConfig from "../../firebase-applet-config.json";

const env = (import.meta as any).env || {};

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: appletConfig.apiKey || env.VITE_FIREBASE_API_KEY,
  authDomain: appletConfig.authDomain || env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: appletConfig.projectId || env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: appletConfig.storageBucket || env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: appletConfig.messagingSenderId || env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: appletConfig.appId || env.VITE_FIREBASE_APP_ID,
  measurementId: appletConfig.measurementId || env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase Auth & Firestore instances
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db = appletConfig.firestoreDatabaseId && appletConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(app, appletConfig.firestoreDatabaseId)
  : getFirestore(app);

// Safe Analytics initialization for browser environments
export let analytics: ReturnType<typeof getAnalytics> | null = null;

const measurementId = typeof firebaseConfig.measurementId === 'string' ? firebaseConfig.measurementId.trim() : '';

// Only attempt analytics initialization if a valid measurementId is explicitly configured
if (typeof window !== 'undefined' && Boolean(measurementId)) {
  isSupported()
    .then((supported) => {
      if (supported && measurementId) {
        try {
          analytics = getAnalytics(app);
        } catch {
          // Gracefully ignore analytics failures in sandboxed or offline environments
          analytics = null;
        }
      }
    })
    .catch(() => {
      analytics = null;
    });
}

