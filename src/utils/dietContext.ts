import type {
  DailyNutritionGoals,
  DietActivityLevel,
  DietaryPreference,
  DietFitnessGoal,
  TrackedMealEntry,
  UserDietProfile,
} from '../types/nutrition';
import { getLocalDateKey } from '../utils/storage';

export type AssistantLanguagePreference = 'auto' | 'english' | 'hindi' | 'hinglish';

export interface LoggedMealSummaryItem {
  dateKey: string;
  timeLabel: string;
  mealCategory: string;
  mealTitle: string;
  servingGrams: number;
  caloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

export interface DaySummaryData {
  dateKey: string;
  mealCount: number;
  totals: {
    caloriesKcal: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    fiberGrams: number;
  };
  remainingToGoal: {
    caloriesKcal: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    fiberGrams: number;
  };
  meals: LoggedMealSummaryItem[];
}

export interface WeeklyNutritionSummary {
  windowStartDateKey: string;
  windowEndDateKey: string;
  daysLoggedCount: number;
  totalMealsLogged: number;
  averageCaloriesWhenLogged: number;
  averageProteinWhenLogged: number;
  averageCarbsWhenLogged: number;
  averageFatWhenLogged: number;
  averageFiberWhenLogged: number;
  dailyBreakdown: Array<{
    dateKey: string;
    mealCount: number;
    caloriesKcal: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    fiberGrams: number;
  }>;
}

export interface UserDietAssistantContext {
  displayName: string;
  todayDateKey: string;
  selectedDateKey: string;
  preferredLanguage: AssistantLanguagePreference;
  dailyGoals: DailyNutritionGoals;
  dietProfile: UserDietProfile;
  missingProfileFields: Array<'age' | 'heightCm' | 'weightKg' | 'activityLevel' | 'fitnessGoal'>;
  todaySummary: DaySummaryData;
  selectedDaySummary: DaySummaryData | null;
  weeklySummary: WeeklyNutritionSummary;
}

export const ACTIVITY_LEVEL_LABELS: Record<DietActivityLevel, string> = {
  sedentary: 'Sedentary (Desk / Minimal exercise)',
  light: 'Lightly Active (1-3 workouts/week)',
  moderate: 'Moderately Active (3-5 workouts/week)',
  active: 'Very Active (6-7 workouts/week)',
};

export const FITNESS_GOAL_LABELS: Record<DietFitnessGoal, string> = {
  weight_loss: 'Weight Loss',
  weight_gain: 'Weight Gain',
  muscle_building: 'Muscle Building',
  maintenance: 'Balanced Maintenance',
};

export const DIETARY_PREFERENCE_LABELS: Record<DietaryPreference, string> = {
  vegetarian: 'Vegetarian',
  'non-vegetarian': 'Non-Vegetarian',
  eggetarian: 'Eggetarian',
  vegan: 'Vegan',
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function summarizeDay(
  entries: TrackedMealEntry[],
  dateKey: string,
  dailyGoals: DailyNutritionGoals
): DaySummaryData {
  const dayMeals = entries
    .filter((entry) => entry.dateKey === dateKey)
    .sort((a, b) => b.loggedAtIso.localeCompare(a.loggedAtIso));

  const totals = dayMeals.reduce(
    (acc, entry) => ({
      caloriesKcal: Math.round(acc.caloriesKcal + (entry.analysis.totals.caloriesKcal || 0)),
      proteinGrams: round1(acc.proteinGrams + (entry.analysis.totals.proteinGrams || 0)),
      carbsGrams: round1(acc.carbsGrams + (entry.analysis.totals.carbsGrams || 0)),
      fatGrams: round1(acc.fatGrams + (entry.analysis.totals.fatGrams || 0)),
      fiberGrams: round1(acc.fiberGrams + (entry.analysis.totals.fiberGrams || 0)),
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }
  );

  const meals: LoggedMealSummaryItem[] = dayMeals.slice(0, 15).map((entry) => {
    const parsedDate = new Date(entry.loggedAtIso);
    const timeLabel = Number.isNaN(parsedDate.getTime())
      ? ''
      : parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      dateKey: entry.dateKey,
      timeLabel,
      mealCategory: entry.mealCategory,
      mealTitle: entry.analysis.mealTitle,
      servingGrams: entry.analysis.estimatedServingSizeGrams || 0,
      caloriesKcal: entry.analysis.totals.caloriesKcal || 0,
      proteinGrams: entry.analysis.totals.proteinGrams || 0,
      carbsGrams: entry.analysis.totals.carbsGrams || 0,
      fatGrams: entry.analysis.totals.fatGrams || 0,
      fiberGrams: entry.analysis.totals.fiberGrams || 0,
    };
  });

  return {
    dateKey,
    mealCount: dayMeals.length,
    totals,
    remainingToGoal: {
      caloriesKcal: Math.round(dailyGoals.caloriesKcal - totals.caloriesKcal),
      proteinGrams: round1(dailyGoals.proteinGrams - totals.proteinGrams),
      carbsGrams: round1(dailyGoals.carbsGrams - totals.carbsGrams),
      fatGrams: round1(dailyGoals.fatGrams - totals.fatGrams),
      fiberGrams: round1(dailyGoals.fiberGrams - totals.fiberGrams),
    },
    meals,
  };
}

function getPastDateKeys(today: Date, daysCount: number): string[] {
  const keys: string[] = [];
  for (let offset = daysCount - 1; offset >= 0; offset -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    keys.push(getLocalDateKey(d));
  }
  return keys;
}

export function buildDietAssistantContext(params: {
  displayName: string;
  dailyGoals: DailyNutritionGoals;
  dietProfile?: UserDietProfile;
  trackedMeals: TrackedMealEntry[];
  selectedDateKey: string;
  preferredLanguage?: AssistantLanguagePreference;
}): UserDietAssistantContext {
  const now = new Date();
  const todayDateKey = getLocalDateKey(now);
  const dietProfile = params.dietProfile || {};

  const missingProfileFields: UserDietAssistantContext['missingProfileFields'] = [];
  if (typeof dietProfile.age !== 'number') missingProfileFields.push('age');
  if (typeof dietProfile.heightCm !== 'number') missingProfileFields.push('heightCm');
  if (typeof dietProfile.weightKg !== 'number') missingProfileFields.push('weightKg');
  if (!dietProfile.activityLevel) missingProfileFields.push('activityLevel');
  if (!dietProfile.fitnessGoal) missingProfileFields.push('fitnessGoal');

  const todaySummary = summarizeDay(params.trackedMeals, todayDateKey, params.dailyGoals);
  const selectedDaySummary =
    params.selectedDateKey && params.selectedDateKey !== todayDateKey
      ? summarizeDay(params.trackedMeals, params.selectedDateKey, params.dailyGoals)
      : null;

  const weekKeys = getPastDateKeys(now, 7);
  const dailyBreakdown = weekKeys.map((dateKey) => {
    const summary = summarizeDay(params.trackedMeals, dateKey, params.dailyGoals);
    return {
      dateKey,
      mealCount: summary.mealCount,
      caloriesKcal: summary.totals.caloriesKcal,
      proteinGrams: summary.totals.proteinGrams,
      carbsGrams: summary.totals.carbsGrams,
      fatGrams: summary.totals.fatGrams,
      fiberGrams: summary.totals.fiberGrams,
    };
  });

  const loggedDays = dailyBreakdown.filter((d) => d.mealCount > 0);
  const loggedDaysCount = loggedDays.length;
  const totalMealsLogged = loggedDays.reduce((acc, d) => acc + d.mealCount, 0);

  const weeklyTotals = loggedDays.reduce(
    (acc, d) => ({
      calories: acc.calories + d.caloriesKcal,
      protein: acc.protein + d.proteinGrams,
      carbs: acc.carbs + d.carbsGrams,
      fat: acc.fat + d.fatGrams,
      fiber: acc.fiber + d.fiberGrams,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const weeklySummary: WeeklyNutritionSummary = {
    windowStartDateKey: weekKeys[0] || todayDateKey,
    windowEndDateKey: weekKeys[weekKeys.length - 1] || todayDateKey,
    daysLoggedCount: loggedDaysCount,
    totalMealsLogged,
    averageCaloriesWhenLogged:
      loggedDaysCount > 0 ? Math.round(weeklyTotals.calories / loggedDaysCount) : 0,
    averageProteinWhenLogged:
      loggedDaysCount > 0 ? round1(weeklyTotals.protein / loggedDaysCount) : 0,
    averageCarbsWhenLogged:
      loggedDaysCount > 0 ? round1(weeklyTotals.carbs / loggedDaysCount) : 0,
    averageFatWhenLogged:
      loggedDaysCount > 0 ? round1(weeklyTotals.fat / loggedDaysCount) : 0,
    averageFiberWhenLogged:
      loggedDaysCount > 0 ? round1(weeklyTotals.fiber / loggedDaysCount) : 0,
    dailyBreakdown,
  };

  return {
    displayName: params.displayName || 'RosoFood Member',
    todayDateKey,
    selectedDateKey: params.selectedDateKey || todayDateKey,
    preferredLanguage: params.preferredLanguage || 'auto',
    dailyGoals: params.dailyGoals,
    dietProfile,
    missingProfileFields,
    todaySummary,
    selectedDaySummary,
    weeklySummary,
  };
}
