import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookmarkCheck,
  CalendarPlus,
  Check,
  ChefHat,
  Database,
  Droplets,
  IndianRupee,
  Info,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  computeMacrosFromReference,
  INDIAN_FOOD_REFERENCE_DB,
} from '../data/indianFoodReferenceDb';
import {
  mapPlanSlotToDiaryCategory,
  plannedMealToFoodAnalysis,
  recalculateMealAndPlanTotals,
} from '../services/mealPlanService';
import type {
  DietActivityLevel,
  DietaryPreference,
  DietBiologicalSex,
  DietFitnessGoal,
  FoodAnalysisResult,
  IndianMealPlan,
  MealCategory,
  MealPlannerInput,
  MealPlanSlotId,
  PlannedFoodItem,
  PlannedMeal,
  UserDietProfile,
} from '../types/nutrition';

interface MealPlannerSectionProps {
  dietProfile?: UserDietProfile;
  savedPlans: IndianMealPlan[];
  isEmailVerified: boolean;
  onSaveDietProfile: (profile: UserDietProfile) => Promise<void>;
  onSaveMealPlan: (plan: IndianMealPlan) => Promise<string>;
  onDeleteMealPlan: (planId: string) => Promise<void>;
  onLogPlannedMeal: (category: MealCategory, analysis: FoodAnalysisResult) => Promise<void>;
  onShowToast: (message: string) => void;
}

const BUDGET_PRESETS = [120, 200, 300, 450] as const;

function round1(val: number): number {
  return Math.round(Math.max(0, val) * 10) / 10;
}

function scalePlannedItemGrams(item: PlannedFoodItem, nextGramsRaw: number): PlannedFoodItem {
  const safeGrams = Math.max(10, Math.min(1500, Math.round(nextGramsRaw)));
  const prevGrams = Math.max(1, item.portionGrams);
  const ratio = safeGrams / prevGrams;

  const refEntry = item.referenceFoodId
    ? INDIAN_FOOD_REFERENCE_DB.find((r) => r.id === item.referenceFoodId)
    : undefined;

  const scaledMacros = refEntry
    ? computeMacrosFromReference(refEntry, safeGrams)
    : {
        caloriesKcal: Math.round(item.caloriesKcal * ratio),
        proteinGrams: round1(item.proteinGrams * ratio),
        carbsGrams: round1(item.carbsGrams * ratio),
        fatGrams: round1(item.fatGrams * ratio),
        fiberGrams: round1(item.fiberGrams * ratio),
      };

  return {
    ...item,
    portionGrams: safeGrams,
    portionLabel: `${safeGrams} g adjusted`,
    estimatedCostInr: Math.max(1, Math.round(item.estimatedCostInr * ratio)),
    ...scaledMacros,
  };
}

function formatGoalLabel(goal: DietFitnessGoal): string {
  switch (goal) {
    case 'weight_loss':
      return 'Weight Loss';
    case 'weight_gain':
      return 'Weight Gain';
    case 'muscle_building':
      return 'Muscle Building';
    case 'maintenance':
      return 'Maintenance';
  }
}

