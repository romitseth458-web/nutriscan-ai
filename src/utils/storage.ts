import type { DailyNutritionGoals, TrackedMealEntry } from '../types/nutrition';

const MEALS_STORAGE_KEY = 'nutriscan_daily_meals_v1';
const GOALS_STORAGE_KEY = 'nutriscan_daily_goals_v1';

export const DEFAULT_DAILY_GOALS: DailyNutritionGoals = {
  caloriesKcal: 2000,
  proteinGrams: 120,
  carbsGrams: 225,
  fatGrams: 65,
  fiberGrams: 30,
};

export const DEFAULT_WATER_GOAL_ML = 2500;

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPastLocalDateKeys(days: number, endDateKey?: string): string[] {
  const [y, m, d] = (endDateKey || getLocalDateKey()).split('-').map(Number);
  const anchor = new Date(y, (m || 1) - 1, d || 1);
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const dt = new Date(anchor);
    dt.setDate(anchor.getDate() - i);
    keys.push(getLocalDateKey(dt));
  }
  return keys;
}

export function loadTrackedMeals(): TrackedMealEntry[] {
  try {
    const raw = window.localStorage.getItem(MEALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is TrackedMealEntry =>
        Boolean(entry && typeof entry.id === 'string' && entry.analysis?.totals)
    );
  } catch {
    return [];
  }
}

export function saveTrackedMeals(entries: TrackedMealEntry[]): void {
  try {
    window.localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota issues gracefully
  }
}

export function loadDailyGoals(): DailyNutritionGoals {
  try {
    const raw = window.localStorage.getItem(GOALS_STORAGE_KEY);
    if (!raw) return DEFAULT_DAILY_GOALS;
    const parsed = JSON.parse(raw) as Partial<DailyNutritionGoals>;
    return {
      caloriesKcal:
        typeof parsed.caloriesKcal === 'number' && parsed.caloriesKcal > 0
          ? parsed.caloriesKcal
          : DEFAULT_DAILY_GOALS.caloriesKcal,
      proteinGrams:
        typeof parsed.proteinGrams === 'number' && parsed.proteinGrams > 0
          ? parsed.proteinGrams
          : DEFAULT_DAILY_GOALS.proteinGrams,
      carbsGrams:
        typeof parsed.carbsGrams === 'number' && parsed.carbsGrams > 0
          ? parsed.carbsGrams
          : DEFAULT_DAILY_GOALS.carbsGrams,
      fatGrams:
        typeof parsed.fatGrams === 'number' && parsed.fatGrams > 0
          ? parsed.fatGrams
          : DEFAULT_DAILY_GOALS.fatGrams,
      fiberGrams:
        typeof parsed.fiberGrams === 'number' && parsed.fiberGrams > 0
          ? parsed.fiberGrams
          : DEFAULT_DAILY_GOALS.fiberGrams,
    };
  } catch {
    return DEFAULT_DAILY_GOALS;
  }
}

export function saveDailyGoals(goals: DailyNutritionGoals): void {
  try {
    window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // Ignore storage quota issues gracefully
  }
}
