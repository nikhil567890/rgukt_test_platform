import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  register: (userData: { name: string; email: string; password: string }) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  loginWithGoogleEmail: (email: string, name?: string) => Promise<User>;
  logout: () => void;
  updateUserAndToken: (updatedUser: User, newToken: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const ADMIN_EMAILS = [
  'admin@rgukt.ac.in',
  'rvinodh45@gmail.com',
  'avinashinapakurthi31@gmail.com',
  'jaan546jaan@gmail.com',
];

const syncUserToFirestore = async (u: User) => {
  try {
    if (!u || !u.id) return;
    const userRef = doc(db, 'users', u.id);
    await setDoc(
      userRef,
      {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isPremium: u.isPremium,
        premiumSince: u.premiumSince || null,
        currentStreak: u.currentStreak || 0,
        longestStreak: u.longestStreak || 0,
        createdAt: u.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Firestore user sync notice:', e);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const existingToken = localStorage.getItem('token');
    if (!existingToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await authApi.getMe();
      if (res && res.user) {
        setUser(res.user);
        syncUserToFirestore(res.user);
      } else {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }
    } catch (err: any) {
      console.warn('Session expired or invalid token:', err?.message || err);
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    // Listen for global auth:expired event emitted when API requests receive 401
    const handleAuthExpired = () => {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      setToken(null);
      setUser(null);
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const login = async (credentials: { email: string; password: string }): Promise<User> => {
    // Clear any prior stale tokens before storing the freshly issued token
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    const res = await authApi.login(credentials);
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user);
    syncUserToFirestore(res.user);
    return res.user;
  };

  const register = async (userData: { name: string; email: string; password: string }): Promise<User> => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    const res = await authApi.register(userData);
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user);
    syncUserToFirestore(res.user);
    return res.user;
  };

  const loginWithGoogle = async (): Promise<User> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      // Extract verified Firebase ID token
      const idToken = await fbUser.getIdToken();

      // Exchange Firebase ID token with Express backend for verified application JWT
      const res = await authApi.googleLogin({
        idToken,
        email: fbUser.email || '',
        name: fbUser.displayName || 'Google Student',
        googleId: fbUser.uid,
      });

      // Clear any prior tokens and store ONLY the newly issued application JWT
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      localStorage.setItem('token', res.token);
      setToken(res.token);
      setUser(res.user);
      syncUserToFirestore(res.user);
      return res.user;
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
        throw new Error('Google Sign-In is not enabled in Firebase Console for this project. Please use email and password to sign in.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Google Sign-In popup was closed before completing.');
      } else if (err.code === 'auth/popup-blocked') {
        throw new Error('Sign-In popup was blocked by browser. Please allow popups.');
      } else if (err.code === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).');
      } else if (err.code === 'auth/cancelled-popup-request') {
        throw new Error('Google Sign-In popup was cancelled.');
      }
      throw new Error(err.message || 'Google Sign-In failed');
    }
  };

  const loginWithGoogleEmail = async (email: string, name?: string): Promise<User> => {
    const normalizedEmail = email.toLowerCase().trim();
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    const res = await authApi.googleLogin({
      email: normalizedEmail,
      name: name || normalizedEmail.split('@')[0],
    });
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user);
    syncUserToFirestore(res.user);
    return res.user;
  };

  const logout = async () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
    try {
      await auth.signOut();
    } catch (e) {
      console.warn('Firebase signout notice:', e);
    }
  };

  const updateUserAndToken = (updatedUser: User, newToken: string) => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(updatedUser);
  };

  const isLoggedIn = !!user;
  const userEmail = user?.email?.toLowerCase().trim();
  const isAdmin = user?.role === 'ADMIN' || (!!userEmail && ADMIN_EMAILS.includes(userEmail));
  const isPremium = user?.isPremium || isAdmin || false;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isLoggedIn,
        isAdmin,
        isPremium,
        login,
        register,
        loginWithGoogle,
        loginWithGoogleEmail,
        logout,
        updateUserAndToken,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