export function MealPlannerSection({
  dietProfile,
  savedPlans,
  isEmailVerified,
  onSaveDietProfile,
  onSaveMealPlan,
  onDeleteMealPlan,
  onLogPlannedMeal,
  onShowToast,
}: MealPlannerSectionProps) {
  const [ageInput, setAgeInput] = useState<string>('');
  const [heightInput, setHeightInput] = useState<string>('');
  const [weightInput, setWeightInput] = useState<string>('');
  const [sexInput, setSexInput] = useState<DietBiologicalSex | ''>('');
  const [goalInput, setGoalInput] = useState<DietFitnessGoal | ''>('');
  const [activityInput, setActivityInput] = useState<DietActivityLevel | ''>('');
  const [preferenceInput, setPreferenceInput] = useState<DietaryPreference | ''>('');
  const [budgetInput, setBudgetInput] = useState<string>('');

  const [currentPlan, setCurrentPlan] = useState<IndianMealPlan | null>(null);
  const [planNameInput, setPlanNameInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingSlot, setRegeneratingSlot] = useState<MealPlanSlotId | null>(null);
  const [replacingKey, setReplacingKey] = useState<string | null>(null);
  const [swapPromptKey, setSwapPromptKey] = useState<string | null>(null);
  const [customSwapText, setCustomSwapText] = useState<string>('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [loggedSlots, setLoggedSlots] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDeletePlanId, setConfirmDeletePlanId] = useState<string | null>(null);

  // Sync any saved profile metrics into blank fields without overriding active user edits
  useEffect(() => {
    if (!dietProfile) return;
    setAgeInput((prev) =>
      prev === '' && typeof dietProfile.age === 'number' ? String(dietProfile.age) : prev
    );
    setHeightInput((prev) =>
      prev === '' && typeof dietProfile.heightCm === 'number'
        ? String(dietProfile.heightCm)
        : prev
    );
    setWeightInput((prev) =>
      prev === '' && typeof dietProfile.weightKg === 'number'
        ? String(dietProfile.weightKg)
        : prev
    );
    setSexInput((prev) => (prev === '' && dietProfile.sex ? dietProfile.sex : prev));
    setGoalInput((prev) => (prev === '' && dietProfile.fitnessGoal ? dietProfile.fitnessGoal : prev));
    setActivityInput((prev) =>
      prev === '' && dietProfile.activityLevel ? dietProfile.activityLevel : prev
    );
    setPreferenceInput((prev) =>
      prev === '' && dietProfile.dietaryPreference ? dietProfile.dietaryPreference : prev
    );
    setBudgetInput((prev) =>
      prev === '' && typeof dietProfile.dailyBudgetInr === 'number'
        ? String(dietProfile.dailyBudgetInr)
        : prev
    );
  }, [dietProfile]);

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    const ageNum = Number(ageInput);
    const heightNum = Number(heightInput);
    const weightNum = Number(weightInput);
    const budgetNum = Number(budgetInput);

    if (!ageInput.trim() || !Number.isFinite(ageNum) || ageNum < 13 || ageNum > 100) {
      missing.push('Age (13–100 yrs)');
    }
    if (!heightInput.trim() || !Number.isFinite(heightNum) || heightNum < 100 || heightNum > 250) {
      missing.push('Height (100–250 cm)');
    }
    if (!weightInput.trim() || !Number.isFinite(weightNum) || weightNum < 25 || weightNum > 300) {
      missing.push('Current Weight (25–300 kg)');
    }
    if (!sexInput) missing.push('Sex');
    if (!goalInput) missing.push('Fitness Goal');
    if (!activityInput) missing.push('Activity Level');
    if (!preferenceInput) missing.push('Food Preference');
    if (!budgetInput.trim() || !Number.isFinite(budgetNum) || budgetNum < 50 || budgetNum > 5000) {
      missing.push('Daily Food Budget (₹50–₹5000)');
    }
    return missing;
  }, [
    ageInput,
    heightInput,
    weightInput,
    sexInput,
    goalInput,
    activityInput,
    preferenceInput,
    budgetInput,
  ]);

  function buildValidatedInput(): MealPlannerInput | null {
    if (missingFields.length > 0) {
      setErrorMessage(
        `Please complete these details before generating your meal plan: ${missingFields.join(', ')}.`
      );
      return null;
    }

    return {
      age: Math.round(Number(ageInput)),
      heightCm: Math.round(Number(heightInput) * 10) / 10,
      weightKg: Math.round(Number(weightInput) * 10) / 10,
      sex: sexInput as DietBiologicalSex,
      fitnessGoal: goalInput as DietFitnessGoal,
      activityLevel: activityInput as DietActivityLevel,
      dietaryPreference: preferenceInput as DietaryPreference,
      dailyBudgetInr: Math.round(Number(budgetInput)),
    };
  }

  async function postMealPlannerApi<T>(body: Record<string, unknown>, timeoutMs = 34_000): Promise<T> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch('/api/meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      const text = await response.text();
      let json: (T & { error?: string }) | null = null;
      if (text) {
        try {
          json = JSON.parse(text) as T & { error?: string };
        } catch {
          json = null;
        }
      }
      if (!response.ok) {
        throw new Error(json?.error || `Meal planner failed (HTTP ${response.status}).`);
      }
      if (!json) {
        throw new Error('Unexpected response from AI meal planner.');
      }
      return json;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Meal planner request timed out. Please retry.');
      }
      throw err;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function handleGeneratePlan(e: React.FormEvent) {
    e.preventDefault();
    if (isGenerating) return;
    const validInput = buildValidatedInput();
    if (!validInput) return;

    setIsGenerating(true);
    setErrorMessage(null);
    setLoggedSlots({});
    setSwapPromptKey(null);

    try {
      const data = await postMealPlannerApi<{ plan: IndianMealPlan }>({
        action: 'generate_plan',
        input: validInput,
      });
      setCurrentPlan(data.plan);
      setPlanNameInput(data.plan.planName);
      onShowToast('Personalized Indian meal plan ready');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to generate meal plan right now.'
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveDetailsToProfile() {
    const validInput = buildValidatedInput();
    if (!validInput) return;
    setIsSavingProfile(true);
    setErrorMessage(null);
    try {
      await onSaveDietProfile({
        age: validInput.age,
        heightCm: validInput.heightCm,
        weightKg: validInput.weightKg,
        sex: validInput.sex,
        fitnessGoal: validInput.fitnessGoal,
        activityLevel: validInput.activityLevel,
        dietaryPreference: validInput.dietaryPreference,
        dailyBudgetInr: validInput.dailyBudgetInr,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not save body details to profile.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleRegenerateSlot(meal: PlannedMeal) {
    if (!currentPlan || regeneratingSlot) return;
    setRegeneratingSlot(meal.slotId);
    setErrorMessage(null);

    try {
      const data = await postMealPlannerApi<{ meal: PlannedMeal }>({
        action: 'regenerate_meal',
        input: currentPlan.input,
        slotId: meal.slotId,
        targetSlotCalories: meal.totals.caloriesKcal,
        currentMealTitle: meal.title,
      });

      setCurrentPlan((prev) => {
        if (!prev) return prev;
        const nextMeals = prev.meals.map((m) => (m.slotId === meal.slotId ? data.meal : m));
        return recalculateMealAndPlanTotals({
          ...prev,
          meals: nextMeals,
          updatedAtIso: new Date().toISOString(),
        });
      });
      setLoggedSlots((prev) => ({ ...prev, [meal.slotId]: false }));
      onShowToast(`Regenerated ${meal.slotLabel}: ${data.meal.title}`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : `Could not regenerate ${meal.slotLabel}.`
      );
    } finally {
      setRegeneratingSlot(null);
    }
  }

  async function handleReplaceFoodItem(
    meal: PlannedMeal,
    itemIndex: number,
    item: PlannedFoodItem,
    preferredReplacement?: string
  ) {
    if (!currentPlan || replacingKey) return;
    const key = `${meal.slotId}:${item.id}`;
    setReplacingKey(key);
    setErrorMessage(null);

    try {
      const data = await postMealPlannerApi<{ item: PlannedFoodItem }>({
        action: 'replace_item',
        input: currentPlan.input,
        slotId: meal.slotId,
        currentItemName: item.name,
        targetCalories: item.caloriesKcal,
        preferredReplacement,
      });

      setCurrentPlan((prev) => {
        if (!prev) return prev;
        const nextMeals = prev.meals.map((m) => {
          if (m.slotId !== meal.slotId) return m;
          const nextItems = m.items.map((it, idx) => (idx === itemIndex ? data.item : it));
          return { ...m, items: nextItems };
        });
        return recalculateMealAndPlanTotals({
          ...prev,
          meals: nextMeals,
          updatedAtIso: new Date().toISOString(),
        });
      });

      setSwapPromptKey(null);
      setCustomSwapText('');
      setLoggedSlots((prev) => ({ ...prev, [meal.slotId]: false }));
      onShowToast(`Swapped "${item.name}" with "${data.item.name}"`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : `Could not replace ${item.name}.`
      );
    } finally {
      setReplacingKey(null);
    }
  }

  function handleAdjustItemGrams(slotId: MealPlanSlotId, itemIndex: number, nextGrams: number) {
    setCurrentPlan((prev) => {
      if (!prev) return prev;
      const nextMeals = prev.meals.map((meal) => {
        if (meal.slotId !== slotId) return meal;
        const nextItems = meal.items.map((it, idx) =>
          idx === itemIndex ? scalePlannedItemGrams(it, nextGrams) : it
        );
        return { ...meal, items: nextItems };
      });
      return recalculateMealAndPlanTotals({
        ...prev,
        meals: nextMeals,
        updatedAtIso: new Date().toISOString(),
      });
    });
    setLoggedSlots((prev) => ({ ...prev, [slotId]: false }));
  }

  async function handleSavePlanToCloud() {
    if (!currentPlan || isSavingPlan) return;
    if (!isEmailVerified) {
      onShowToast('Verify your email address first to save meal plans privately in Firestore.');
      return;
    }

    setIsSavingPlan(true);
    setErrorMessage(null);
    try {
      const savedId = await onSaveMealPlan({
        ...currentPlan,
        planName: (planNameInput || currentPlan.planName || 'My Indian Meal Plan').trim(),
      });
      setCurrentPlan((prev) => (prev ? { ...prev, id: savedId } : prev));
      onShowToast('Saved Indian meal plan to your account');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to save meal plan right now.');
    } finally {
      setIsSavingPlan(false);
    }
  }

  function handleLoadSavedPlan(plan: IndianMealPlan) {
    setCurrentPlan(recalculateMealAndPlanTotals(plan));
    setPlanNameInput(plan.planName);
    setAgeInput(String(plan.input.age));
    setHeightInput(String(plan.input.heightCm));
    setWeightInput(String(plan.input.weightKg));
    setSexInput(plan.input.sex);
    setGoalInput(plan.input.fitnessGoal);
    setActivityInput(plan.input.activityLevel);
    setPreferenceInput(plan.input.dietaryPreference);
    setBudgetInput(String(plan.input.dailyBudgetInr));
    setLoggedSlots({});
    setSwapPromptKey(null);
    setErrorMessage(null);
    onShowToast(`Loaded "${plan.planName}"`);
  }

  async function handleLogMealToDiary(meal: PlannedMeal) {
    if (meal.items.length === 0) return;
    const category = mapPlanSlotToDiaryCategory(meal.slotId);
    const analysis = plannedMealToFoodAnalysis(meal);
    await onLogPlannedMeal(category, analysis);
    setLoggedSlots((prev) => ({ ...prev, [meal.slotId]: true }));
  }

  return (
    <section
      id="meal-planner"
      className="border-t border-[#EEDCE0] bg-[#FFF8F9] py-14 sm:py-18"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#BE123C]">
              <ChefHat className="h-4 w-4" aria-hidden="true" />
              AI Meal Planner
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[#241118] sm:text-3xl">
              Personalized Affordable Indian Meal Planner
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#644A52]">
              Build a balanced 5-meal Indian plan around everyday foods (roti, dal, rice, paneer,
              eggs, milk, poha, oats, sabzi &amp; seasonal fruits) tailored to your body, goal, food
              preference, and daily INR budget.
            </p>
          </div>
          {savedPlans.length > 0 && (
            <div className="text-xs font-medium text-[#644A52]">
              Saved plans: <span className="font-mono font-bold text-[#241118]">{savedPlans.length}</span>
            </div>
          )}
        </div>

        {/* Saved Plans Selector Strip */}
        {savedPlans.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[#EEDCE0] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#644A52]">
                Your Saved Indian Meal Plans
              </p>
              <span className="text-[11px] text-[#7E6069]">Tap any plan to view or adjust</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {savedPlans.map((plan) => {
                const isActive = currentPlan?.id === plan.id;
                const isConfirming = confirmDeletePlanId === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition-colors ${
                      isActive
                        ? 'border-[#BE123C] bg-[#FDF2F4]'
                        : 'border-[#EEDCE0] bg-[#FFF8F9] hover:border-[#D9B6BF]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadSavedPlan(plan)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <p className="truncate text-sm font-semibold text-[#241118]">{plan.planName}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-[#644A52] tabular-nums">
                        {plan.totals.caloriesKcal} kcal · {plan.totals.proteinGrams}g P · ₹
                        {plan.estimatedTotalCostInr}/day
                      </p>
                    </button>

                    {isConfirming ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            void onDeleteMealPlan(plan.id);
                            if (currentPlan?.id === plan.id) setCurrentPlan(null);
                            setConfirmDeletePlanId(null);
                          }}
                          className="min-h-[36px] rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePlanId(null)}
                          className="min-h-[36px] rounded-lg border border-[#E5CFD4] bg-white px-2 text-xs text-[#644A52] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePlanId(plan.id)}
                        aria-label={`Delete saved plan ${plan.planName}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#7E6069] hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* User Intake Form */}
        <form
          onSubmit={handleGeneratePlan}
          className="mt-6 rounded-2xl border border-[#EEDCE0] bg-white p-5 shadow-xs sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F6E9EC] pb-4">
            <div>
              <h3 className="font-display text-base font-bold text-[#241118]">
                Your Body Metrics, Goal &amp; Daily Food Budget
              </h3>
              <p className="mt-0.5 text-xs text-[#644A52]">
                {missingFields.length > 0
                  ? 'Fill in any blank fields below so your plan matches your real requirements.'
                  : 'All details ready — generate your AI meal plan or update anytime.'}
              </p>
            </div>
            <button
              type="button"
              disabled={isSavingProfile || missingFields.length > 0}
              onClick={() => void handleSaveDetailsToProfile()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-3.5 py-2 text-xs font-semibold text-[#241118] hover:bg-[#FDF2F4] disabled:opacity-50 cursor-pointer"
            >
              {isSavingProfile ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#BE123C]" aria-hidden="true" />
              ) : (
                <BookmarkCheck className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
              )}
              Save Details to Profile
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Age (yrs) *</span>
              <input
                type="number"
                min={13}
                max={100}
                placeholder="e.g. 25"
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 font-mono text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Height (cm) *</span>
              <input
                type="number"
                min={100}
                max={250}
                step="0.5"
                placeholder="e.g. 172"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 font-mono text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Current Weight (kg) *</span>
              <input
                type="number"
                min={25}
                max={300}
                step="0.5"
                placeholder="e.g. 68"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 font-mono text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Sex *</span>
              <select
                value={sexInput}
                onChange={(e) => setSexInput(e.target.value as DietBiologicalSex | '')}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Fitness Goal *</span>
              <select
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value as DietFitnessGoal | '')}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
              >
                <option value="">Select fitness goal...</option>
                <option value="weight_loss">Weight Loss</option>
                <option value="weight_gain">Weight Gain</option>
                <option value="muscle_building">Muscle Building</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Activity Level *</span>
              <select
                value={activityInput}
                onChange={(e) => setActivityInput(e.target.value as DietActivityLevel | '')}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
              >
                <option value="">Select activity level...</option>
                <option value="sedentary">Sedentary (Desk / Minimal exercise)</option>
                <option value="light">Lightly Active (1–3 days/wk)</option>
                <option value="moderate">Moderately Active (3–5 days/wk)</option>
                <option value="active">Very Active (6–7 days/wk)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Food Preference *</span>
              <select
                value={preferenceInput}
                onChange={(e) => setPreferenceInput(e.target.value as DietaryPreference | '')}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
              >
                <option value="">Select preference...</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="non-vegetarian">Non-Vegetarian</option>
                <option value="eggetarian">Eggetarian</option>
                <option value="vegan">Vegan</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <label className="block">
                <span className="text-xs font-medium text-[#644A52]">
                  Daily Food Budget (₹ INR / day) *
                </span>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <div className="relative w-36">
                    <IndianRupee
                      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#644A52]"
                      aria-hidden="true"
                    />
                    <input
                      type="number"
                      min={50}
                      max={5000}
                      placeholder="e.g. 200"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-[#E5CFD4] bg-white pr-3 pl-8 font-mono text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BUDGET_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setBudgetInput(String(amount))}
                        className={`min-h-[44px] rounded-xl border px-3 text-xs font-mono font-semibold transition-colors cursor-pointer ${
                          Number(budgetInput) === amount
                            ? 'border-[#BE123C] bg-[#FDF2F4] text-[#BE123C]'
                            : 'border-[#EEDCE0] bg-[#FFF8F9] text-[#644A52] hover:text-[#241118]'
                        }`}
                      >
                        ₹{amount}
                      </button>
                    ))}
                  </div>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#BE123C] px-6 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#9F1239] disabled:opacity-60 sm:w-auto cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Generating Indian Meal Plan...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {currentPlan ? 'Regenerate Full Plan' : 'Generate AI Meal Plan'}
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>

        {/* Active Generated / Loaded Meal Plan */}
        {currentPlan && (
          <div className="mt-8 space-y-6">
            {/* Total Daily Nutrition Summary & Save Bar */}
            <div className="rounded-2xl border border-[#EEDCE0] bg-white p-5 shadow-xs sm:p-6">
              <div className="flex flex-col justify-between gap-4 border-b border-[#F6E9EC] pb-5 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#644A52]">
                    <span className="font-semibold text-[#BE123C]">
                      {formatGoalLabel(currentPlan.input.fitnessGoal)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{currentPlan.input.dietaryPreference}</span>
                    <span aria-hidden="true">·</span>
                    <span>Budget ₹{currentPlan.input.dailyBudgetInr}/day</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      maxLength={120}
                      value={planNameInput}
                      onChange={(e) => setPlanNameInput(e.target.value)}
                      aria-label="Meal plan name"
                      className="min-h-[42px] flex-1 rounded-xl border border-[#E5CFD4] bg-[#FFF8F9] px-3 py-1.5 font-display text-base font-bold text-[#241118] focus:border-[#BE123C] focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isSavingPlan}
                      onClick={() => void handleSavePlanToCloud()}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#241118] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A1E28] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                      {isSavingPlan ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                      )}
                      {isSavingPlan ? 'Saving...' : 'Save Meal Plan'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Total Daily Nutrition Metrics */}
              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#644A52]">
                    Total Daily Nutrition (Estimated)
                  </h3>
                  <span className="font-mono text-xs text-[#644A52] tabular-nums">
                    Target: ~{currentPlan.targetDailyCaloriesKcal} kcal · TDEE ~
                    {currentPlan.estimatedTdeeKcal} kcal
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-xl border border-[#BE123C]/20 bg-[#FDF2F4] p-3.5">
                    <p className="text-[11px] font-medium text-[#BE123C]">Daily Calories</p>
                    <p className="mt-1 font-mono text-xl font-bold text-[#241118] tabular-nums">
                      {currentPlan.totals.caloriesKcal}{' '}
                      <span className="text-xs font-normal text-[#644A52]">kcal</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3.5">
                    <p className="text-[11px] font-medium text-[#644A52]">Protein</p>
                    <p className="mt-1 font-mono text-xl font-bold text-[#241118] tabular-nums">
                      {currentPlan.totals.proteinGrams}g
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3.5">
                    <p className="text-[11px] font-medium text-[#644A52]">Carbohydrates</p>
                    <p className="mt-1 font-mono text-xl font-bold text-[#241118] tabular-nums">
                      {currentPlan.totals.carbsGrams}g
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3.5">
                    <p className="text-[11px] font-medium text-[#644A52]">Fats</p>
                    <p className="mt-1 font-mono text-xl font-bold text-[#241118] tabular-nums">
                      {currentPlan.totals.fatGrams}g
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3.5">
                    <p className="text-[11px] font-medium text-[#644A52]">Fiber</p>
                    <p className="mt-1 font-mono text-xl font-bold text-[#241118] tabular-nums">
                      {currentPlan.totals.fiberGrams}g
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3.5">
                    <p className="text-[11px] font-medium text-[#644A52]">Est. Daily Cost</p>
                    <p className="mt-1 font-mono text-xl font-bold text-[#241118] tabular-nums">
                      ₹{currentPlan.estimatedTotalCostInr}
                    </p>
                  </div>
                </div>
              </div>

              {/* Guidance & Estimate Notices */}
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3.5 text-xs text-[#241118]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#BE123C]" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Safe Calorie &amp; Budget Fit</p>
                    <p className="mt-0.5 leading-relaxed text-[#644A52]">
                      {currentPlan.safetyNote} {currentPlan.budgetSummary}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3.5 text-xs text-[#241118]">
                  <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-[#BE123C]" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Hydration &amp; Timing Tip</p>
                    <p className="mt-0.5 leading-relaxed text-[#644A52]">
                      {currentPlan.hydrationTip}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <span>
                  <strong>Estimated Nutrition Values:</strong> {currentPlan.estimationDisclaimer}
                </span>
              </div>
            </div>

            {/* 5 Meal Cards */}
            <div className="space-y-4">
              {currentPlan.meals.map((meal) => {
                const isSlotRegenerating = regeneratingSlot === meal.slotId;
                const isLogged = Boolean(loggedSlots[meal.slotId]);
                return (
                  <article
                    key={meal.slotId}
                    className="rounded-2xl border border-[#EEDCE0] bg-white p-5 shadow-xs"
                  >
                    <div className="flex flex-col justify-between gap-3 border-b border-[#F6E9EC] pb-4 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold uppercase tracking-wider text-[#BE123C]">
                            {meal.slotLabel}
                          </span>
                          <span className="text-[#7E6069]">· {meal.timingWindow}</span>
                          <span className="font-mono text-[#644A52]">
                            · Est. ₹{meal.estimatedCostInr}
                          </span>
                        </div>
                        <h3 className="mt-1 font-display text-lg font-bold text-[#241118]">
                          {meal.title}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={Boolean(regeneratingSlot)}
                          onClick={() => void handleRegenerateSlot(meal)}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E5CFD4] bg-[#FFF8F9] px-3.5 py-2 text-xs font-semibold text-[#241118] hover:bg-[#FDF2F4] disabled:opacity-50 cursor-pointer"
                        >
                          {isSlotRegenerating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#BE123C]" aria-hidden="true" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
                          )}
                          {isSlotRegenerating ? 'Regenerating...' : 'Regenerate Meal'}
                        </button>

                        <button
                          type="button"
                          disabled={meal.items.length === 0}
                          onClick={() => void handleLogMealToDiary(meal)}
                          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                            isLogged
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                              : 'bg-[#BE123C] text-white hover:bg-[#9F1239]'
                          }`}
                        >
                          {isLogged ? (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {isLogged ? 'Added to Diary' : 'Log to Daily Diary'}
                        </button>
                      </div>
                    </div>

                    {/* Meal Totals Bar */}
                    <div className="mt-3 grid grid-cols-5 gap-2 rounded-xl bg-[#FFF8F9] px-3 py-2.5 text-center font-mono tabular-nums">
                      <div>
                        <p className="text-sm font-bold text-[#BE123C]">{meal.totals.caloriesKcal}</p>
                        <p className="text-[10px] text-[#644A52]">kcal (est.)</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#241118]">{meal.totals.proteinGrams}g</p>
                        <p className="text-[10px] text-[#644A52]">Protein</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#241118]">{meal.totals.carbsGrams}g</p>
                        <p className="text-[10px] text-[#644A52]">Carbs</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#241118]">{meal.totals.fatGrams}g</p>
                        <p className="text-[10px] text-[#644A52]">Fat</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#241118]">{meal.totals.fiberGrams}g</p>
                        <p className="text-[10px] text-[#644A52]">Fiber</p>
                      </div>
                    </div>

                    {/* Food Items inside Meal */}
                    <div className="mt-3.5 divide-y divide-[#F6E9EC]">
                      {meal.items.map((item, idx) => {
                        const key = `${meal.slotId}:${item.id}`;
                        const isReplacing = replacingKey === key;
                        const isSwapOpen = swapPromptKey === key;

                        return (
                          <div key={item.id || idx} className="py-3 first:pt-1 last:pb-1">
                            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <p className="text-sm font-semibold text-[#241118]">
                                    {item.name}
                                  </p>
                                  {item.hindiName && (
                                    <span className="text-xs text-[#644A52]">
                                      ({item.hindiName})
                                    </span>
                                  )}
                                  <span className="font-mono text-[11px] text-[#7E6069]">
                                    · {item.portionLabel} · Est. ₹{item.estimatedCostInr}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs text-[#644A52]">
                                  {item.preparationNote}
                                  {item.nutritionSource === 'reference_db' && (
                                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                                      <Database className="h-3 w-3" aria-hidden="true" />
                                      IFCT / USDA Ref
                                    </span>
                                  )}
                                </p>
                                <p className="mt-1 font-mono text-xs text-[#241118] tabular-nums">
                                  {item.caloriesKcal} kcal · P {item.proteinGrams}g · C{' '}
                                  {item.carbsGrams}g · F {item.fatGrams}g · Fiber{' '}
                                  {item.fiberGrams}g
                                </p>
                              </div>

                              {/* Portion Adjuster & Replace Item */}
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex items-center rounded-xl border border-[#E5CFD4] bg-[#FFF8F9]">
                                  <button
                                    type="button"
                                    aria-label={`Decrease portion of ${item.name} by 10g`}
                                    onClick={() =>
                                      handleAdjustItemGrams(
                                        meal.slotId,
                                        idx,
                                        item.portionGrams - 10
                                      )
                                    }
                                    className="flex h-10 w-10 items-center justify-center text-[#644A52] hover:text-[#241118] cursor-pointer"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <div className="flex items-center px-1">
                                    <input
                                      type="number"
                                      min={10}
                                      max={1500}
                                      aria-label={`${item.name} grams`}
                                      value={item.portionGrams}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        if (Number.isFinite(val) && val >= 10) {
                                          handleAdjustItemGrams(meal.slotId, idx, val);
                                        }
                                      }}
                                      className="w-14 bg-transparent text-center font-mono text-xs font-bold text-[#241118] focus:outline-none"
                                    />
                                    <span className="pr-1 font-mono text-[11px] text-[#644A52]">
                                      g
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    aria-label={`Increase portion of ${item.name} by 10g`}
                                    onClick={() =>
                                      handleAdjustItemGrams(
                                        meal.slotId,
                                        idx,
                                        item.portionGrams + 10
                                      )
                                    }
                                    className="flex h-10 w-10 items-center justify-center text-[#644A52] hover:text-[#241118] cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  disabled={Boolean(replacingKey)}
                                  onClick={() => {
                                    setSwapPromptKey(isSwapOpen ? null : key);
                                    setCustomSwapText('');
                                  }}
                                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5CFD4] bg-white px-3 py-1.5 text-xs font-semibold text-[#241118] hover:bg-[#FDF2F4] disabled:opacity-50 cursor-pointer"
                                >
                                  {isReplacing ? (
                                    <Loader2
                                      className="h-3.5 w-3.5 animate-spin text-[#BE123C]"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Repeat className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
                                  )}
                                  Replace
                                </button>
                              </div>
                            </div>

                            {isSwapOpen && (
                              <div className="mt-2.5 flex flex-col gap-2 rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3 sm:flex-row sm:items-center">
                                <button
                                  type="button"
                                  disabled={isReplacing}
                                  onClick={() => void handleReplaceFoodItem(meal, idx, item)}
                                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-[#BE123C] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#9F1239] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                                >
                                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                  AI Suggest Swap
                                </button>
                                <div className="flex flex-1 gap-2">
                                  <input
                                    type="text"
                                    maxLength={100}
                                    placeholder="Or type swap (e.g. 2 boiled eggs, besan chilla, paneer bhurji)"
                                    value={customSwapText}
                                    onChange={(e) => setCustomSwapText(e.target.value)}
                                    className="min-h-[40px] flex-1 rounded-lg border border-[#E5CFD4] bg-white px-3 py-1.5 text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={isReplacing || !customSwapText.trim()}
                                    onClick={() =>
                                      void handleReplaceFoodItem(
                                        meal,
                                        idx,
                                        item,
                                        customSwapText.trim()
                                      )
                                    }
                                    className="min-h-[40px] rounded-lg bg-[#241118] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#3A1E28] disabled:opacity-40 cursor-pointer"
                                  >
                                    Swap
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {meal.tip && (
                      <p className="mt-3 border-t border-[#F6E9EC] pt-2.5 text-xs text-[#644A52]">
                        <span className="font-semibold text-[#241118]">Meal tip:</span> {meal.tip}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
