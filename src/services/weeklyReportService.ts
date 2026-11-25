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
  DailyNutritionGoals,
  DietFitnessGoal,
  DietaryPreference,
  MacroTotals,
  TrackedMealEntry,
  WaterLogEntry,
  WeeklyDaySnapshot,
  WeeklyMetricsSnapshot,
  WeeklyReportAiFeedback,
  WeeklyReportRecord,
} from '../types/nutrition';
import { getLocalDateKey } from '../utils/storage';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function round1(value: number): number {
  return Math.round((Number.isFinite(value) ? Math.max(0, value) : 0) * 10) / 10;
}

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeMacroTotals(raw: Partial<MacroTotals> | undefined): MacroTotals {
  return {
    caloriesKcal: Math.round(clampNum(raw?.caloriesKcal, 0, 150000, 0)),
    proteinGrams: round1(clampNum(raw?.proteinGrams, 0, 10000, 0)),
    carbsGrams: round1(clampNum(raw?.carbsGrams, 0, 25000, 0)),
    fatGrams: round1(clampNum(raw?.fatGrams, 0, 10000, 0)),
    fiberGrams: round1(clampNum(raw?.fiberGrams, 0, 5000, 0)),
  };
}

function sanitizeDailyGoals(raw: Partial<DailyNutritionGoals> | undefined): DailyNutritionGoals {
  return {
    caloriesKcal: Math.round(clampNum(raw?.caloriesKcal, 400, 15000, 2000)),
    proteinGrams: Math.round(clampNum(raw?.proteinGrams, 1, 1000, 90)),
    carbsGrams: Math.round(clampNum(raw?.carbsGrams, 1, 2000, 240)),
    fatGrams: Math.round(clampNum(raw?.fatGrams, 1, 1000, 65)),
    fiberGrams: Math.round(clampNum(raw?.fiberGrams, 1, 500, 30)),
  };
}

