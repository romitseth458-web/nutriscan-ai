import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { DailyNutritionGoals } from '../types/nutrition';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyGoals: DailyNutritionGoals;
  totalLoggedMeals: number;
  onShowToast?: (message: string) => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  dailyGoals,
  totalLoggedMeals,
  onShowToast,
}: ProfileModalProps) {
  const {
    user,
    userProfile,
    updateDisplayName,
    resendVerificationEmail,
    refreshAuthUser,
    logout,
  } = useAuth();

  const currentName =
    userProfile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'RosoFood Member';
  const currentEmail = userProfile?.email || user?.email || '';

  const [nameInput, setNameInput] = useState(currentName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isRefreshingVerify, setIsRefreshingVerify] = useState(false);
  const [isResendingVerify, setIsResendingVerify] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      setNameInput(currentName);
      setFeedback(null);
    }
  }, [isOpen, currentName]);

  if (!isOpen || !user) return null;

  const initials = currentName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  async function handleSaveName(event: React.FormEvent) {
    event.preventDefault();
    if (!nameInput.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a valid display name.' });
      return;
    }
    setIsSavingName(true);
    setFeedback(null);
    try {
      await updateDisplayName(nameInput.trim());
      setFeedback({ type: 'success', text: 'Profile name updated.' });
      onShowToast?.('Profile updated');
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not update profile name.',
      });
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleResendVerification() {
    setIsResendingVerify(true);
    setFeedback(null);
    try {
      await resendVerificationEmail();
      setFeedback({
        type: 'success',
        text: `Verification link resent to ${currentEmail}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to resend verification email.',
      });
    } finally {
      setIsResendingVerify(false);
    }
  }

  async function handleRefreshVerification() {
    setIsRefreshingVerify(true);
    setFeedback(null);
    try {
      const verified = await refreshAuthUser();
      setFeedback(
        verified
          ? { type: 'success', text: 'Email verified! Your cloud diary sync is now active.' }
          : {
              type: 'error',
              text: 'Email is not verified yet. Please click the link sent to your inbox first.',
            }
      );
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to refresh account status.',
      });
    } finally {
      setIsRefreshingVerify(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      onClose();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#241118]/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#EEDCE0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EEDCE0] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <UserIcon className="h-5 w-5 text-[#BE123C]" aria-hidden="true" />
            <h2 id="profile-modal-title" className="font-display text-base font-bold text-[#241118]">
              Your RosoFood AI Profile
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile dialog"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#644A52] hover:bg-[#FDF3F5] hover:text-[#241118] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {/* Identity Summary */}
          <div className="flex items-center gap-4 rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-4">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={currentName}
                referrerPolicy="no-referrer"
                className="h-12 w-12 shrink-0 rounded-full border border-[#EEDCE0] object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#BE123C] font-display text-base font-bold text-white">
                {initials || 'RF'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-bold text-[#241118]">
                {currentName}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[#644A52]">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[#BE123C]" aria-hidden="true" />
                <span className="truncate">{currentEmail}</span>
              </p>
              <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium">
                {user.emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Verified Account · Cloud Sync Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-800">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    Email Verification Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {!user.emailVerified && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
              <p className="leading-relaxed">
                Verify <strong>{currentEmail}</strong> to save meals and targets to your private
                cloud food diary.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isResendingVerify}
                  onClick={() => void handleResendVerification()}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                >
                  {isResendingVerify ? 'Sending...' : 'Resend Email'}
                </button>
                <button
                  type="button"
                  disabled={isRefreshingVerify}
                  onClick={() => void handleRefreshVerification()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#241118] px-3 py-1.5 font-semibold text-white hover:bg-[#3A1E28] disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${isRefreshingVerify ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  Refresh Status
                </button>
              </div>
            </div>
          )}

          {/* Edit Display Name */}
          <form onSubmit={handleSaveName} className="space-y-2.5">
            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Display Name</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="min-h-[40px] flex-1 rounded-lg border border-[#E5CFD4] px-3 py-1.5 text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSavingName}
                  className="min-h-[40px] rounded-lg bg-[#241118] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#3A1E28] disabled:opacity-50 cursor-pointer"
                >
                  {isSavingName ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </label>
          </form>

          {/* Private Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3">
              <p className="text-[11px] font-medium text-[#7E6069]">Daily Calorie Goal</p>
              <p className="mt-1 font-mono text-lg font-bold text-[#241118] tabular-nums">
                {dailyGoals.caloriesKcal} kcal
              </p>
            </div>
            <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3">
              <p className="text-[11px] font-medium text-[#7E6069]">Saved Meals</p>
              <p className="mt-1 font-mono text-lg font-bold text-[#241118] tabular-nums">
                {totalLoggedMeals}
              </p>
            </div>
          </div>

          {feedback && (
            <div
              role="status"
              className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Logout */}
          <div className="border-t border-[#F6E9EC] pt-4">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
              {isLoggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
