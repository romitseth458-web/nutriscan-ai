import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Heart,
  Loader2,
  RefreshCw,
  Share2,
  WifiOff,
  X,
} from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useAuth } from './context/AuthContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { AuthScreen } from './components/AuthScreen';
import { Navbar } from './components/Navbar';
import { FoodUploadStudio } from './components/FoodUploadStudio';
import { HowItWorksSection } from './components/HowItWorksSection';
import { FoodExplorerSection } from './components/FoodExplorerSection';
import { ResultsDashboard } from './components/ResultsDashboard';
import { DietSuggestionsSection } from './components/DietSuggestionsSection';
import { DailyTrackerSection } from './components/DailyTrackerSection';
import { MealPlannerSection } from './components/MealPlannerSection';
import { WaterTrackerSection } from './components/WaterTrackerSection';
import { WeeklyReportSection } from './components/WeeklyReportSection';
import { FaqSection } from './components/FaqSection';
import { GoalCalculatorModal } from './components/GoalCalculatorModal';
import { ProfileModal } from './components/ProfileModal';
import { VoiceDietAssistantModal } from './components/VoiceDietAssistantModal';
import {
  deleteMealPlanForUser,
  saveMealPlanForUser,
  subscribeToUserMealPlans,
} from './services/mealPlanService';
import {
  clearDayMealsForUser,
  deleteMealForUser,
  saveMealForUser,
  saveUserDailyGoals,
  saveUserDietProfile,
  saveUserWaterGoal,
  subscribeToUserMeals,
} from './services/userMealsService';
import {
  addWaterLogForUser,
  deleteWaterLogForUser,
  subscribeToUserWaterLogs,
} from './services/waterTrackerService';
import {
  deleteWeeklyReportForUser,
  saveWeeklyReportForUser,
  subscribeToUserWeeklyReports,
} from './services/weeklyReportService';
import type {
  DailyNutritionGoals,
  FoodAnalysisResult,
  IndianMealPlan,
  MealCategory,
  TrackedMealEntry,
  UserDietProfile,
  WaterLogEntry,
  WeeklyReportRecord,
} from './types/nutrition';
import type { PreparedFoodImage } from './utils/imageUtils';
import {
  DEFAULT_DAILY_GOALS,
  DEFAULT_WATER_GOAL_ML,
  getLocalDateKey,
} from './utils/storage';