export function parseLocalDateKey(dateKey: string): Date {
  if (DATE_KEY_RE.test(dateKey)) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

export function shiftLocalDateKey(dateKey: string, deltaDays: number): string {
  const dt = parseLocalDateKey(dateKey);
  dt.setDate(dt.getDate() + deltaDays);
  return getLocalDateKey(dt);
}

export function get7DayWindowKeys(endDateKey: string): string[] {
  const keys: string[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    keys.push(shiftLocalDateKey(endDateKey, -offset));
  }
  return keys;
}

/**
 * Aggregates a real 7-day nutrition & hydration snapshot strictly from logged entries.
 * Days with 0 logged meals stay at 0 and are NEVER invented or interpolated.
 */
export function buildWeeklyMetricsSnapshot(params: {
  meals: TrackedMealEntry[];
  waterLogs: WaterLogEntry[];
  endDateKey: string;
  dailyGoals: DailyNutritionGoals;
  dailyWaterGoalMl: number;
}): WeeklyMetricsSnapshot {
  const { meals, waterLogs, endDateKey, dailyGoals, dailyWaterGoalMl } = params;
  const safeWaterGoal = Math.round(clampNum(dailyWaterGoalMl, 500, 10000, 2500));
  const safeGoals = sanitizeDailyGoals(dailyGoals);
  const windowKeys = get7DayWindowKeys(endDateKey);
  const windowSet = new Set(windowKeys);

  const mealBuckets = new Map<
    string,
    { mealCount: number; caloriesKcal: number; proteinGrams: number; carbsGrams: number; fatGrams: number; fiberGrams: number }
  >();
  for (const meal of meals) {
    if (!windowSet.has(meal.dateKey)) continue;
    const prev = mealBuckets.get(meal.dateKey) || {
      mealCount: 0,
      caloriesKcal: 0,
      proteinGrams: 0,
      carbsGrams: 0,
      fatGrams: 0,
      fiberGrams: 0,
    };
    const t = meal.analysis?.totals;
    mealBuckets.set(meal.dateKey, {
      mealCount: prev.mealCount + 1,
      caloriesKcal: prev.caloriesKcal + (t?.caloriesKcal || 0),
      proteinGrams: prev.proteinGrams + (t?.proteinGrams || 0),
      carbsGrams: prev.carbsGrams + (t?.carbsGrams || 0),
      fatGrams: prev.fatGrams + (t?.fatGrams || 0),
      fiberGrams: prev.fiberGrams + (t?.fiberGrams || 0),
    });
  }

  const waterBuckets = new Map<string, number>();
  for (const w of waterLogs) {
    if (!windowSet.has(w.dateKey)) continue;
    waterBuckets.set(w.dateKey, (waterBuckets.get(w.dateKey) || 0) + (w.amountMl || 0));
  }

  const days: WeeklyDaySnapshot[] = windowKeys.map((dateKey) => {
    const m = mealBuckets.get(dateKey);
    const waterMl = Math.round(Math.max(0, waterBuckets.get(dateKey) || 0));
    if (!m) {
      return {
        dateKey,
        mealCount: 0,
        caloriesKcal: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatGrams: 0,
        fiberGrams: 0,
        waterMl,
      };
    }
    return {
      dateKey,
      mealCount: m.mealCount,
      caloriesKcal: Math.round(m.caloriesKcal),
      proteinGrams: round1(m.proteinGrams),
      carbsGrams: round1(m.carbsGrams),
      fatGrams: round1(m.fatGrams),
      fiberGrams: round1(m.fiberGrams),
      waterMl,
    };
  });

  const loggedMealDays = days.filter((d) => d.mealCount > 0);
  const loggedMealDaysCount = loggedMealDays.length;
  const totalMealsLogged = days.reduce((sum, d) => sum + d.mealCount, 0);

  const weeklyTotals: MacroTotals = {
    caloriesKcal: Math.round(days.reduce((sum, d) => sum + d.caloriesKcal, 0)),
    proteinGrams: round1(days.reduce((sum, d) => sum + d.proteinGrams, 0)),
    carbsGrams: round1(days.reduce((sum, d) => sum + d.carbsGrams, 0)),
    fatGrams: round1(days.reduce((sum, d) => sum + d.fatGrams, 0)),
    fiberGrams: round1(days.reduce((sum, d) => sum + d.fiberGrams, 0)),
  };

  const dailyAverageTotals: MacroTotals =
    loggedMealDaysCount > 0
      ? {
          caloriesKcal: Math.round(weeklyTotals.caloriesKcal / loggedMealDaysCount),
          proteinGrams: round1(weeklyTotals.proteinGrams / loggedMealDaysCount),
          carbsGrams: round1(weeklyTotals.carbsGrams / loggedMealDaysCount),
          fatGrams: round1(weeklyTotals.fatGrams / loggedMealDaysCount),
          fiberGrams: round1(weeklyTotals.fiberGrams / loggedMealDaysCount),
        }
      : { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 };

  const totalWaterMl = Math.round(days.reduce((sum, d) => sum + d.waterMl, 0));
  const loggedWaterDaysCount = days.filter((d) => d.waterMl > 0).length;
  const waterGoalMetDaysCount = days.filter((d) => d.waterMl >= safeWaterGoal).length;
  const averageWaterMl =
    loggedWaterDaysCount > 0 ? Math.round(totalWaterMl / loggedWaterDaysCount) : 0;

  return {
    startDateKey: windowKeys[0],
    endDateKey: windowKeys[6],
    loggedMealDaysCount,
    loggedWaterDaysCount,
    waterGoalMetDaysCount,
    totalMealsLogged,
    dailyAverageTotals,
    weeklyTotals,
    dailyWaterGoalMl: safeWaterGoal,
    averageWaterMl,
    totalWaterMl,
    dailyGoalsSnapshot: safeGoals,
    days,
  };
}

export async function requestWeeklyAiSummary(params: {
  snapshot: WeeklyMetricsSnapshot;
  dietaryPreference?: DietaryPreference;
  fitnessGoal?: DietFitnessGoal;
}): Promise<WeeklyReportAiFeedback> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 32_000);

  try {
    const response = await fetch('/api/weekly-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        startDateKey: params.snapshot.startDateKey,
        endDateKey: params.snapshot.endDateKey,
        loggedMealDaysCount: params.snapshot.loggedMealDaysCount,
        totalMealsLogged: params.snapshot.totalMealsLogged,
        dailyAverageTotals: params.snapshot.dailyAverageTotals,
        dailyGoalsSnapshot: params.snapshot.dailyGoalsSnapshot,
        dailyWaterGoalMl: params.snapshot.dailyWaterGoalMl,
        averageWaterMl: params.snapshot.averageWaterMl,
        totalWaterMl: params.snapshot.totalWaterMl,
        days: params.snapshot.days,
        ...(params.dietaryPreference ? { dietaryPreference: params.dietaryPreference } : {}),
        ...(params.fitnessGoal ? { fitnessGoal: params.fitnessGoal } : {}),
      }),
    });

    const rawText = await response.text();
    let payload: (WeeklyReportAiFeedback & { error?: string }) | null = null;
    if (rawText) {
      try {
        payload = JSON.parse(rawText) as WeeklyReportAiFeedback & { error?: string };
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      if (response.status === 504) {
        throw new Error('Weekly report request timed out. Please try again in a few seconds.');
      }
      throw new Error(
        payload?.error || `Weekly report generation failed (HTTP ${response.status}).`
      );
    }

    if (!payload || typeof payload.aiSummary !== 'string' || !payload.aiSummary.trim()) {
      throw new Error('Received an incomplete weekly report from the server.');
    }

    return {
      aiSummary: payload.aiSummary.trim().slice(0, 950),
      highlights: Array.isArray(payload.highlights)
        ? payload.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 5)
        : [],
      suggestions: Array.isArray(payload.suggestions)
        ? payload.suggestions.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
        : [],
      estimationDisclaimer:
        String(payload.estimationDisclaimer || '').trim().slice(0, 480) ||
        'Nutrition and hydration figures are approximate estimates for wellness awareness—not medical advice.',
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Weekly report generation timed out after 32 seconds. Please retry.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function sanitizeDaySnapshot(raw: Partial<WeeklyDaySnapshot>, fallbackDateKey: string): WeeklyDaySnapshot {
  const dateKey =
    typeof raw.dateKey === 'string' && DATE_KEY_RE.test(raw.dateKey)
      ? raw.dateKey
      : fallbackDateKey;
  return {
    dateKey,
    mealCount: Math.round(clampNum(raw.mealCount, 0, 100, 0)),
    waterMl: Math.round(clampNum(raw.waterMl, 0, 20000, 0)),
    ...sanitizeMacroTotals(raw),
  };
}

export async function saveWeeklyReportForUser(
  userId: string,
  report: Omit<WeeklyReportRecord, 'id' | 'updatedAtIso'> & { id?: string }
): Promise<string> {
  const endDateKey = DATE_KEY_RE.test(report.endDateKey)
    ? report.endDateKey
    : getLocalDateKey();
  const startDateKey = DATE_KEY_RE.test(report.startDateKey)
    ? report.startDateKey
    : shiftLocalDateKey(endDateKey, -6);

  const safeId =
    (report.id || `week-${endDateKey}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) ||
    `week-${endDateKey}`;
  const path = `users/${userId}/weeklyReports/${safeId}`;
  const ref = doc(db, 'users', userId, 'weeklyReports', safeId);

  const windowKeys = get7DayWindowKeys(endDateKey);
  const normalizedDays: WeeklyDaySnapshot[] = windowKeys.map((key, idx) => {
    const match =
      report.days.find((d) => d.dateKey === key) || report.days[idx] || { dateKey: key };
    return sanitizeDaySnapshot(match, key);
  });

  const payload = {
    id: safeId,
    userId,
    startDateKey,
    endDateKey,
    loggedMealDaysCount: Math.round(clampNum(report.loggedMealDaysCount, 0, 7, 0)),
    totalMealsLogged: Math.round(clampNum(report.totalMealsLogged, 0, 500, 0)),
    dailyAverageTotals: sanitizeMacroTotals(report.dailyAverageTotals),
    weeklyTotals: sanitizeMacroTotals(report.weeklyTotals),
    dailyWaterGoalMl: Math.round(clampNum(report.dailyWaterGoalMl, 500, 10000, 2500)),
    averageWaterMl: Math.round(clampNum(report.averageWaterMl, 0, 20000, 0)),
    totalWaterMl: Math.round(clampNum(report.totalWaterMl, 0, 140000, 0)),
    dailyGoalsSnapshot: sanitizeDailyGoals(report.dailyGoalsSnapshot),
    days: normalizedDays,
    aiSummary:
      (report.aiSummary || 'Weekly nutrition summary saved.').trim().slice(0, 980) ||
      'Weekly nutrition summary saved.',
    highlights: (report.highlights || [])
      .map((h) => String(h).trim().slice(0, 240))
      .filter(Boolean)
      .slice(0, 5),
    suggestions: (report.suggestions || [])
      .map((s) => String(s).trim().slice(0, 240))
      .filter(Boolean)
      .slice(0, 5),
    estimationDisclaimer: (
      report.estimationDisclaimer ||
      'Calorie, macro, and hydration figures are approximate wellness estimates—not medical advice.'
    )
      .trim()
      .slice(0, 480),
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

export function subscribeToUserWeeklyReports(
  userId: string,
  onReports: (reports: WeeklyReportRecord[]) => void
): Unsubscribe {
  const path = `users/${userId}/weeklyReports`;
  const q = query(
    collection(db, 'users', userId, 'weeklyReports'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const reports: WeeklyReportRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d || typeof d.endDateKey !== 'string' || !Array.isArray(d.days)) return;

        const updatedAtIso =
          typeof d.updatedAt?.toDate === 'function'
            ? d.updatedAt.toDate().toISOString()
            : new Date().toISOString();

        const windowKeys = get7DayWindowKeys(d.endDateKey);
        const days: WeeklyDaySnapshot[] = windowKeys.map((key, idx) =>
          sanitizeDaySnapshot((d.days[idx] as Partial<WeeklyDaySnapshot>) || {}, key)
        );

        reports.push({
          id: String(d.id || docSnap.id),
          startDateKey: String(d.startDateKey || windowKeys[0]),
          endDateKey: String(d.endDateKey),
          loggedMealDaysCount: Number(d.loggedMealDaysCount) || 0,
          totalMealsLogged: Number(d.totalMealsLogged) || 0,
          dailyAverageTotals: sanitizeMacroTotals(d.dailyAverageTotals as MacroTotals),
          weeklyTotals: sanitizeMacroTotals(d.weeklyTotals as MacroTotals),
          dailyWaterGoalMl: Number(d.dailyWaterGoalMl) || 2500,
          averageWaterMl: Number(d.averageWaterMl) || 0,
          totalWaterMl: Number(d.totalWaterMl) || 0,
          dailyGoalsSnapshot: sanitizeDailyGoals(d.dailyGoalsSnapshot as DailyNutritionGoals),
          days,
          aiSummary: String(d.aiSummary || ''),
          highlights: Array.isArray(d.highlights)
            ? d.highlights.map((x) => String(x)).filter(Boolean)
            : [],
          suggestions: Array.isArray(d.suggestions)
            ? d.suggestions.map((x) => String(x)).filter(Boolean)
            : [],
          estimationDisclaimer: String(d.estimationDisclaimer || ''),
          updatedAtIso,
        });
      });

      reports.sort((a, b) => b.endDateKey.localeCompare(a.endDateKey));
      onReports(reports);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function deleteWeeklyReportForUser(
  userId: string,
  reportId: string
): Promise<void> {
  const path = `users/${userId}/weeklyReports/${reportId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'weeklyReports', reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
