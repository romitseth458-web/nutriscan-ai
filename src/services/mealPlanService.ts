import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  FoodAnalysisResult,
  IndianMealPlan,
  MacroTotals,
  MealCategory,
  MealPlannerInput,
  MealPlanSlotId,
  MealPlanSlotLabel,
  PlannedFoodItem,
  PlannedMeal,
} from '../types/nutrition';

const SLOT_ORDER: { slotId: MealPlanSlotId; slotLabel: MealPlanSlotLabel; timingWindow: string }[] = [
  { slotId: 'breakfast', slotLabel: 'Breakfast', timingWindow: '7:30 AM – 9:00 AM' },
  { slotId: 'mid_morning', slotLabel: 'Mid-Morning Snack', timingWindow: '10:30 AM – 11:30 AM' },
  { slotId: 'lunch', slotLabel: 'Lunch', timingWindow: '1:00 PM – 2:30 PM' },
  { slotId: 'evening_snack', slotLabel: 'Evening Snack', timingWindow: '4:30 PM – 5:30 PM' },
  { slotId: 'dinner', slotLabel: 'Dinner', timingWindow: '7:30 PM – 9:00 PM' },
];

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, num));
}

function round1(value: number): number {
  return Math.round(Math.max(0, value) * 10) / 10;
}

function sanitizeTotals(raw: Partial<MacroTotals> | undefined): MacroTotals {
  return {
    caloriesKcal: Math.round(clampNum(raw?.caloriesKcal, 0, 25000, 0)),
    proteinGrams: round1(clampNum(raw?.proteinGrams, 0, 2000, 0)),
    carbsGrams: round1(clampNum(raw?.carbsGrams, 0, 5000, 0)),
    fatGrams: round1(clampNum(raw?.fatGrams, 0, 2000, 0)),
    fiberGrams: round1(clampNum(raw?.fiberGrams, 0, 1000, 0)),
  };
}

function sanitizeInputForFirestore(input: MealPlannerInput): MealPlannerInput {
  return {
    age: Math.round(clampNum(input.age, 13, 100, 26)),
    heightCm: round1(clampNum(input.heightCm, 100, 250, 170)),
    weightKg: round1(clampNum(input.weightKg, 25, 300, 68)),
    sex: input.sex === 'female' ? 'female' : 'male',
    fitnessGoal:
      input.fitnessGoal === 'weight_loss' ||
      input.fitnessGoal === 'weight_gain' ||
      input.fitnessGoal === 'muscle_building' ||
      input.fitnessGoal === 'maintenance'
        ? input.fitnessGoal
        : 'maintenance',
    activityLevel:
      input.activityLevel === 'sedentary' ||
      input.activityLevel === 'light' ||
      input.activityLevel === 'moderate' ||
      input.activityLevel === 'active'
        ? input.activityLevel
        : 'moderate',
    dietaryPreference:
      input.dietaryPreference === 'vegetarian' ||
      input.dietaryPreference === 'non-vegetarian' ||
      input.dietaryPreference === 'eggetarian' ||
      input.dietaryPreference === 'vegan'
        ? input.dietaryPreference
        : 'vegetarian',
    dailyBudgetInr: Math.round(clampNum(input.dailyBudgetInr, 50, 5000, 200)),
  };
}

function sanitizeItemForFirestore(item: PlannedFoodItem, idx: number): PlannedFoodItem {
  return {
    id: String(item.id || `item-${idx + 1}`).slice(0, 80),
    name: String(item.name || 'Indian food item').trim().slice(0, 120),
    ...(typeof item.hindiName === 'string' && item.hindiName.trim()
      ? { hindiName: item.hindiName.trim().slice(0, 120) }
      : {}),
    portionGrams: Math.round(clampNum(item.portionGrams, 5, 2500, 100)),
    portionLabel: String(item.portionLabel || `${Math.round(item.portionGrams || 100)} g`).slice(0, 80),
    estimatedCostInr: Math.round(clampNum(item.estimatedCostInr, 0, 5000, 0)),
    preparationNote: String(item.preparationNote || 'Homestyle preparation').slice(0, 200),
    nutritionSource:
      item.nutritionSource === 'reference_db' ? 'reference_db' : 'gemini_estimate',
    ...(typeof item.referenceFoodId === 'string' && item.referenceFoodId.trim()
      ? { referenceFoodId: item.referenceFoodId.trim().slice(0, 60) }
      : {}),
    caloriesKcal: Math.round(clampNum(item.caloriesKcal, 0, 10000, 0)),
    proteinGrams: round1(clampNum(item.proteinGrams, 0, 1000, 0)),
    carbsGrams: round1(clampNum(item.carbsGrams, 0, 2000, 0)),
    fatGrams: round1(clampNum(item.fatGrams, 0, 1000, 0)),
    fiberGrams: round1(clampNum(item.fiberGrams, 0, 500, 0)),
  };
}

