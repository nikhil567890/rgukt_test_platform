import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Mail, User as UserIcon } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { login, register, loginWithGoogle, loginWithGoogleEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showGoogleEmailInput, setShowGoogleEmailInput] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      if (err.message && err.message.includes('not enabled in Firebase Console')) {
        setShowGoogleEmailInput(true);
        setError('Firebase Google Sign-In popup requires console setup. Enter your Google email below to sign in directly:');
      } else {
        setError(err.message || 'Google Sign-In failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmailInput || !googleEmailInput.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogleEmail(googleEmailInput.trim());
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Google account sign-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ name, email, password });
      }
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="auth-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div id="auth-modal-card" className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 sm:p-6 relative">
        <button
          id="btn-close-auth-modal"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center mx-auto mb-2.5 border border-indigo-100">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {mode === 'login' ? 'Sign in to RGUKT TestPrep' : 'Create Student Account'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Access RGUKT entrance mock test papers & detailed solutions
          </p>
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          id="btn-google-signin"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 shadow-2xs transition-all cursor-pointer flex items-center justify-center space-x-2.5 mb-2 disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {showGoogleEmailInput && (
          <form onSubmit={handleGoogleEmailSubmit} className="mb-4 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
            <p className="text-[11px] font-bold text-indigo-900">Sign in with your Google Email:</p>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={googleEmailInput}
                onChange={(e) => setGoogleEmailInput(e.target.value)}
                placeholder="your.name@gmail.com"
                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <span className="relative bg-white px-2 text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            or continue with email
          </span>
        </div>

        {error && (
          <div id="auth-error-alert" className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rahul Sharma"
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@rgukt.ac.in"
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50 mt-2"
          >
            {isSubmitting
              ? 'Processing...'
              : mode === 'login'
              ? 'Sign In to Account'
              : 'Create Account & Continue'}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-slate-500">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className="text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                Register as Student
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
