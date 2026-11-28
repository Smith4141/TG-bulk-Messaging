import React, { useState } from 'react';
import {
  Send,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Radio,
  UserPlus,
  Mail,
  Building2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { SupportedLanguage } from '../translations';
import { LanguageSelector } from './LanguageSelector';

export interface SignupApplicationPayload {
  name: string;
  email: string;
  username: string;
  password: string;
  requestedRole: 'moderator' | 'editor' | 'viewer';
  department: string;
  reason?: string;
}

export interface BootstrapAdminPayload {
  username: string;
  password: string;
  name?: string;
}

export interface ResetAdminWithGooglePayload {
  username: string;
  password: string;
  name?: string;
}

interface LoginViewProps {
  onCredentialLogin: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onGoogleAdminSignIn: () => Promise<{ ok: boolean; error?: string }>;
  onSignupRequest: (payload: SignupApplicationPayload) => Promise<{ ok: boolean; message?: string; error?: string }>;
  onBootstrapAdmin: (payload: BootstrapAdminPayload) => Promise<{ ok: boolean; error?: string }>;
  onGoogleAdminReset: (payload: ResetAdminWithGooglePayload) => Promise<{ ok: boolean; error?: string }>;
  adminPasswordConfigured: boolean;
  firebaseAuthLoading?: boolean;
  firebaseAuthError?: string | null;
  lang?: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  siteLang?: string;
  onSiteLanguageChange?: (code: string) => void;
  isTranslatingSite?: boolean;
}

type AuthTabMode = 'login' | 'signup' | 'admin_setup' | 'admin_reset';

export const LoginView: React.FC<LoginViewProps> = ({
  onCredentialLogin,
  onGoogleAdminSignIn,
  onSignupRequest,
  onBootstrapAdmin,
  onGoogleAdminReset,
  adminPasswordConfigured,
  firebaseAuthLoading = false,
  firebaseAuthError = null,
  siteLang = 'en',
  onSiteLanguageChange,
  isTranslatingSite = false,
}) => {
  const [mode, setMode] = useState<AuthTabMode>('login');

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup request state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupRole, setSignupRole] = useState<'viewer' | 'editor' | 'moderator'>('viewer');
  const [signupDepartment, setSignupDepartment] = useState('Customer Support & Inbox');
  const [signupReason, setSignupReason] = useState('');

  // First-run Admin Setup state
  const [setupUsername, setSetupUsername] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);

  // Google-verified Admin Reset state
  const [resetAdminUsername, setResetAdminUsername] = useState('');
  const [resetAdminPassword, setResetAdminPassword] = useState('');
  const [showResetAdminPassword, setShowResetAdminPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: AuthTabMode) => {
    setMode(next);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setErrorMessage('Please enter your Username or ID.');
      return;
    }
    if (password.length < 4 || password.length > 60) {
      setErrorMessage('Password must be strictly between 4 and 60 characters.');
      return;
    }

    setLoading(true);
    const res = await onCredentialLogin(cleanUser, password);
    setLoading(false);
    if (!res.ok) {
      setErrorMessage(res.error || 'Authentication failed. Check your ID/username and password.');
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = signupName.trim();
    const cleanEmail = signupEmail.trim();
    const cleanUsername = signupUsername.trim().toLowerCase().replace(/^@+/, '');

    if (cleanName.length < 2) {
      setErrorMessage('Full name must be at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!/^[a-z0-9_.-]{3,32}$/.test(cleanUsername)) {
      setErrorMessage('Username must be 3-32 characters (letters, numbers, _, ., -).');
      return;
    }
    if (signupPassword.length < 4 || signupPassword.length > 60) {
      setErrorMessage('Password must be strictly between 4 and 60 characters.');
      return;
    }

    setLoading(true);
    const res = await onSignupRequest({
      name: cleanName,
      email: cleanEmail,
      username: cleanUsername,
      password: signupPassword,
      requestedRole: signupRole,
      department: signupDepartment.trim() || 'General Operations',
      reason: signupReason.trim() || undefined,
    });
    setLoading(false);

    if (res.ok) {
      setSuccessMessage(
        res.message ||
          'Signup application submitted. An Administrator must approve your account before you can enter the website.'
      );
      setSignupName('');
      setSignupEmail('');
      setSignupUsername('');
      setSignupPassword('');
      setSignupReason('');
    } else {
      setErrorMessage(res.error || 'Unable to submit signup application.');
    }
  };

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanAdminId = setupUsername.trim().toLowerCase().replace(/^@+/, '');
    if (!/^[a-z0-9_.-]{3,32}$/.test(cleanAdminId)) {
      setErrorMessage('Admin ID/Username must be 3-32 characters (letters, numbers, _, ., -).');
      return;
    }
    if (setupPassword.length < 4 || setupPassword.length > 60) {
      setErrorMessage('Administrator password must be strictly between 4 and 60 characters.');
      return;
    }

    setLoading(true);
    const res = await onBootstrapAdmin({
      username: cleanAdminId,
      password: setupPassword,
    });
    setLoading(false);
    if (!res.ok) {
      setErrorMessage(res.error || 'Failed to initialize Administrator credentials.');
    }
  };

  const handleGoogleAdminResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanAdminId = resetAdminUsername.trim().toLowerCase().replace(/^@+/, '');
    if (!/^[a-z0-9_.-]{3,32}$/.test(cleanAdminId)) {
      setErrorMessage('New Admin ID/Username must be 3-32 characters (letters, numbers, _, ., -).');
      return;
    }
    if (resetAdminPassword.length < 4 || resetAdminPassword.length > 60) {
      setErrorMessage('New Administrator password must be strictly between 4 and 60 characters.');
      return;
    }

    setLoading(true);
    const res = await onGoogleAdminReset({
      username: cleanAdminId,
      password: resetAdminPassword,
    });
    setLoading(false);
    if (!res.ok) {
      setErrorMessage(res.error || 'Failed to reset Administrator username and password.');
    }
  };

  const activeError = errorMessage || firebaseAuthError;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      {/* Top Navbar — Strict Access Gate (no public bypass) */}
      <header className="px-6 py-4 border-b border-neutral-900 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20">
            <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white">TelePulse</span>
              <span className="text-[10px] uppercase font-semibold text-sky-400 bg-sky-950/80 px-1.5 py-0.2 rounded border border-sky-800/60">
                Enterprise
              </span>
            </div>
            <div className="text-[10px] text-neutral-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Protected Portal · Mandatory Authentication</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSelector
            selectedCode={siteLang}
            onSelectLanguage={(code) => onSiteLanguageChange?.(code)}
            isTranslating={isTranslatingSite}
            variant="dark"
          />
        </div>
      </header>

      {/* Main Auth Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl space-y-5">
          {/* Enforced Security & Approval Policy Banner */}
          <div className="rounded-xl p-4 border border-sky-900/60 bg-sky-950/20 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Strict Access Control &amp; Approval Policy</span>
            </div>
            <ul className="text-xs text-neutral-300 space-y-1.5 pl-1 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
                <span>
                  <strong className="text-amber-400">Administrator: </strong>
                  Linked to the authorized Google AI Studio account, or signs in using Admin ID and a 4–60 character password.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0"></span>
                <span>
                  <strong className="text-sky-400">Team Members: </strong>
                  Must log in with a valid Admin-approved Username/ID and Password (4–60 characters). Unapproved accounts cannot access the website.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></span>
                <span>
                  <strong className="text-emerald-400">New Applicants: </strong>
                  Submit a signup request below. Access remains locked until reviewed and approved by the Administrator.
                </span>
              </li>
            </ul>
          </div>

          {/* Auth Card */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-md">
            {/* Mode Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 mb-6 rounded-xl bg-neutral-950 border border-neutral-800">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'login'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'signup'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Request Access (Sign Up)</span>
              </button>

              {!adminPasswordConfigured ? (
                <button
                  type="button"
                  onClick={() => switchMode('admin_setup')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'admin_setup'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-400 hover:bg-amber-950/40'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Admin Setup</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode('admin_reset')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'admin_reset'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-400 hover:bg-amber-950/40'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Reset Admin</span>
                </button>
              )}
            </div>

            {activeError && (
              <div className="mb-5 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{activeError}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2">
                <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-300">Application Received — Pending Admin Approval</div>
                  <p className="mt-0.5 text-emerald-200/90 leading-relaxed">{successMessage}</p>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <>
                <div className="mb-5">
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-sky-400" />
                    <span>Sign in to TelePulse</span>
                  </h1>
                  <p className="mt-1 text-xs text-neutral-400">
                    Enter your approved Username/ID and Password (4–60 characters).
                  </p>
                </div>

                {!adminPasswordConfigured && (
                  <div className="mb-5 p-3.5 rounded-lg bg-amber-950/50 border border-amber-700/70 text-amber-200 text-xs flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-amber-300">Administrator Credentials Reset</div>
                      <p className="text-[11px] text-amber-200/85 mt-0.5">
                        Set a new Admin username and password in Admin Setup, or sign in with Google below.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchMode('admin_setup')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[11px] shrink-0"
                    >
                      Open Admin Setup
                    </button>
                  </div>
                )}

                {/* Admin-Only Linked Google AI Studio Sign-In */}
                <div className="mb-5">
                  <button
                    type="button"
                    disabled={firebaseAuthLoading}
                    onClick={async () => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      const res = await onGoogleAdminSignIn();
                      if (!res.ok && res.error) {
                        setErrorMessage(res.error);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border border-amber-500/40 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                      />
                    </svg>
                    <span>
                      {firebaseAuthLoading
                        ? 'Verifying Google AI Studio Account...'
                        : 'Administrator Google Sign-In (Linked AI Studio Account)'}
                    </span>
                  </button>
                  <p className="mt-1.5 text-[11px] text-neutral-500 text-center">
                    Google Sign-In is verified exclusively against the authorized Administrator email.
                  </p>
                  <div className="relative my-4 flex items-center">
                    <div className="flex-grow border-t border-neutral-800" />
                    <span className="px-2.5 text-[10px] uppercase tracking-wider text-neutral-500">
                      or ID &amp; password login
                    </span>
                    <div className="flex-grow border-t border-neutral-800" />
                  </div>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Username or User ID
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        autoFocus
                        autoComplete="username"
                        placeholder="Enter your username or ID"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full text-xs font-mono pl-9 pr-3 py-2.5 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-neutral-300">
                        Password
                      </label>
                      <span className="text-[10px] text-neutral-500 font-mono">4–60 chars</span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={4}
                        maxLength={60}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full text-xs font-mono pl-9 pr-10 py-2.5 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/25 transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <span>Verifying Credentials...</span>
                    ) : (
                      <>
                        <span>Log In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            {mode === 'signup' && (
              <>
                <div className="mb-5">
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-400" />
                    <span>Apply for Account Access</span>
                  </h1>
                  <p className="mt-1 text-xs text-neutral-400">
                    Submit your registration request. You cannot enter the website until an Administrator approves your account.
                  </p>
                </div>

                <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={80}
                          placeholder="Your full name"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Work Email
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                        <input
                          type="email"
                          required
                          placeholder="name@company.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Desired Username (ID)
                      </label>
                      <input
                        type="text"
                        required
                        minLength={3}
                        maxLength={32}
                        placeholder="3-32 letters/numbers"
                        value={signupUsername}
                        onChange={(e) => setSignupUsername(e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-neutral-300">
                          Password
                        </label>
                        <span className="text-[10px] text-neutral-500 font-mono">4–60 chars</span>
                      </div>
                      <div className="relative">
                        <input
                          type={showSignupPassword ? 'text' : 'password'}
                          required
                          minLength={4}
                          maxLength={60}
                          autoComplete="new-password"
                          placeholder="4–60 characters"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="w-full text-xs font-mono px-3 pr-9 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute right-2.5 top-2 text-neutral-500 hover:text-neutral-300"
                        >
                          {showSignupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Requested Role
                      </label>
                      <select
                        value={signupRole}
                        onChange={(e) => setSignupRole(e.target.value as 'viewer' | 'editor' | 'moderator')}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-white focus:outline-none focus:border-sky-500"
                      >
                        <option value="viewer">Viewer — Full-Screen Live Chat Only</option>
                        <option value="moderator">Moderator — Live Chat, Campaigns &amp; Phone Filter</option>
                        <option value="editor">Editor — Team, CRM, Gateways &amp; Audits</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Department
                      </label>
                      <div className="relative">
                        <Building2 className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          maxLength={80}
                          placeholder="e.g. Customer Support"
                          value={signupDepartment}
                          onChange={(e) => setSignupDepartment(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Reason / Note for Administrator (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      placeholder="Briefly describe why you need access"
                      value={signupReason}
                      onChange={(e) => setSignupReason(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <span>Submitting Application...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Submit Application for Admin Approval</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            {mode === 'admin_setup' && !adminPasswordConfigured && (
              <>
                <div className="mb-5">
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    <span>Administrator Username &amp; Password Setup</span>
                  </h1>
                  <p className="mt-1 text-xs text-neutral-400">
                    Choose your new Admin ID and 4–60 character password, then verify with your authorized Google AI Studio account.
                  </p>
                </div>

                <form onSubmit={handleBootstrapSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      New Administrator ID / Username
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={32}
                      placeholder="Choose new Admin username (e.g. admin)"
                      value={setupUsername}
                      onChange={(e) => setSetupUsername(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2.5 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-neutral-300">
                        Set Administrator Password
                      </label>
                      <span className="text-[10px] text-neutral-500 font-mono">4–60 chars</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showSetupPassword ? 'text' : 'password'}
                        required
                        minLength={4}
                        maxLength={60}
                        autoComplete="new-password"
                        placeholder="Choose 4–60 character password"
                        value={setupPassword}
                        onChange={(e) => setSetupPassword(e.target.value)}
                        className="w-full text-xs font-mono px-3 pr-10 py-2.5 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSetupPassword(!showSetupPassword)}
                        className="absolute right-3 top-2.5 text-neutral-500 hover:text-neutral-300"
                      >
                        {showSetupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || firebaseAuthLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {loading || firebaseAuthLoading ? (
                      <span>Verifying Google Account &amp; Configuring...</span>
                    ) : (
                      <span>Verify Google AI Studio Account &amp; Save Admin</span>
                    )}
                  </button>
                </form>
              </>
            )}

            {mode === 'admin_reset' && adminPasswordConfigured && (
              <>
                <div className="mb-5">
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    <span>Reset Administrator Username &amp; Password</span>
                  </h1>
                  <p className="mt-1 text-xs text-neutral-400">
                    Enter your new Admin ID and Password (4–60 chars), then verify ownership with your linked Google AI Studio account.
                  </p>
                </div>

                <form onSubmit={handleGoogleAdminResetSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      New Administrator ID / Username
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={32}
                      placeholder="Choose new Admin username"
                      value={resetAdminUsername}
                      onChange={(e) => setResetAdminUsername(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2.5 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-neutral-300">
                        New Administrator Password
                      </label>
                      <span className="text-[10px] text-neutral-500 font-mono">4–60 chars</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showResetAdminPassword ? 'text' : 'password'}
                        required
                        minLength={4}
                        maxLength={60}
                        autoComplete="new-password"
                        placeholder="Choose new 4–60 character password"
                        value={resetAdminPassword}
                        onChange={(e) => setResetAdminPassword(e.target.value)}
                        className="w-full text-xs font-mono px-3 pr-10 py-2.5 rounded-lg border border-neutral-800 bg-neutral-950 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetAdminPassword(!showResetAdminPassword)}
                        className="absolute right-3 top-2.5 text-neutral-500 hover:text-neutral-300"
                      >
                        {showResetAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || firebaseAuthLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {loading || firebaseAuthLoading ? (
                      <span>Verifying Google Account &amp; Resetting...</span>
                    ) : (
                      <span>Verify Google AI Studio Account &amp; Reset Admin</span>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-neutral-900 text-center text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-500" />
          <span>Reverse Proxy Gateway Port 200 · Protected</span>
        </div>
        <div>
          <span>TelePulse Enterprise Authentication · Strict RBAC &amp; Approval Gate</span>
        </div>
      </footer>
    </div>
  );
};