export function recalculateMealAndPlanTotals(plan: IndianMealPlan): IndianMealPlan {
  const updatedMeals = plan.meals.map((meal) => {
    const totals = meal.items.reduce<MacroTotals>(
      (acc, item) => ({
        caloriesKcal: acc.caloriesKcal + item.caloriesKcal,
        proteinGrams: round1(acc.proteinGrams + item.proteinGrams),
        carbsGrams: round1(acc.carbsGrams + item.carbsGrams),
        fatGrams: round1(acc.fatGrams + item.fatGrams),
        fiberGrams: round1(acc.fiberGrams + item.fiberGrams),
      }),
      { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }
    );
    const estimatedCostInr = Math.round(
      meal.items.reduce((sum, item) => sum + (item.estimatedCostInr || 0), 0)
    );
    return {
      ...meal,
      totals: sanitizeTotals(totals),
      estimatedCostInr,
    };
  });

  const dailyTotals = updatedMeals.reduce<MacroTotals>(
    (acc, meal) => ({
      caloriesKcal: acc.caloriesKcal + meal.totals.caloriesKcal,
      proteinGrams: round1(acc.proteinGrams + meal.totals.proteinGrams),
      carbsGrams: round1(acc.carbsGrams + meal.totals.carbsGrams),
      fatGrams: round1(acc.fatGrams + meal.totals.fatGrams),
      fiberGrams: round1(acc.fiberGrams + meal.totals.fiberGrams),
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }
  );

  const estimatedTotalCostInr = Math.round(
    updatedMeals.reduce((sum, meal) => sum + (meal.estimatedCostInr || 0), 0)
  );

  return {
    ...plan,
    meals: updatedMeals,
    totals: sanitizeTotals(dailyTotals),
    estimatedTotalCostInr,
  };
}

function normalizeMealsToFiveSlots(meals: PlannedMeal[]): PlannedMeal[] {
  return SLOT_ORDER.map((meta) => {
    const found = meals.find((m) => m.slotId === meta.slotId);
    const items = Array.isArray(found?.items)
      ? found.items.slice(0, 10).map((it, idx) => sanitizeItemForFirestore(it, idx))
      : [];
    const baseMeal: PlannedMeal = {
      slotId: meta.slotId,
      slotLabel: meta.slotLabel,
      timingWindow: String(found?.timingWindow || meta.timingWindow).slice(0, 60),
      title: String(found?.title || meta.slotLabel).slice(0, 140),
      totals: sanitizeTotals(found?.totals),
      estimatedCostInr: Math.round(clampNum(found?.estimatedCostInr, 0, 5000, 0)),
      items,
      tip: String(found?.tip || '').slice(0, 260),
    };
    return baseMeal;
  });
}

export async function saveMealPlanForUser(
  userId: string,
  plan: IndianMealPlan
): Promise<string> {
  const safeId =
    plan.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || `plan-${Date.now()}`;
  const path = `users/${userId}/mealPlans/${safeId}`;
  const ref = doc(db, 'users', userId, 'mealPlans', safeId);

  const normalized = recalculateMealAndPlanTotals({
    ...plan,
    id: safeId,
    meals: normalizeMealsToFiveSlots(plan.meals),
  });

  const payload = {
    id: safeId,
    userId,
    planName: (normalized.planName || 'My Indian Meal Plan').trim().slice(0, 120),
    input: sanitizeInputForFirestore(normalized.input),
    targetDailyCaloriesKcal: Math.round(
      clampNum(normalized.targetDailyCaloriesKcal, 1200, 6000, 2000)
    ),
    estimatedBmrKcal: Math.round(clampNum(normalized.estimatedBmrKcal, 800, 4500, 1500)),
    estimatedTdeeKcal: Math.round(clampNum(normalized.estimatedTdeeKcal, 1000, 7000, 2000)),
    safetyNote: String(normalized.safetyNote || '').slice(0, 500),
    hydrationTip: String(normalized.hydrationTip || '').slice(0, 500),
    budgetSummary: String(normalized.budgetSummary || '').slice(0, 500),
    totals: sanitizeTotals(normalized.totals),
    estimatedTotalCostInr: Math.round(clampNum(normalized.estimatedTotalCostInr, 0, 10000, 0)),
    meals: normalized.meals,
    estimationDisclaimer: (
      normalized.estimationDisclaimer ||
      'Nutrition values and daily food costs are estimates based on standard Indian home portions.'
    ).slice(0, 500),
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, payload);
    }
    return safeId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToUserMealPlans(
  userId: string,
  onPlans: (plans: IndianMealPlan[]) => void
): Unsubscribe {
  const path = `users/${userId}/mealPlans`;
  const q = query(
    collection(db, 'users', userId, 'mealPlans'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const plans: IndianMealPlan[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d || !Array.isArray(d.meals) || !d.totals || !d.input) return;
        const updatedIso =
          typeof d.updatedAt?.toDate === 'function'
            ? d.updatedAt.toDate().toISOString()
            : new Date().toISOString();
        plans.push({
          id: String(d.id || docSnap.id),
          planName: String(d.planName || 'Saved Indian Meal Plan'),
          input: sanitizeInputForFirestore(d.input as MealPlannerInput),
          targetDailyCaloriesKcal: Number(d.targetDailyCaloriesKcal) || 2000,
          estimatedBmrKcal: Number(d.estimatedBmrKcal) || 1500,
          estimatedTdeeKcal: Number(d.estimatedTdeeKcal) || 2000,
          safetyNote: String(d.safetyNote || ''),
          hydrationTip: String(d.hydrationTip || ''),
          budgetSummary: String(d.budgetSummary || ''),
          totals: sanitizeTotals(d.totals as MacroTotals),
          estimatedTotalCostInr: Number(d.estimatedTotalCostInr) || 0,
          meals: normalizeMealsToFiveSlots(d.meals as PlannedMeal[]),
          estimationDisclaimer: String(d.estimationDisclaimer || ''),
          updatedAtIso: updatedIso,
        });
      });

      plans.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
      onPlans(plans);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function deleteMealPlanForUser(userId: string, planId: string): Promise<void> {
  const path = `users/${userId}/mealPlans/${planId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'mealPlans', planId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function mapPlanSlotToDiaryCategory(slotId: MealPlanSlotId): MealCategory {
  if (slotId === 'breakfast') return 'Breakfast';
  if (slotId === 'lunch') return 'Lunch';
  if (slotId === 'dinner') return 'Dinner';
  return 'Snack';
}

export function plannedMealToFoodAnalysis(meal: PlannedMeal): FoodAnalysisResult {
  const totalGrams = Math.round(
    meal.items.reduce((sum, item) => sum + (item.portionGrams || 0), 0)
  );

  return {
    identificationStatus: 'identified',
    confidence: 'high',
    clarificationQuestion: '',
    mealTitle: `${meal.slotLabel}: ${meal.title}`.slice(0, 200),
    estimatedServingSizeGrams: Math.max(0, totalGrams),
    servingDescription: `${meal.items.length} planned Indian items (${meal.timingWindow})`.slice(
      0,
      300
    ),
    totals: sanitizeTotals(meal.totals),
    items: meal.items.map((item) => ({
      name: item.name,
      ...(item.hindiName ? { hindiName: item.hindiName } : {}),
      nutritionSource: item.nutritionSource,
      ...(item.referenceFoodId ? { referenceFoodId: item.referenceFoodId } : {}),
      portionGrams: item.portionGrams,
      caloriesKcal: item.caloriesKcal,
      proteinGrams: item.proteinGrams,
      carbsGrams: item.carbsGrams,
      fatGrams: item.fatGrams,
      fiberGrams: item.fiberGrams,
      preparationNote: `${item.portionLabel} · ${item.preparationNote}`.slice(0, 200),
    })),
    dietSuggestions: {
      summary: meal.tip || `Logged from your AI Meal Planner (${meal.slotLabel}).`,
      healthierAlternatives: [],
      highProteinOptions: [],
      vegetarianOptions: [],
      nonVegetarianOptions: [],
    },
    estimationDisclaimer:
      'Logged from AI Meal Planner estimates (grounded in IFCT/USDA Indian references where matched).',
  };
}
