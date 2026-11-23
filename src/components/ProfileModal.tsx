import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type {
  DailyNutritionGoals,
  DietActivityLevel,
  DietaryPreference,
  DietFitnessGoal,
  UserDietProfile,
} from '../types/nutrition';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyGoals: DailyNutritionGoals;
  totalLoggedMeals: number;
  onSaveDietProfile?: (profile: UserDietProfile) => Promise<void>;
  onShowToast?: (message: string) => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  dailyGoals,
  totalLoggedMeals,
  onSaveDietProfile,
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
  const currentDietProfile = userProfile?.dietProfile || {};

  const [nameInput, setNameInput] = useState(currentName);
  const [ageInput, setAgeInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [activityLevel, setActivityLevel] = useState<DietActivityLevel | ''>('');
  const [fitnessGoal, setFitnessGoal] = useState<DietFitnessGoal | ''>('');
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference | ''>('');

  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingDietProfile, setIsSavingDietProfile] = useState(false);
  const [isRefreshingVerify, setIsRefreshingVerify] = useState(false);
  const [isResendingVerify, setIsResendingVerify] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      setNameInput(currentName);
      setAgeInput(
        typeof currentDietProfile.age === 'number' ? String(currentDietProfile.age) : ''
      );
      setHeightInput(
        typeof currentDietProfile.heightCm === 'number'
          ? String(currentDietProfile.heightCm)
          : ''
      );
      setWeightInput(
        typeof currentDietProfile.weightKg === 'number'
          ? String(currentDietProfile.weightKg)
          : ''
      );
      setActivityLevel(currentDietProfile.activityLevel || '');
      setFitnessGoal(currentDietProfile.fitnessGoal || '');
      setDietaryPreference(currentDietProfile.dietaryPreference || '');
      setFeedback(null);
    }
  }, [
    isOpen,
    currentName,
    currentDietProfile.age,
    currentDietProfile.heightCm,
    currentDietProfile.weightKg,
    currentDietProfile.activityLevel,
    currentDietProfile.fitnessGoal,
    currentDietProfile.dietaryPreference,
  ]);

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

  async function handleSaveDietDetails(event: React.FormEvent) {
    event.preventDefault();
    if (!onSaveDietProfile) return;

    const nextProfile: UserDietProfile = {};
    if (currentDietProfile.sex) nextProfile.sex = currentDietProfile.sex;
    if (typeof currentDietProfile.dailyBudgetInr === 'number') {
      nextProfile.dailyBudgetInr = currentDietProfile.dailyBudgetInr;
    }
    if (ageInput.trim()) {
      const parsedAge = Number(ageInput);
      if (!Number.isFinite(parsedAge) || parsedAge < 13 || parsedAge > 100) {
        setFeedback({ type: 'error', text: 'Please enter a valid age between 13 and 100.' });
        return;
      }
      nextProfile.age = Math.round(parsedAge);
    }
    if (heightInput.trim()) {
      const parsedHeight = Number(heightInput);
      if (!Number.isFinite(parsedHeight) || parsedHeight < 100 || parsedHeight > 250) {
        setFeedback({
          type: 'error',
          text: 'Please enter a valid height in cm (between 100 and 250 cm).',
        });
        return;
      }
      nextProfile.heightCm = Math.round(parsedHeight * 10) / 10;
    }
    if (weightInput.trim()) {
      const parsedWeight = Number(weightInput);
      if (!Number.isFinite(parsedWeight) || parsedWeight < 25 || parsedWeight > 300) {
        setFeedback({
          type: 'error',
          text: 'Please enter a valid weight in kg (between 25 and 300 kg).',
        });
        return;
      }
      nextProfile.weightKg = Math.round(parsedWeight * 10) / 10;
    }
    if (activityLevel) nextProfile.activityLevel = activityLevel;
    if (fitnessGoal) nextProfile.fitnessGoal = fitnessGoal;
    if (dietaryPreference) nextProfile.dietaryPreference = dietaryPreference;

    setIsSavingDietProfile(true);
    setFeedback(null);
    try {
      await onSaveDietProfile(nextProfile);
      setFeedback({
        type: 'success',
        text: 'Diet & body profile saved. Your AI Diet Assistant will use these details.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not save diet profile.',
      });
    } finally {
      setIsSavingDietProfile(false);
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
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#EEDCE0] bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#EEDCE0] px-5 py-4">
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

        <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
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

          {/* Personal Diet & Body Profile */}
          {onSaveDietProfile && (
            <form
              onSubmit={handleSaveDietDetails}
              className="space-y-3 rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
                  <h3 className="font-display text-sm font-semibold text-[#241118]">
                    Diet Assistant Profile
                  </h3>
                </div>
                <span className="text-[11px] text-[#7E6069]">Used by Voice AI</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <label className="block">
                  <span className="text-[11px] font-medium text-[#644A52]">Age (yrs)</span>
                  <input
                    type="number"
                    min={13}
                    max={100}
                    placeholder="e.g. 26"
                    value={ageInput}
                    onChange={(e) => setAgeInput(e.target.value)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] bg-white px-2.5 py-1.5 font-mono text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[#644A52]">Height (cm)</span>
                  <input
                    type="number"
                    min={100}
                    max={250}
                    step="0.5"
                    placeholder="e.g. 172"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] bg-white px-2.5 py-1.5 font-mono text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[#644A52]">Weight (kg)</span>
                  <input
                    type="number"
                    min={25}
                    max={300}
                    step="0.5"
                    placeholder="e.g. 68"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] bg-white px-2.5 py-1.5 font-mono text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-[#644A52]">Activity Level</span>
                  <select
                    value={activityLevel}
                    onChange={(e) =>
                      setActivityLevel(e.target.value as DietActivityLevel | '')
                    }
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] bg-white px-2.5 py-1.5 text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                  >
                    <option value="">Not specified</option>
                    <option value="sedentary">Sedentary (Desk / Minimal)</option>
                    <option value="light">Lightly Active (1-3x/wk)</option>
                    <option value="moderate">Moderately Active (3-5x/wk)</option>
                    <option value="active">Very Active (6-7x/wk)</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-medium text-[#644A52]">Fitness Goal</span>
                  <select
                    value={fitnessGoal}
                    onChange={(e) => setFitnessGoal(e.target.value as DietFitnessGoal | '')}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] bg-white px-2.5 py-1.5 text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                  >
                    <option value="">Not specified</option>
                    <option value="weight_loss">Weight Loss</option>
                    <option value="weight_gain">Weight Gain</option>
                    <option value="muscle_building">Muscle Building</option>
                    <option value="maintenance">Balanced Maintenance</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                <label className="block flex-1">
                  <span className="text-[11px] font-medium text-[#644A52]">
                    Food Preference
                  </span>
                  <select
                    value={dietaryPreference}
                    onChange={(e) =>
                      setDietaryPreference(e.target.value as DietaryPreference | '')
                    }
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] bg-white px-2.5 py-1.5 text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                  >
                    <option value="">Not specified</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="non-vegetarian">Non-Vegetarian</option>
                    <option value="eggetarian">Eggetarian</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </label>

                <button
                  type="submit"
                  disabled={isSavingDietProfile}
                  className="min-h-[38px] rounded-lg bg-[#BE123C] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#9F1239] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {isSavingDietProfile ? 'Saving...' : 'Save Diet Details'}
                </button>
              </div>
            </form>
          )}

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