export default function App() {
  const {
    user,
    authReady,
    userProfile,
    resendVerificationEmail,
    refreshAuthUser,
    logout,
  } = useAuth();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAnalyzingRef = useRef(false);
  const isOnline = useOnlineStatus();

  const [selectedImage, setSelectedImage] = useState<PreparedFoodImage | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGoalCalcOpen, setIsGoalCalcOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [isCheckingVerify, setIsCheckingVerify] = useState(false);

  const [trackedMeals, setTrackedMeals] = useState<TrackedMealEntry[]>([]);
  const [savedMealPlans, setSavedMealPlans] = useState<IndianMealPlan[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLogEntry[]>([]);
  const [savedWeeklyReports, setSavedWeeklyReports] = useState<WeeklyReportRecord[]>([]);
  const [waterGoalMl, setWaterGoalMl] = useState<number>(DEFAULT_WATER_GOAL_ML);
  const [todayDateKey, setTodayDateKey] = useState<string>(() => getLocalDateKey());
  const [dailyGoals, setDailyGoals] = useState<DailyNutritionGoals>(DEFAULT_DAILY_GOALS);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getLocalDateKey());

  // Automatically detect local-date rollover at midnight or tab focus without erasing history
  useEffect(() => {
    const syncLocalDate = () => {
      const current = getLocalDateKey();
      setTodayDateKey((prev) => {
        if (prev !== current) {
          setSelectedDateKey((sel) => (sel === prev ? current : sel));
        }
        return current;
      });
    };

    const intervalId = window.setInterval(syncLocalDate, 30_000);
    window.addEventListener('focus', syncLocalDate);
    document.addEventListener('visibilitychange', syncLocalDate);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncLocalDate);
      document.removeEventListener('visibilitychange', syncLocalDate);
    };
  }, []);

  // Sync user's private daily goals & water goal from their Firestore profile
  useEffect(() => {
    if (userProfile?.dailyGoals) {
      setDailyGoals(userProfile.dailyGoals);
    } else if (!user) {
      setDailyGoals(DEFAULT_DAILY_GOALS);
    }

    if (typeof userProfile?.dailyWaterGoalMl === 'number') {
      setWaterGoalMl(userProfile.dailyWaterGoalMl);
    } else if (!user) {
      setWaterGoalMl(DEFAULT_WATER_GOAL_ML);
    }
  }, [userProfile, user]);

  // Clear state when user signs out or switches accounts, and attach private Firestore listeners
  useEffect(() => {
    if (!authReady || !user) {
      setTrackedMeals([]);
      setSavedMealPlans([]);
      setWaterLogs([]);
      setSavedWeeklyReports([]);
      setSelectedImage(null);
      setActivePreviewUrl(null);
      setAnalysisResult(null);
      setErrorMessage(null);
      setIsProfileOpen(false);
      setIsVoiceAssistantOpen(false);
      return;
    }

    if (!user.emailVerified) {
      setTrackedMeals([]);
      setSavedMealPlans([]);
      setWaterLogs([]);
      setSavedWeeklyReports([]);
      return;
    }

    const unsubscribeMeals = subscribeToUserMeals(user.uid, (meals) => {
      setTrackedMeals(meals);
    });
    const unsubscribePlans = subscribeToUserMealPlans(user.uid, (plans) => {
      setSavedMealPlans(plans);
    });
    const unsubscribeWater = subscribeToUserWaterLogs(user.uid, (logs) => {
      setWaterLogs(logs);
    });
    const unsubscribeWeeklyReports = subscribeToUserWeeklyReports(user.uid, (reports) => {
      setSavedWeeklyReports(reports);
    });

    return () => {
      unsubscribeMeals();
      unsubscribePlans();
      unsubscribeWater();
      unsubscribeWeeklyReports();
    };
  }, [authReady, user, user?.uid, user?.emailVerified]);

  function showToast(message: string) {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 3200);
  }

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleNavbarUploadClick() {
    scrollToSection('analyzer');
    window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 220);
  }

  async function handleAnalyzeFood(image: PreparedFoodImage, clarification?: string) {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setErrorMessage(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 33_000);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          imageBase64: image.base64,
          mimeType: image.mimeType,
          clarification,
        }),
      });

      const rawText = await response.text();
      let payload: (FoodAnalysisResult & { error?: string }) | null = null;
      if (rawText) {
        try {
          payload = JSON.parse(rawText) as FoodAnalysisResult & { error?: string };
        } catch {
          payload = null;
        }
      }

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error(
            'The uploaded image is too large for the server. Please select a smaller photo.'
          );
        }
        if (response.status === 504) {
          throw new Error(
            'The nutrition analysis request timed out. Please try again in a few seconds.'
          );
        }
        throw new Error(
          payload?.error ||
            `Food analysis failed (HTTP ${response.status}). Please try again.`
        );
      }

      if (!payload || typeof payload.identificationStatus !== 'string' || !payload.totals) {
        throw new Error('Received an unexpected response format from the analysis service.');
      }

      setAnalysisResult(payload);
      setActivePreviewUrl(image.previewDataUrl);

      if (payload.identificationStatus === 'identified') {
        showToast(`Analysis complete: ${payload.mealTitle}`);
        window.setTimeout(() => scrollToSection('results'), 150);
      }
    } catch (error) {
      const msg =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Food image analysis timed out after 33 seconds. Please check your connection and retry.'
          : error instanceof Error
            ? error.message
            : 'Unable to reach the nutrition analysis service.';
      setErrorMessage(msg);
    } finally {
      window.clearTimeout(timeoutId);
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }

  async function persistMealEntry(category: MealCategory, analysis: FoodAnalysisResult, thumb: string) {
    if (!user) return;
    if (!user.emailVerified) {
      showToast('Please verify your email address first to save meals to your private diary.');
      setIsProfileOpen(true);
      return;
    }

    const todayKey = getLocalDateKey();
    const newEntry: TrackedMealEntry = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `meal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dateKey: todayKey,
      loggedAtIso: new Date().toISOString(),
      mealCategory: category,
      imageThumbnailDataUrl: thumb,
      analysis,
    };

    try {
      await saveMealForUser(user.uid, newEntry);
      setSelectedDateKey(todayKey);
      showToast(`Saved "${analysis.mealTitle}" to your private diary`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save meal right now.');
    }
  }

  function handleAddToTracker(category: MealCategory, scaledAnalysis: FoodAnalysisResult) {
    if (scaledAnalysis.identificationStatus !== 'identified') return;
    void persistMealEntry(
      category,
      scaledAnalysis,
      selectedImage?.thumbnailDataUrl || activePreviewUrl || ''
    );
  }

  async function handleDeleteEntry(id: string) {
    if (!user || !user.emailVerified) return;
    try {
      await deleteMealForUser(user.uid, id);
      showToast('Meal entry removed from diary');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete meal entry.');
    }
  }

  async function handleClearDay(dateKey: string) {
    if (!user || !user.emailVerified) return;
    const idsForDay = trackedMeals.filter((m) => m.dateKey === dateKey).map((m) => m.id);
    if (idsForDay.length === 0) return;
    try {
      await clearDayMealsForUser(user.uid, idsForDay);
      showToast(`Cleared entries for ${dateKey}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to clear entries.');
    }
  }

  async function handleUpdateGoals(newGoals: DailyNutritionGoals) {
    setDailyGoals(newGoals);
    if (!user || !user.emailVerified) {
      showToast('Verify your email to save targets permanently to your account.');
      return;
    }
    try {
      await saveUserDailyGoals(user.uid, newGoals);
      showToast(`Saved daily target: ${newGoals.caloriesKcal} kcal`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save nutrition targets.');
    }
  }

  async function handleSaveDietProfile(nextProfile: UserDietProfile) {
    if (!user) return;
    if (!user.emailVerified) {
      showToast('Verify your email address first to save your diet profile in Firestore.');
      return;
    }
    await saveUserDietProfile(user.uid, nextProfile);
    showToast('Saved your diet & body profile');
  }

  async function handleSaveMealPlan(plan: IndianMealPlan): Promise<string> {
    if (!user) return plan.id;
    if (!user.emailVerified) {
      showToast('Verify your email address first to save meal plans in Firestore.');
      return plan.id;
    }
    return saveMealPlanForUser(user.uid, plan);
  }

  async function handleDeleteMealPlan(planId: string) {
    if (!user || !user.emailVerified) return;
    try {
      await deleteMealPlanForUser(user.uid, planId);
      showToast('Saved meal plan removed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete meal plan.');
    }
  }

  async function handleUpdateWaterGoal(goalMl: number) {
    if (!user) return;
    if (!user.emailVerified) {
      showToast('Verify your email address first to save your daily water goal.');
      setIsProfileOpen(true);
      return;
    }
    setWaterGoalMl(goalMl);
    await saveUserWaterGoal(user.uid, goalMl);
    showToast(`Saved daily water goal: ${goalMl.toLocaleString()} ml`);
  }

  async function handleAddWater(amountMl: number, dateKey: string) {
    if (!user) return;
    if (!user.emailVerified) {
      showToast('Verify your email address first to save water logs to your private diary.');
      setIsProfileOpen(true);
      return;
    }
    const entry: WaterLogEntry = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `water-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dateKey,
      loggedAtIso: new Date().toISOString(),
      amountMl,
    };
    await addWaterLogForUser(user.uid, entry);
    showToast(`Logged +${amountMl} ml water`);
  }

  async function handleDeleteWaterEntry(entryId: string) {
    if (!user || !user.emailVerified) return;
    await deleteWaterLogForUser(user.uid, entryId);
    showToast('Water entry removed');
  }

  async function handleSaveWeeklyReport(
    report: Omit<WeeklyReportRecord, 'id' | 'updatedAtIso'> & { id?: string }
  ): Promise<string> {
    if (!user) return report.id || `week-${report.endDateKey}`;
    if (!user.emailVerified) {
      showToast('Verify your email address first to save weekly reports in Firestore.');
      setIsProfileOpen(true);
      return report.id || `week-${report.endDateKey}`;
    }
    return saveWeeklyReportForUser(user.uid, report);
  }

  async function handleDeleteWeeklyReport(reportId: string) {
    if (!user || !user.emailVerified) return;
    await deleteWeeklyReportForUser(user.uid, reportId);
  }

  function handleInspectEntry(entry: TrackedMealEntry) {
    setAnalysisResult(entry.analysis);
    setActivePreviewUrl(entry.imageThumbnailDataUrl || null);
    scrollToSection('results');
  }

  async function handleShareText(title: string, text: string, successToast: string) {
    const shareUrl = window.location.origin;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch {
        // User cancelled or Web Share unavailable in iframe — fall back to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      showToast(successToast);
    } catch {
      showToast(`Share URL: ${shareUrl}`);
    }
  }

  function handleShareMeal(scaled: FoodAnalysisResult) {
    const summary = `${scaled.mealTitle} (${scaled.estimatedServingSizeGrams} g): ${scaled.totals.caloriesKcal} kcal · Protein ${scaled.totals.proteinGrams}g · Carbs ${scaled.totals.carbsGrams}g · Fat ${scaled.totals.fatGrams}g · Fiber ${scaled.totals.fiberGrams}g — Analyzed with RosoFood AI`;
    void handleShareText(
      `${scaled.mealTitle} — RosoFood AI`,
      summary,
      'Nutrition summary & website link copied'
    );
  }

  async function handleRefreshVerifyBanner() {
    setIsCheckingVerify(true);
    try {
      const ok = await refreshAuthUser();
      showToast(
        ok
          ? 'Email verified! Your cloud meal diary is active.'
          : 'Not verified yet. Please click the verification link in your email.'
      );
    } catch {
      showToast('Unable to check verification status right now.');
    } finally {
      setIsCheckingVerify(false);
    }
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFF8F9] px-4 text-[#241118]">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#BE123C] text-white shadow-sm">
          <Heart className="h-6 w-6 fill-current" aria-hidden="true" />
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-[#644A52]">
          <Loader2 className="h-4 w-4 animate-spin text-[#BE123C]" aria-hidden="true" />
          Loading RosoFood AI...
        </div>
      </div>
    );
  }

  // Strictly protect dashboard, scanner, and food history behind Firebase Authentication
  if (!user) {
    return (
      <MotionConfig reducedMotion="user">
        <AuthScreen onShowToast={showToast} />
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed right-4 bottom-4 z-50 flex items-center gap-2.5 rounded-xl border border-[#BE123C]/25 bg-[#241118] px-4 py-3 text-sm font-medium text-white shadow-lg"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              aria-label="Close notification"
              className="ml-1 text-white/70 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </MotionConfig>
    );
  }

  const displayName =
    userProfile?.displayName ||
    user.displayName ||
    user.email?.split('@')[0] ||
    'RosoFood Member';
  const email = userProfile?.email || user.email || '';

  return (
    <MotionConfig reducedMotion="user">
      <div id="top" className="min-h-screen flex flex-col bg-white text-[#241118]">
        <Navbar
          onUploadClick={handleNavbarUploadClick}
          onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
          onShowToast={showToast}
          userDisplayName={displayName}
          userEmail={email}
          userPhotoUrl={user.photoURL || undefined}
          onOpenProfile={() => setIsProfileOpen(true)}
          onLogout={() => void logout()}
        />

        {!user.emailVerified && (
          <div
            role="status"
            className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950"
          >
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <span>
                  Verify <strong>{email}</strong> to save meals and nutrition goals privately in
                  Firebase Firestore.
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void resendVerificationEmail()
                      .then(() => showToast(`Verification email sent to ${email}`))
                      .catch((e) =>
                        showToast(e instanceof Error ? e.message : 'Unable to send email')
                      )
                  }
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1 font-semibold text-amber-950 hover:bg-amber-100 cursor-pointer"
                >
                  Resend Email
                </button>
                <button
                  type="button"
                  disabled={isCheckingVerify}
                  onClick={() => void handleRefreshVerifyBanner()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#241118] px-3 py-1 font-semibold text-white hover:bg-[#3A1E28] disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${isCheckingVerify ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs font-medium text-amber-950"
          >
            <span className="inline-flex items-center gap-2">
              <WifiOff className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
              Offline Mode — Saved Daily Diary meals and the Food &amp; Fruit Directory remain
              available. Internet is required for new AI scans.
            </span>
          </div>
        )}

        <main className="flex-1">
          <FoodUploadStudio
            selectedImage={selectedImage}
            onSelectImage={(img) => {
              setSelectedImage(img);
              if (!img) {
                setActivePreviewUrl(null);
              }
              setAnalysisResult((prev) =>
                prev && prev.identificationStatus !== 'identified' ? null : prev
              );
            }}
            onAnalyze={handleAnalyzeFood}
            isAnalyzing={isAnalyzing}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
            analysisResult={analysisResult}
            fileInputRef={fileInputRef}
            onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
            onShowToast={showToast}
          />

          <HowItWorksSection onOpenCalculator={() => setIsGoalCalcOpen(true)} />

          <FoodExplorerSection
            onInspectAnalysis={(analysis) => {
              setAnalysisResult(analysis);
              setActivePreviewUrl(null);
              showToast(`Loaded nutrition for ${analysis.mealTitle}`);
              scrollToSection('results');
            }}
            onQuickLogFood={(analysis, category) => {
              void persistMealEntry(category, analysis, '');
            }}
          />

          <ResultsDashboard
            analysis={analysisResult}
            imagePreviewUrl={activePreviewUrl}
            dailyGoals={dailyGoals}
            onAddToTracker={handleAddToTracker}
            onShareMeal={handleShareMeal}
            onJumpToUpload={() => scrollToSection('analyzer')}
          />

          <DietSuggestionsSection analysis={analysisResult} />

          <MealPlannerSection
            dietProfile={userProfile?.dietProfile}
            savedPlans={savedMealPlans}
            isEmailVerified={Boolean(user.emailVerified)}
            onSaveDietProfile={handleSaveDietProfile}
            onSaveMealPlan={handleSaveMealPlan}
            onDeleteMealPlan={handleDeleteMealPlan}
            onLogPlannedMeal={async (category, analysis) => {
              await persistMealEntry(category, analysis, '');
            }}
            onShowToast={showToast}
          />

          <DailyTrackerSection
            entries={trackedMeals}
            selectedDateKey={selectedDateKey}
            onChangeDateKey={setSelectedDateKey}
            dailyGoals={dailyGoals}
            onUpdateGoals={(goals) => void handleUpdateGoals(goals)}
            onOpenCalculator={() => setIsGoalCalcOpen(true)}
            onDeleteEntry={(id) => void handleDeleteEntry(id)}
            onClearDay={(dateKey) => void handleClearDay(dateKey)}
            onInspectEntry={handleInspectEntry}
            onJumpToUpload={() => scrollToSection('analyzer')}
            onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
          />

          <WaterTrackerSection
            entries={waterLogs}
            waterGoalMl={waterGoalMl}
            todayDateKey={todayDateKey}
            isEmailVerified={Boolean(user.emailVerified)}
            onUpdateWaterGoal={handleUpdateWaterGoal}
            onAddWater={handleAddWater}
            onDeleteWaterEntry={handleDeleteWaterEntry}
          />

          <WeeklyReportSection
            meals={trackedMeals}
            waterLogs={waterLogs}
            dailyGoals={dailyGoals}
            waterGoalMl={waterGoalMl}
            todayDateKey={todayDateKey}
            dietProfile={userProfile?.dietProfile}
            savedReports={savedWeeklyReports}
            isEmailVerified={Boolean(user.emailVerified)}
            onSaveWeeklyReport={handleSaveWeeklyReport}
            onDeleteWeeklyReport={handleDeleteWeeklyReport}
            onShowToast={showToast}
          />

          <FaqSection />
        </main>

        {/* Footer */}
        <footer className="border-t border-[#EEDCE0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
              <div className="max-w-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#BE123C] text-white">
                    <Heart className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  </span>
                  <span className="font-display text-base font-bold text-[#241118]">
                    RosoFood AI
                  </span>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-[#7E6069]">
                  Crafted with love for everyday mindful eating. All calorie and macro numbers are
                  AI estimates for wellness awareness, not medical advice.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-medium text-[#644A52]">
                <a href="#analyzer" className="hover:text-[#241118]">
                  Food Scanner
                </a>
                <a href="#food-directory" className="hover:text-[#241118]">
                  Foods &amp; Fruits
                </a>
                <a href="#meal-planner" className="hover:text-[#241118]">
                  AI Meal Planner
                </a>
                <a href="#water-tracker" className="hover:text-[#241118]">
                  Water Tracker
                </a>
                <a href="#weekly-report" className="hover:text-[#241118]">
                  Weekly Report
                </a>
                <a href="#results" className="hover:text-[#241118]">
                  Nutrition Dashboard
                </a>
                <a href="#diet-guide" className="hover:text-[#241118]">
                  Diet Suggestions
                </a>
                <a href="#daily-tracker" className="hover:text-[#241118]">
                  Food Diary
                </a>
                <a href="#faq" className="hover:text-[#241118]">
                  FAQ
                </a>
                <button
                  type="button"
                  onClick={() =>
                    void handleShareText(
                      'RosoFood AI — Food Calorie & Macro Estimator',
                      'Check food & fruit calories, macros, and diet suggestions with RosoFood AI:',
                      'Website link copied to clipboard'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-3 py-1.5 text-xs font-semibold text-[#BE123C] hover:bg-[#FDF2F4] cursor-pointer"
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy Link
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Check food & fruit calories, macros, and diet suggestions on RosoFood AI: ${typeof window !== 'undefined' ? window.location.origin : ''}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#BE123C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9F1239]"
                >
                  Share on WhatsApp
                </a>
              </div>
            </div>

            <div className="mt-8 flex flex-col justify-between gap-2 border-t border-[#F6E9EC] pt-6 text-xs text-[#7E6069] sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <span>© {new Date().getFullYear()} RosoFood AI</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-[#241118]">Made by Romit Seth</span>
              </div>
              <span>Each account&apos;s meal diary is stored privately in Firebase Firestore.</span>
            </div>
          </div>
        </footer>

        <GoalCalculatorModal
          isOpen={isGoalCalcOpen}
          onClose={() => setIsGoalCalcOpen(false)}
          onApplyGoals={(newGoals) => {
            void handleUpdateGoals(newGoals);
            scrollToSection('daily-tracker');
          }}
        />

        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          dailyGoals={dailyGoals}
          totalLoggedMeals={trackedMeals.length}
          onSaveDietProfile={handleSaveDietProfile}
          onShowToast={showToast}
        />

        <VoiceDietAssistantModal
          isOpen={isVoiceAssistantOpen}
          onClose={() => setIsVoiceAssistantOpen(false)}
          user={user}
          displayName={displayName}
          dailyGoals={dailyGoals}
          dietProfile={userProfile?.dietProfile}
          trackedMeals={trackedMeals}
          selectedDateKey={selectedDateKey}
          onSaveDietProfile={handleSaveDietProfile}
          onUpdateGoals={handleUpdateGoals}
          onShowToast={showToast}
        />

        {/* Non-blocking success toast */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed right-4 bottom-4 z-50 flex items-center gap-2.5 rounded-xl border border-[#BE123C]/25 bg-[#241118] px-4 py-3 text-sm font-medium text-white shadow-lg"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              aria-label="Close notification"
              className="ml-1 text-white/70 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
