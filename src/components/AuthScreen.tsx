import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';

type AuthMode = 'login' | 'signup' | 'forgot';

interface AuthScreenProps {
  onShowToast?: (message: string) => void;
}

export function AuthScreen({ onShowToast }: AuthScreenProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setSuccessMessage(null);
  }

  async function handleGoogleLogin() {
    setError(null);
    setSuccessMessage(null);
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (mode === 'forgot') {
      setIsSubmitting(true);
      try {
        await sendPasswordReset(cleanEmail);
        setSuccessMessage(
          `Password reset link sent to ${cleanEmail}. Check your inbox (and spam folder) to choose a new password.`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to send password reset email.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(cleanEmail, password);
      } else {
        await signUpWithEmail(name.trim(), cleanEmail, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF8F9] text-[#241118]">
      {/* Top Bar */}
      <header className="border-b border-[#EEDCE0] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#241118]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#BE123C] text-white">
              <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
            </span>
            <span className="font-display">RosoFood AI</span>
          </div>

          <PWAInstallButton variant="hero" onInstalledToast={onShowToast} />
        </div>
      </header>

      {/* Main Protected Auth Gate */}
      <main className="flex-1">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:px-8">
          {/* Left Hero Story */}
          <div className="lg:col-span-6">
            <p className="text-xs font-medium tracking-wide text-[#BE123C]">
              Cooked With Love · Private Nutrition Sanctuary
            </p>
            <h1
              className="mt-3 font-display font-bold tracking-tight text-[#241118]"
              style={{
                fontSize: 'clamp(2.1rem, 3.8vw, 3.2rem)',
                lineHeight: 1.08,
                textWrap: 'balance',
              }}
            >
              Sign in to scan meals and keep your food diary private.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#644A52]">
              Every plate you share or savor deserves mindful care. Create your personal RosoFood AI
              account to unlock live Gemini Vision food scanning, South Indian &amp; global dish
              recognition, macro charts, and your private cloud-synced daily food diary.
            </p>

            <div className="mt-7 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#EEDCE0] bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#241118]">
                  <Sparkles className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
                  Instant AI Vision Macros
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#644A52]">
                  Snap or upload any meal or fruit platter for calorie, protein, carb, fat, and
                  fiber estimates.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EEDCE0] bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#241118]">
                  <ShieldCheck className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
                  Private Per-Account Diary
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#644A52]">
                  Protected by Firebase Authentication and Firestore rules so only you access your
                  meal history.
                </p>
              </div>
            </div>
          </div>

          {/* Right Auth Card */}
          <div className="lg:col-span-6">
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-[#EEDCE0] bg-white shadow-sm">
              {/* Mode Switch Tabs */}
              <div className="grid grid-cols-3 border-b border-[#EEDCE0] bg-[#FFF8F9]">
                {(
                  [
                    { id: 'login', label: 'Sign In' },
                    { id: 'signup', label: 'Create Account' },
                    { id: 'forgot', label: 'Reset' },
                  ] as const
                ).map((tab) => {
                  const active = mode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => switchMode(tab.id)}
                      className={`min-h-[46px] px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'border-b-2 border-[#BE123C] bg-white text-[#BE123C]'
                          : 'text-[#644A52] hover:text-[#241118]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-6 sm:p-7">
                <h2 className="font-display text-xl font-bold text-[#241118]">
                  {mode === 'login'
                    ? 'Welcome back to RosoFood AI'
                    : mode === 'signup'
                      ? 'Create your RosoFood AI account'
                      : 'Reset your password'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#644A52]">
                  {mode === 'login'
                    ? 'Sign in with Google or your email & password to open your nutrition dashboard.'
                    : mode === 'signup'
                      ? 'Start tracking your meals privately across devices.'
                      : 'Enter your account email and we will send a Firebase password reset link.'}
                </p>

                {mode !== 'forgot' && (
                  <>
                    <button
                      type="button"
                      disabled={isGoogleLoading || isSubmitting}
                      onClick={() => void handleGoogleLogin()}
                      className="mt-5 flex min-h-[46px] w-full items-center justify-center gap-3 rounded-xl border border-[#E5CFD4] bg-white px-4 py-2.5 text-sm font-semibold text-[#241118] transition-colors hover:bg-[#FFF8F9] disabled:opacity-50 cursor-pointer"
                    >
                      {isGoogleLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#BE123C]" aria-hidden="true" />
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="#EA4335"
                            d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c6.9 0 9.6-4.8 9.6-7.3 0-.5-.1-.9-.1-1.3H12z"
                          />
                        </svg>
                      )}
                      {isGoogleLoading ? 'Signing in with Google...' : 'Continue with Google'}
                    </button>

                    <div className="my-5 flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#EEDCE0]" />
                      <span className="text-[11px] font-medium uppercase tracking-wider text-[#7E6069]">
                        or with email
                      </span>
                      <div className="h-px flex-1 bg-[#EEDCE0]" />
                    </div>
                  </>
                )}

                <form onSubmit={handleSubmit} className={mode === 'forgot' ? 'mt-5 space-y-4' : 'space-y-4'}>
                  {mode === 'signup' && (
                    <label className="block">
                      <span className="text-xs font-medium text-[#644A52]">Full Name</span>
                      <div className="relative mt-1.5">
                        <UserIcon
                          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#7E6069]"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          required
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g., Romit Seth"
                          className="min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white pr-3.5 pl-10 text-sm text-[#241118] placeholder:text-[#9D828A] focus:border-[#BE123C] focus:outline-none"
                        />
                      </div>
                    </label>
                  )}

                  <label className="block">
                    <span className="text-xs font-medium text-[#644A52]">Email Address</span>
                    <div className="relative mt-1.5">
                      <Mail
                        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#7E6069]"
                        aria-hidden="true"
                      />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white pr-3.5 pl-10 text-sm text-[#241118] placeholder:text-[#9D828A] focus:border-[#BE123C] focus:outline-none"
                      />
                    </div>
                  </label>

                  {mode !== 'forgot' && (
                    <label className="block">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#644A52]">Password</span>
                        {mode === 'login' && (
                          <button
                            type="button"
                            onClick={() => switchMode('forgot')}
                            className="text-xs font-medium text-[#BE123C] hover:underline cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative mt-1.5">
                        <Lock
                          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#7E6069]"
                          aria-hidden="true"
                        />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white pr-11 pl-10 text-sm text-[#241118] placeholder:text-[#9D828A] focus:border-[#BE123C] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-[#7E6069] hover:text-[#241118] cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>
                  )}

                  {mode === 'signup' && (
                    <label className="block">
                      <span className="text-xs font-medium text-[#644A52]">Confirm Password</span>
                      <div className="relative mt-1.5">
                        <KeyRound
                          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#7E6069]"
                          aria-hidden="true"
                        />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white pr-3.5 pl-10 text-sm text-[#241118] placeholder:text-[#9D828A] focus:border-[#BE123C] focus:outline-none"
                        />
                      </div>
                    </label>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-relaxed text-red-900"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div
                      role="status"
                      className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs leading-relaxed text-emerald-950"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || isGoogleLoading}
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#BE123C] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#9F1239] disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {mode === 'login'
                      ? isSubmitting
                        ? 'Signing in...'
                        : 'Sign In'
                      : mode === 'signup'
                        ? isSubmitting
                          ? 'Creating account...'
                          : 'Create Account'
                        : isSubmitting
                          ? 'Sending reset link...'
                          : 'Send Password Reset Link'}
                  </button>
                </form>

                <div className="mt-5 text-center text-xs text-[#644A52]">
                  {mode === 'login' ? (
                    <>
                      New to RosoFood AI?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('signup')}
                        className="font-semibold text-[#BE123C] hover:underline cursor-pointer"
                      >
                        Create a free account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="font-semibold text-[#BE123C] hover:underline cursor-pointer"
                      >
                        Sign in instead
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EEDCE0] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-4 py-5 text-xs text-[#7E6069] sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span>© {new Date().getFullYear()} RosoFood AI</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-[#241118]">Made by Romit Seth</span>
          </div>
          <span>Protected by Firebase Authentication &amp; private Firestore user diaries.</span>
        </div>
      </footer>
    </div>
  );
}
