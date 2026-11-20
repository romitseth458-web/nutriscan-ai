import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Heart, Share2, WifiOff, X } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Navbar } from './components/Navbar';
import { FoodUploadStudio } from './components/FoodUploadStudio';
import { HowItWorksSection } from './components/HowItWorksSection';
import { FoodExplorerSection } from './components/FoodExplorerSection';
import { ResultsDashboard } from './components/ResultsDashboard';
import { DietSuggestionsSection } from './components/DietSuggestionsSection';
import { DailyTrackerSection } from './components/DailyTrackerSection';
import { FaqSection } from './components/FaqSection';
import { GoalCalculatorModal } from './components/GoalCalculatorModal';
import type {
  DailyNutritionGoals,
  FoodAnalysisResult,
  MealCategory,
  TrackedMealEntry,
} from './types/nutrition';
import type { PreparedFoodImage } from './utils/imageUtils';
import {
  getLocalDateKey,
  loadDailyGoals,
  loadTrackedMeals,
  saveDailyGoals,
  saveTrackedMeals,
} from './utils/storage';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isOnline = useOnlineStatus();

  const [selectedImage, setSelectedImage] = useState<PreparedFoodImage | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGoalCalcOpen, setIsGoalCalcOpen] = useState(false);

  const [trackedMeals, setTrackedMeals] = useState<TrackedMealEntry[]>(() => loadTrackedMeals());
  const [dailyGoals, setDailyGoals] = useState<DailyNutritionGoals>(() => loadDailyGoals());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getLocalDateKey());

  useEffect(() => {
    saveTrackedMeals(trackedMeals);
  }, [trackedMeals]);

  useEffect(() => {
    saveDailyGoals(dailyGoals);
  }, [dailyGoals]);

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
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: image.base64,
          mimeType: image.mimeType,
          clarification,
        }),
      });

      const payload = (await response.json()) as FoodAnalysisResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to analyze food image.');
      }

      setAnalysisResult(payload);
      setActivePreviewUrl(image.previewDataUrl);

      if (payload.identificationStatus === 'identified') {
        showToast(`Analysis complete: ${payload.mealTitle}`);
        window.setTimeout(() => scrollToSection('results'), 150);
      }
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Unable to reach the nutrition analysis service.';
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleAddToTracker(category: MealCategory, scaledAnalysis: FoodAnalysisResult) {
    if (scaledAnalysis.identificationStatus !== 'identified') return;

    const todayKey = getLocalDateKey();
    const newEntry: TrackedMealEntry = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `meal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dateKey: todayKey,
      loggedAtIso: new Date().toISOString(),
      mealCategory: category,
      imageThumbnailDataUrl: selectedImage?.thumbnailDataUrl || activePreviewUrl || '',
      analysis: scaledAnalysis,
    };

    setTrackedMeals((prev) => [newEntry, ...prev]);
    setSelectedDateKey(todayKey);
    showToast(`Saved "${scaledAnalysis.mealTitle}" to Daily Diary`);
  }

  function handleDeleteEntry(id: string) {
    setTrackedMeals((prev) => prev.filter((item) => item.id !== id));
    showToast('Meal entry removed from diary');
  }

  function handleClearDay(dateKey: string) {
    setTrackedMeals((prev) => prev.filter((item) => item.dateKey !== dateKey));
    showToast(`Cleared entries for ${dateKey}`);
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

  return (
    <MotionConfig reducedMotion="user">
      <div id="top" className="min-h-screen flex flex-col bg-white text-[#241118]">
        <Navbar onUploadClick={handleNavbarUploadClick} onShowToast={showToast} />

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
            }}
            onAnalyze={handleAnalyzeFood}
            isAnalyzing={isAnalyzing}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
            analysisResult={analysisResult}
            fileInputRef={fileInputRef}
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
              const todayKey = getLocalDateKey();
              const newEntry: TrackedMealEntry = {
                id:
                  typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `meal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                dateKey: todayKey,
                loggedAtIso: new Date().toISOString(),
                mealCategory: category,
                imageThumbnailDataUrl: '',
                analysis,
              };
              setTrackedMeals((prev) => [newEntry, ...prev]);
              setSelectedDateKey(todayKey);
              showToast(`Logged "${analysis.mealTitle}" to Daily Diary`);
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

          <DailyTrackerSection
            entries={trackedMeals}
            selectedDateKey={selectedDateKey}
            onChangeDateKey={setSelectedDateKey}
            dailyGoals={dailyGoals}
            onUpdateGoals={setDailyGoals}
            onOpenCalculator={() => setIsGoalCalcOpen(true)}
            onDeleteEntry={handleDeleteEntry}
            onClearDay={handleClearDay}
            onInspectEntry={handleInspectEntry}
            onJumpToUpload={() => scrollToSection('analyzer')}
          />

          <FaqSection />
        </main>

        {/* Public Website Footer */}
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
              <span>Meal history stays private in your browser LocalStorage.</span>
            </div>
          </div>
        </footer>

        <GoalCalculatorModal
          isOpen={isGoalCalcOpen}
          onClose={() => setIsGoalCalcOpen(false)}
          onApplyGoals={(newGoals) => {
            setDailyGoals(newGoals);
            showToast(`Updated daily target to ${newGoals.caloriesKcal} kcal`);
            scrollToSection('daily-tracker');
          }}
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
